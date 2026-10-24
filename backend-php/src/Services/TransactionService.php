<?php
declare(strict_types=1);

namespace Veyra\Services;

use Exception;
use Veyra\Database;
use Veyra\Repositories\AccountRepository;
use Veyra\Repositories\TransactionRepository;
use Veyra\Repositories\QueueRepository;
use Veyra\Repositories\AuditRepository;

class TransactionService
{
    private AccountRepository $accountRepo;
    private TransactionRepository $txRepo;
    private QueueRepository $queueRepo;
    private AuditRepository $auditRepo;
    private JavaClient $javaClient;

    public function __construct()
    {
        $this->accountRepo = new AccountRepository();
        $this->txRepo = new TransactionRepository();
        $this->queueRepo = new QueueRepository();
        $this->auditRepo = new AuditRepository();
        $this->javaClient = new JavaClient();
    }

    public function createOfflineTransaction(
        string $senderVpa,
        string $receiverVpa,
        float $amount,
        string $pin = '1234',
        int $ttl = 5
    ): array {
        // Validate accounts
        $sender = $this->accountRepo->findByVpa($senderVpa);
        if (!$sender) {
            throw new Exception("Sender wallet '{$senderVpa}' not found.");
        }
        $receiver = $this->accountRepo->findByVpa($receiverVpa);
        if (!$receiver) {
            throw new Exception("Receiver wallet '{$receiverVpa}' not found.");
        }
        if ($senderVpa === $receiverVpa) {
            throw new Exception("Sender and receiver wallets must be different.");
        }
        if ($amount <= 0) {
            throw new Exception("Transaction amount must be strictly greater than zero.");
        }

        // Call Java Spring Boot service to generate packet and inject into phone-alice
        $sendRes = $this->javaClient->sendPayment($senderVpa, $receiverVpa, $amount, $pin);
        if (!$sendRes || empty($sendRes['packetId'])) {
            throw new Exception("Java Verification & Mesh Service unavailable or rejected packet.");
        }

        $packetId = $sendRes['packetId'];
        $packetHash = $sendRes['packetHash'] ?? hash('sha256', $packetId . microtime());
        $txRef = 'TX-VEYRA-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        $nonce = bin2hex(random_bytes(16));

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

        $this->txRepo->logStatusTransition($txId, null, 'QUEUED_FOR_SYNC', 'OFFLINE_TERMINAL', 'Encrypted and placed in mesh buffer');

        $this->queueRepo->enqueue([
            'packet_id'           => $packetId,
            'packet_hash'         => $packetHash,
            'sender_vpa'          => $senderVpa,
            'receiver_vpa'        => $receiverVpa,
            'amount'              => $amount,
            'ciphertext'          => $sendRes['ciphertextPreview'] ?? 'AES-256-GCM encrypted envelope',
            'ttl'                 => $ttl,
            'current_holder_node' => 'phone-alice'
        ]);

        $this->auditRepo->log('TRANSACTION_CREATED', 'API_CLIENT', [
            'tx_id'       => $txId,
            'tx_ref'      => $txRef,
            'packet_id'   => $packetId,
            'sender'      => $senderVpa,
            'receiver'    => $receiverVpa,
            'amount'      => $amount
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
            'holder'               => 'phone-alice',
            'ttl'                  => $ttl
        ];
    }

    public function synchronizeBridges(): array
    {
        $flushRes = $this->javaClient->flushBridges();
        if (!$flushRes) {
            throw new Exception("Unable to reach Java bridge ingestion endpoint.");
        }

        $uploadsAttempted = $flushRes['uploadsAttempted'] ?? 0;
        $results = $flushRes['results'] ?? [];

        // Also fetch latest transactions and accounts from Java to sync with MySQL
        $javaTxs = $this->javaClient->getTransactions() ?? [];
        $javaAccounts = $this->javaClient->getAccounts() ?? [];

        // Sync account balances in MySQL
        if (!empty($javaAccounts)) {
            $this->accountRepo->syncBalancesFromExternal($javaAccounts);
        }

        // Process results and sync ledger states in MySQL
        $db = Database::getConnection();
        foreach ($results as $res) {
            $packetId = $res['packetId'] ?? null;
            $outcome = $res['outcome'] ?? 'UNKNOWN';
            $bridgeNode = $res['bridgeNode'] ?? 'phone-bridge';
            $reason = $res['reason'] ?? null;

            if ($packetId) {
                // Find matching transaction by packet_id
                $stmt = $db->prepare("SELECT * FROM transactions WHERE packet_id = :pid LIMIT 1");
                $stmt->execute(['pid' => $packetId]);
                $tx = $stmt->fetch();

                if ($tx) {
                    $newStatus = ($outcome === 'SETTLED') ? 'SYNCHRONIZED' : (($outcome === 'DUPLICATE_DROPPED') ? $tx['status'] : 'REJECTED');
                    $this->txRepo->updateStatus((int)$tx['id'], $newStatus, $reason, $bridgeNode, 1);
                    $this->txRepo->logStatusTransition((int)$tx['id'], $tx['status'], $newStatus, 'BRIDGE_SYNCHRONIZER', "Outcome: {$outcome}");
                    $this->txRepo->recordIdempotencyClaim($tx['packet_hash'], $bridgeNode, $outcome, (int)$tx['id']);
                }

                if ($outcome === 'SETTLED' || $outcome === 'REJECTED') {
                    $this->queueRepo->markIngested($packetId);
                }
            }
        }

        $this->auditRepo->log('BRIDGE_SYNCHRONIZATION_COMPLETED', 'SYNC_ORCHESTRATOR', [
            'attempted' => $uploadsAttempted,
            'results'   => $results
        ]);

        return [
            'status'           => 'SUCCESS',
            'uploadsAttempted' => $uploadsAttempted,
            'results'          => $results
        ];
    }
}
