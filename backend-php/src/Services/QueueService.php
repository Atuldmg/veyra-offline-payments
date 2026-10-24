<?php
declare(strict_types=1);

namespace Veyra\Services;

use Veyra\Repositories\AuditRepository;
use Veyra\Repositories\QueueRepository;

class QueueService
{
    private QueueRepository $queueRepo;
    private AuditRepository $auditRepo;
    private JavaVerificationClient $javaClient;
    private TransactionService $txService;

    public function __construct()
    {
        $this->queueRepo = new QueueRepository();
        $this->auditRepo = new AuditRepository();
        $this->javaClient = new JavaVerificationClient();
        $this->txService = new TransactionService();
    }

    public function getPendingQueue(): array
    {
        return $this->queueRepo->findPending();
    }

    /**
     * Triggers bridge node uplink synchronization.
     * Simulates bridge nodes reaching cellular/Wi-Fi connectivity and uploading
     * all cached mesh packets to the verification and settlement pipeline.
     */
    public function synchronize(): array
    {
        $flushRes = $this->javaClient->flushBridgeUploads();
        $uploads = $flushRes['uploads'] ?? [];

        // Also check if any packets exist in MySQL queue that need uploading
        if (empty($uploads)) {
            $dbQueue = $this->queueRepo->findPending();
            foreach ($dbQueue as $item) {
                $uploads[] = [
                    'bridgeNodeId' => 'phone-bridge',
                    'packetId'     => $item['packet_id'],
                    'ttl'          => (int)$item['ttl'],
                    'createdAt'    => strtotime($item['created_at']) * 1000,
                    'ciphertext'   => $item['ciphertext'],
                    'hopCount'     => max(1, 5 - (int)$item['ttl'])
                ];
            }
        }

        $results = [];

        foreach ($uploads as $up) {
            $bridgeNodeId = $up['bridgeNodeId'] ?? 'phone-bridge';
            $packetId     = $up['packetId'];
            $ciphertext   = $up['ciphertext'];
            $hopCount     = (int)($up['hopCount'] ?? 1);

            // Step 1: Submit to Java Verification Microservice
            $verifyRes = $this->javaClient->verifyPacket([
                'packetId'     => $packetId,
                'ciphertext'   => $ciphertext,
                'ttl'          => (int)($up['ttl'] ?? 5),
                'createdAt'    => $up['createdAt'] ?? (time() * 1000),
                'bridgeNodeId' => $bridgeNodeId,
                'hopCount'     => $hopCount
            ]);

            if (!$verifyRes) {
                $results[] = [
                    'packetId'     => substr($packetId, 0, 8),
                    'bridgeNode'   => $bridgeNodeId,
                    'outcome'      => 'FAILED',
                    'reason'       => 'Verification service unreachable'
                ];
                continue;
            }

            $outcome = $verifyRes['outcome'];
            $packetHash = $verifyRes['packetHash'] ?? '?';

            if ($outcome === 'VERIFIED') {
                // Step 2: Settle on authoritative database ledger
                $settleRes = $this->txService->settleVerifiedPacket(
                    $verifyRes['instruction'],
                    $packetHash,
                    $bridgeNodeId,
                    $hopCount,
                    $packetId
                );

                $results[] = [
                    'packetId'      => substr($packetId, 0, 8),
                    'bridgeNode'    => $bridgeNodeId,
                    'outcome'       => $settleRes['outcome'],
                    'packetHash'    => substr($packetHash, 0, 16) . '...',
                    'transactionId' => $settleRes['transactionId'] ?? null,
                    'amount'        => $settleRes['amount'] ?? null
                ];
            } elseif ($outcome === 'DUPLICATE_DROPPED') {
                $this->auditRepo->log('IDEMPOTENCY_DUPLICATE_DROPPED', 'BRIDGE_SYNC', [
                    'packet_id'   => $packetId,
                    'packet_hash' => substr($packetHash, 0, 16) . '...',
                    'bridge_node' => $bridgeNodeId
                ]);

                $results[] = [
                    'packetId'   => substr($packetId, 0, 8),
                    'bridgeNode' => $bridgeNodeId,
                    'outcome'    => 'DUPLICATE_DROPPED',
                    'packetHash' => substr($packetHash, 0, 16) . '...',
                    'reason'     => 'Already claimed in current idempotency window'
                ];
            } else {
                // INVALID or EXPIRED
                $this->auditRepo->log('SECURITY_ALERT_INVALID_PACKET', 'BRIDGE_SYNC', [
                    'packet_id'   => $packetId,
                    'packet_hash' => substr($packetHash, 0, 16) . '...',
                    'reason'      => $verifyRes['reason'] ?? 'Unknown verification failure',
                    'bridge_node' => $bridgeNodeId
                ]);

                $results[] = [
                    'packetId'   => substr($packetId, 0, 8),
                    'bridgeNode' => $bridgeNodeId,
                    'outcome'    => 'INVALID',
                    'packetHash' => substr($packetHash, 0, 16) . '...',
                    'reason'     => $verifyRes['reason'] ?? 'Invalid payload'
                ];
            }
        }

        $this->auditRepo->log('BRIDGE_SYNCHRONIZATION_COMPLETED', 'SYNC_ORCHESTRATOR', [
            'attempted' => count($uploads),
            'results'   => $results
        ]);

        return [
            'status'            => 'SUCCESS',
            'uploadsAttempted'  => count($uploads),
            'results'           => $results
        ];
    }
}
