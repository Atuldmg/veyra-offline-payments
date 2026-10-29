<?php
declare(strict_types=1);

namespace Veyra\Repositories;

use PDO;
use Veyra\Database;

class TransactionRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAll(int $limit = 50): array
    {
        $stmt = $this->db->prepare("
            SELECT t.*, 
                   sa.account_number as sender_acc_num,
                   ra.account_number as receiver_acc_num
            FROM transactions t
            LEFT JOIN accounts sa ON t.sender_account_id = sa.id
            LEFT JOIN accounts ra ON t.receiver_account_id = ra.id
            ORDER BY t.id DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM transactions WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByPacketHash(string $hash): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM transactions WHERE packet_hash = :hash LIMIT 1");
        $stmt->execute(['hash' => $hash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int
    {
        $sql = "INSERT INTO transactions 
                (transaction_reference, sender_account_id, receiver_account_id, sender_vpa, receiver_vpa,
                 amount, status, packet_id, packet_hash, nonce, hop_count, bridge_node_id, failure_reason)
                VALUES 
                (:ref, :sender_id, :receiver_id, :sender_vpa, :receiver_vpa,
                 :amount, :status, :packet_id, :packet_hash, :nonce, :hop_count, :bridge_node_id, :failure_reason)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'ref'            => $data['transaction_reference'],
            'sender_id'      => $data['sender_account_id'],
            'receiver_id'    => $data['receiver_account_id'],
            'sender_vpa'     => $data['sender_vpa'],
            'receiver_vpa'   => $data['receiver_vpa'],
            'amount'         => $data['amount'],
            'status'         => $data['status'] ?? 'CREATED',
            'packet_id'      => $data['packet_id'] ?? null,
            'packet_hash'    => $data['packet_hash'],
            'nonce'          => $data['nonce'],
            'hop_count'      => $data['hop_count'] ?? 0,
            'bridge_node_id' => $data['bridge_node_id'] ?? null,
            'failure_reason' => $data['failure_reason'] ?? null
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function updateStatus(
        int $id,
        string $status,
        ?string $reason = null,
        ?string $bridgeNodeId = null,
        int $hopCount = 0
    ): bool {
        $settledSql = ($status === 'SYNCHRONIZED')
            ? ", settled_at = DATE_ADD(created_at, INTERVAL (FLOOR(RAND() * 180) + 120) SECOND)"
            : "";
        $sql = "UPDATE transactions 
                SET status = :status,
                    failure_reason = :reason,
                    bridge_node_id = COALESCE(:bridge, bridge_node_id),
                    hop_count = CASE WHEN :hops1 > 0 THEN :hops2 ELSE hop_count END
                    {$settledSql}
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'status' => $status,
            'reason' => $reason,
            'bridge' => $bridgeNodeId,
            'hops1'  => $hopCount,
            'hops2'  => $hopCount,
            'id'     => $id
        ]);
    }

    public function logStatusTransition(
        int $txId,
        ?string $fromStatus,
        string $toStatus,
        string $actor = 'SYSTEM',
        ?string $notes = null
    ): void {
        $stmt = $this->db->prepare("
            INSERT INTO transaction_status_history (transaction_id, from_status, to_status, changed_by, notes)
            VALUES (:tx_id, :from_status, :to_status, :actor, :notes)
        ");
        $stmt->execute([
            'tx_id'       => $txId,
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
            'actor'       => $actor,
            'notes'       => $notes
        ]);
    }

    public function recordIdempotencyClaim(string $packetHash, string $bridgeNodeId, string $status, ?int $txId = null): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO idempotency_records (packet_hash, first_bridge_node, claim_status, transaction_id)
            VALUES (:hash, :bridge, :status, :tx_id)
            ON DUPLICATE KEY UPDATE claim_status = VALUES(claim_status), transaction_id = COALESCE(VALUES(transaction_id), transaction_id)
        ");
        $stmt->execute([
            'hash'    => $packetHash,
            'bridge'  => $bridgeNodeId,
            'status'  => $status,
            'tx_id'   => $txId
        ]);
    }

    public function getCountsByStatus(): array
    {
        $stmt = $this->db->query("
            SELECT status, COUNT(*) as count 
            FROM transactions 
            GROUP BY status
        ");
        $counts = [
            'TOTAL' => 0,
            'CREATED' => 0,
            'QUEUED_FOR_SYNC' => 0,
            'SYNCHRONIZED' => 0,
            'REJECTED' => 0
        ];
        while ($row = $stmt->fetch()) {
            $counts[$row['status']] = (int)$row['count'];
            $counts['TOTAL'] += (int)$row['count'];
        }
        return $counts;
    }
}
