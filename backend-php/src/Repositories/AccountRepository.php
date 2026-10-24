<?php
declare(strict_types=1);

namespace Veyra\Repositories;

use PDO;
use Veyra\Database;

class AccountRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAll(): array
    {
        $stmt = $this->db->query("
            SELECT a.id, a.user_id, a.vpa, a.account_number, a.balance, a.currency, a.status, a.version,
                   u.full_name, u.username
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.id ASC
        ");
        return $stmt->fetchAll();
    }

    public function findByVpa(string $vpa): ?array
    {
        $stmt = $this->db->prepare("
            SELECT a.id, a.user_id, a.vpa, a.account_number, a.balance, a.currency, a.status, a.version,
                   u.full_name, u.pin_hash
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            WHERE a.vpa = :vpa
            LIMIT 1
        ");
        $stmt->execute(['vpa' => $vpa]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT a.*, u.full_name, u.pin_hash
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateBalance(int $accountId, float $delta, int $expectedVersion): bool
    {
        $stmt = $this->db->prepare("
            UPDATE accounts
            SET balance = balance + :delta,
                version = version + 1
            WHERE id = :id AND version = :version
        ");
        $stmt->execute([
            'delta'   => $delta,
            'id'      => $accountId,
            'version' => $expectedVersion
        ]);
        return $stmt->rowCount() > 0;
    }
}
