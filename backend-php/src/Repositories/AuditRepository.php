<?php
declare(strict_types=1);

namespace Veyra\Repositories;

use PDO;
use Veyra\Database;

class AuditRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function log(string $eventType, string $actor, array $details, ?string $ip = null): void
    {
        $ip = $ip ?: ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        $stmt = $this->db->prepare("
            INSERT INTO audit_events (event_type, actor, ip_address, details)
            VALUES (:type, :actor, :ip, :details)
        ");
        $stmt->execute([
            'type'    => $eventType,
            'actor'   => $actor,
            'ip'      => $ip,
            'details' => json_encode($details, JSON_UNESCAPED_SLASHES)
        ]);
    }

    public function getRecent(int $limit = 25): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM audit_events 
            ORDER BY id DESC 
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
