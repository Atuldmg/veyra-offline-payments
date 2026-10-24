<?php
declare(strict_types=1);

namespace Veyra\Repositories;

use PDO;
use Veyra\Database;

class MeshRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAll(): array
    {
        $stmt = $this->db->query("SELECT * FROM mesh_nodes ORDER BY id ASC");
        return $stmt->fetchAll();
    }

    public function findByNodeId(string $nodeId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM mesh_nodes WHERE node_id = :id LIMIT 1");
        $stmt->execute(['id' => $nodeId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateNode(string $nodeId, array $fields): void
    {
        $setClauses = [];
        $params = ['node_id' => $nodeId];

        foreach ($fields as $key => $val) {
            $setClauses[] = "{$key} = :{$key}";
            $params[$key] = $val;
        }

        if (empty($setClauses)) {
            return;
        }

        $sql = "UPDATE mesh_nodes SET " . implode(', ', $setClauses) . " WHERE node_id = :node_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
    }
}
