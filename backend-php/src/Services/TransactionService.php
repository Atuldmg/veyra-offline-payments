<?php
declare(strict_types=1);

namespace Veyra\Services;

use Exception;
use Veyra\Auth;
use Veyra\Database;
use Veyra\Repositories\AccountRepository;
use Veyra\Repositories\AuditRepository;
use Veyra\Repositories\QueueRepository;
use Veyra\Repositories\TransactionRepository;

class TransactionService
{
    private AccountRepository $accountRepo;
    private TransactionRepository $txRepo;
    private QueueRepository $queueRepo;
    private AuditRepository $auditRepo;
    private JavaVerificationClient $javaClient;

    public function __construct()
    {
        $this->accountRepo = new AccountRepository();
        $this->txRepo = new TransactionRepository();
        $this->queueRepo = new QueueRepository();
        $this->auditRepo = new AuditRepository();
        $this->javaClient = new JavaVerificationClient();
    }

    /**
     * Creates an offline transaction, protects it with hybrid encryption,
     * persists it to the offline queue, and injects it into the mesh.
     */
    public function createOfflineTransaction(
        string $senderVpa,
        string $receiverVpa,
        float $amount,
        string $pin,
        int $ttl = 5,
        string $startDevice = 'phone-alice'
    ): array {
        if ($senderVpa === $receiverVpa) {
            throw new Exception("Sender and receiver cannot be the same address.");
        }
        if ($amount <= 0) {
            throw new Exception("Transaction amount must be strictly greater than zero.");
        }

        // Validate sender account
        $sender = $this->accountRepo.findByVpa($senderVpa);
        if (!$sender) {
            throw new Exception("Sender account not found: {$senderVpa}");
        }
        if ((float)$sender['balance'] < $amount) {
            throw new Exception("Insufficient account balance. Available: ₹" . number_format((float)$sender['balance'], 2));
        }

        // Validate receiver account
        $receiver = $this->accountRepo.findByVpa($receiverVpa);
        if (!$receiver) {
            throw new Exception("Receiver account not found: {$receiverVpa}");
        }

        // Validate PIN
        if (!Auth::verifyPin($pin, $sender['pin_hash'])) {
            $this->auditRepo->log('SECURITY_PIN_FAILURE', 'TRANSACTION_ATTEMPT', [
                'sender_vpa' => $senderVpa,
                'amount'     => $amount
            ]);
            throw new Exception("Invalid transaction PIN.");
        }

        // Request hybrid encryption from Java microservice
        $cryptoRes = $this->javaClient->encryptPayload([
            'senderVpa'   => $senderVpa,
            'receiverVpa' => $receiverVpa,
            'amount'      => $amount,
            'pin'         => $pin,
            'ttl'         => $ttl,
            'startDevice' => $startDevice
        ]);

        if (!$cryptoRes || empty($cryptoRes['ciphertext'])) {
            throw new Exception("Cryptographic verification service is unreachable. Transaction safely halted.");
        }

        $packetId = $cryptoRes['packetId'];
        $packetHash = $cryptoRes['packetHash'];
        $ciphertext = $cryptoRes['ciphertext'];
        $nonce = $cryptoRes['nonce'];
        $txRef = 'TX-VEYRA-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // Persist transaction record with status QUEUED_FOR_SYNC
            $txId = $this->txRepo->create([
                'transaction_reference' => $txRef,
                'sender_account_id'     => (int)$sender['id'],
                'receiver_account_id'   => (int)$receiver['id'],
                'sender_vpa'            => $senderVpa,
                'receiver_vpa'          => $receiverVpa,
                'amount'                => $amount,
                'status'                => 'QUEUED_FOR_SYNC',
                'packet_id'             => $packetId,
                'packet_hash'           => $packetHash,
                'nonce'                 => $nonce,
                'hop_count'             => 0,
                'bridge_node_id'        => null,
                'failure_reason'        => null
            ]);

            // Persist state transition history
            $this->txRepo->logStatusTransition($txId, null, 'CREATED', 'CLIENT_API', 'Offline payment instruction composed');
            $this->txRepo->logStatusTransition($txId, 'CREATED', 'QUEUED_FOR_SYNC', 'MESH_INJECTOR', "Packet injected at node {$startDevice}");

            // Persist to offline message queue
            $this->queueRepo->enqueue([
                'packet_id'           => $packetId,
                'packet_hash'         => $packetHash,
                'sender_vpa'          => $senderVpa,
                'receiver_vpa'        => $receiverVpa,
                'amount'              => $amount,
                'ciphertext'          => $ciphertext,
                'ttl'                 => $ttl,
                'current_holder_node' => $startDevice
            ]);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }

        // Inject packet into simulated virtual mesh
        $this->javaClient->injectMeshPacket([
            'deviceId'   => $startDevice,
            'packetId'   => $packetId,
            'ttl'        => $ttl,
            'createdAt'  => $cryptoRes['createdAt'],
            'ciphertext' => $ciphertext
        ]);

        // Audit log
        $this->auditRepo->log('TRANSACTION_CREATED', 'API_CLIENT', [
            'tx_id'       => $txId,
            'tx_ref'      => $txRef,
            'sender_vpa'  => $senderVpa,
            'amount'      => $amount,
            'packet_id'   => $packetId,
            'packet_hash' => substr($packetHash, 0, 16) . '...'
        ]);

        return [
            'transactionId'        => $txId,
            'transactionReference' => $txRef,
            'packetId'             => $packetId,
            'packetHash'           => $packetHash,
            'status'               => 'QUEUED_FOR_SYNC',
            'amount'               => $amount,
            'senderVpa'            => $senderVpa,
            'receiverVpa'          => $receiverVpa,
            'ttl'                  => $ttl,
            'injectedAt'           => $startDevice,
            'ciphertextPreview'    => substr($ciphertext, 0, 64) . '...'
        ];
    }

    /**
     * Settles a verified transaction packet uploaded by a bridge node.
     */
    public function settleVerifiedPacket(
        array $instruction,
        string $packetHash,
        string $bridgeNodeId,
        int $hopCount,
        ?string $packetId = null
    ): array {
        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            // Check database-tier idempotency
            $existingTx = $this->txRepo->findByPacketHash($packetHash);
            if ($existingTx && in_array($existingTx['status'], ['SYNCHRONIZED', 'REJECTED'], true)) {
                $db->rollBack();
                $this->txRepo->recordIdempotencyClaim($packetHash, $bridgeNodeId, 'DROPPED_DUPLICATE', (int)$existingTx['id']);
                return [
                    'outcome'       => 'DUPLICATE_DROPPED',
                    'packetHash'    => $packetHash,
                    'reason'        => 'Already processed in ledger',
                    'transactionId' => (int)$existingTx['id']
                ];
            }

            $senderVpa = $instruction['senderVpa'];
            $receiverVpa = $instruction['receiverVpa'];
            $amount = (float)$instruction['amount'];

            $sender = $this->accountRepo->findByVpa($senderVpa);
            $receiver = $this->accountRepo->findByVpa($receiverVpa);

            if (!$sender || !$receiver) {
                $db->rollBack();
                return [
                    'outcome'    => 'INVALID',
                    'packetHash' => $packetHash,
                    'reason'     => 'Participant account not recognized'
                ];
            }

            $txId = $existingTx ? (int)$existingTx['id'] : null;

            // Balance check
            if ((float)$sender['balance'] < $amount) {
                if ($txId) {
                    $this->txRepo->updateStatus($txId, 'REJECTED', 'Insufficient balance at settlement time', $bridgeNodeId, $hopCount);
                    $this->txRepo->logStatusTransition($txId, 'QUEUED_FOR_SYNC', 'REJECTED', 'SETTLEMENT_SERVICE', 'Insufficient balance');
                }
                $this->txRepo->recordIdempotencyClaim($packetHash, $bridgeNodeId, 'SETTLED', $txId);
                $db->commit();

                return [
                    'outcome'       => 'REJECTED',
                    'packetHash'    => $packetHash,
                    'reason'        => 'Insufficient balance at settlement',
                    'transactionId' => $txId
                ];
            }

            // Atomic balance debit & credit with optimistic lock
            $debited = $this->accountRepo->updateBalance((int)$sender['id'], -$amount, (int)$sender['version']);
            if (!$debited) {
                $db->rollBack();
                throw new Exception("Optimistic concurrency lock failed on sender account {$senderVpa}");
            }

            $credited = $this->accountRepo->updateBalance((int)$receiver['id'], $amount, (int)$receiver['version']);
            if (!$credited) {
                $db->rollBack();
                throw new Exception("Optimistic concurrency lock failed on receiver account {$receiverVpa}");
            }

            // Update or create transaction ledger entry
            if ($txId) {
                $this->txRepo->updateStatus($txId, 'SYNCHRONIZED', null, $bridgeNodeId, $hopCount);
                $this->txRepo->logStatusTransition($txId, 'QUEUED_FOR_SYNC', 'SYNCHRONIZED', 'SETTLEMENT_SERVICE', "Settled via bridge {$bridgeNodeId} (hops: {$hopCount})");
            } else {
                $txRef = 'TX-VEYRA-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
                $txId = $this->txRepo->create([
                    'transaction_reference' => $txRef,
                    'sender_account_id'     => (int)$sender['id'],
                    'receiver_account_id'   => (int)$receiver['id'],
                    'sender_vpa'            => $senderVpa,
                    'receiver_vpa'          => $receiverVpa,
                    'amount'                => $amount,
                    'status'                => 'SYNCHRONIZED',
                    'packet_id'             => $packetId,
                    'packet_hash'           => $packetHash,
                    'nonce'                 => $instruction['nonce'] ?? bin2hex(random_bytes(16)),
                    'hop_count'             => $hopCount,
                    'bridge_node_id'        => $bridgeNodeId
                ]);
                $this->txRepo->logStatusTransition($txId, null, 'SYNCHRONIZED', 'SETTLEMENT_SERVICE', "Direct bridge ingestion settlement");
            }

            if ($packetId) {
                $this->queueRepo->markIngested($packetId);
            }

            $this->txRepo->recordIdempotencyClaim($packetHash, $bridgeNodeId, 'SETTLED', $txId);

            $this->auditRepo->log('SETTLEMENT_SUCCESS', 'SETTLEMENT_ENGINE', [
                'tx_id'       => $txId,
                'amount'      => $amount,
                'sender'      => $senderVpa,
                'receiver'    => $receiverVpa,
                'bridge_node' => $bridgeNodeId,
                'hop_count'   => $hopCount
            ]);

            $db->commit();

            return [
                'outcome'       => 'SETTLED',
                'packetHash'    => $packetHash,
                'transactionId' => $txId,
                'amount'        => $amount,
                'senderVpa'     => $senderVpa,
                'receiverVpa'   => $receiverVpa
            ];

        } catch (Exception $e) {
            $db->rollBack();
            error_log("Settlement failure: " . $e->getMessage());
            return [
                'outcome'    => 'INVALID',
                'packetHash' => $packetHash,
                'reason'     => 'Database error during settlement: ' . $e->getMessage()
            ];
        }
    }
}
