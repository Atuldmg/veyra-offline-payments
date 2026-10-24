<?php
declare(strict_types=1);

namespace Veyra\Services;

use Veyra\Database;
use Veyra\Repositories\AuditRepository;
use Veyra\Repositories\QueueRepository;

class MeshService
{
    private JavaClient $javaClient;
    private AuditRepository $auditRepo;
    private QueueRepository $queueRepo;

    public function __construct()
    {
        $this->javaClient = new JavaClient();
        $this->auditRepo = new AuditRepository();
        $this->queueRepo = new QueueRepository();
    }

    public function getState(): array
    {
        $meshState = $this->javaClient->getMeshState();
        $db = Database::getConnection();
        $stmt = $db->query("SELECT * FROM mesh_nodes ORDER BY id ASC");
        $dbNodes = $stmt->fetchAll();

        return [
            'status'               => 'SUCCESS',
            'idempotencyCacheSize' => $meshState['idempotencyCacheSize'] ?? 0,
            'devices'              => $meshState['devices'] ?? [],
            'registeredNodes'      => $dbNodes
        ];
    }

    public function runGossip(): array
    {
        $res = $this->javaClient->runGossip();
        if (!$res) {
            return ['status' => 'ERROR', 'message' => 'Java mesh simulator unreachable.'];
        }

        $transfers = $res['transfers'] ?? 0;
        $deviceCounts = $res['deviceCounts'] ?? [];

        $this->auditRepo->log('MESH_GOSSIP_ROUND', 'SIMULATOR', [
            'transfers'    => $transfers,
            'deviceCounts' => $deviceCounts
        ]);

        return [
            'status'       => 'SUCCESS',
            'transfers'    => $transfers,
            'deviceCounts' => $deviceCounts
        ];
    }

    public function resetMesh(): array
    {
        $this->javaClient->resetMesh();
        $this->queueRepo->clearAll();

        $this->auditRepo->log('MESH_RESET', 'ADMIN', ['message' => 'Virtual peer buffers cleared']);

        return ['status' => 'SUCCESS', 'message' => 'Mesh buffers and offline queue cleared'];
    }
}
