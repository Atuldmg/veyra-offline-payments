<?php
declare(strict_types=1);

namespace Veyra\Repositories;

use PDO;
use Veyra\Database;

class QueueRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findPending(): array
    {
        $stmt = $this->db->query("
            SELECT * FROM offline_queue
            WHERE status IN ('QUEUED', 'IN_FLIGHT')
            ORDER BY id ASC
        ");
        return $stmt->fetchAll();
    }

    public function enqueue(array $item): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO offline_queue 
            (packet_id, packet_hash, sender_vpa, receiver_vpa, amount, ciphertext, ttl, current_holder_node, status)
            VALUES 
            (:packet_id, :packet_hash, :sender_vpa, :receiver_vpa, :amount, :ciphertext, :ttl, :holder, 'QUEUED')
            ON DUPLICATE KEY UPDATE 
            ttl = VALUES(ttl),
            current_holder_node = VALUES(current_holder_node)
        ");

        $stmt->execute([
            'packet_id'   => $item['packet_id'],
            'packet_hash' => $item['packet_hash'],
            'sender_vpa'  => $item['sender_vpa'],
            'receiver_vpa'=> $item['receiver_vpa'],
            'amount'      => $item['amount'],
            'ciphertext'  => $item['ciphertext'],
            'ttl'         => $item['ttl'] ?? 5,
            'holder'      => $item['current_holder_node'] ?? 'phone-alice'
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function updateHolderAndTtl(string $packetId, string $newHolder, int $newTtl): void
    {
        $stmt = $this->db->prepare("
            UPDATE offline_queue 
            SET current_holder_node = :holder, ttl = :ttl
            WHERE packet_id = :packet_id
        ");
        $stmt->execute([
            'holder'    => $newHolder,
            'ttl'       => $newTtl,
            'packet_id' => $packetId
        ]);
    }

    public function markIngested(string $packetId): void
    {
        $stmt = $this->db->prepare("
            UPDATE offline_queue 
            SET status = 'INGESTED'
            WHERE packet_id = :packet_id
        ");
        $stmt->execute(['packet_id' => $packetId]);
    }

    public function clearAll(): void
    {
        $this->db->exec("TRUNCATE TABLE offline_queue");
    }
}
