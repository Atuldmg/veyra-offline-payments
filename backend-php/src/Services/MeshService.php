<?php
declare(strict_types=1);

namespace Veyra\Services;

use Veyra\Repositories\AuditRepository;
use Veyra\Repositories\MeshRepository;
use Veyra\Repositories\QueueRepository;

class MeshService
{
    private JavaVerificationClient $javaClient;
    private MeshRepository $meshRepo;
    private QueueRepository $queueRepo;
    private AuditRepository $auditRepo;

    public function __construct()
    {
        $this->javaClient = new JavaVerificationClient();
        $this->meshRepo = new MeshRepository();
        $this->queueRepo = new QueueRepository();
        $this->auditRepo = new AuditRepository();
    }

    public function getMeshState(): array
    {
        $nodes = $this->meshRepo->findAll();
        $javaState = $this->javaClient->getMeshState();

        // Merge hardware node definitions with live virtual device held packets
        $merged = [];
        $javaDevices = [];
        if ($javaState && !empty($javaState['devices'])) {
            foreach ($javaState['devices'] as $d) {
                $javaDevices[$d['deviceId']] = $d;
            }
        }

        foreach ($nodes as $node) {
            $nodeId = $node['node_id'];
            $held = $javaDevices[$nodeId] ?? null;
            $merged[] = [
                'id'           => (int)$node['id'],
                'node_id'      => $nodeId,
                'label'        => $node['label'],
                'has_internet' => (bool)$node['has_internet'],
                'is_bridge'    => (bool)$node['is_bridge'],
                'battery_level'=> (int)$node['battery_level'],
                'status'       => $node['status'],
                'packet_count' => $held ? (int)$held['packetCount'] : 0,
                'packet_ids'   => $held ? $held['packetIds'] : []
            ];
        }

        return [
            'nodes'                => $merged,
            'idempotencyCacheSize' => $javaState['idempotencyCacheSize'] ?? 0,
            'timestamp'            => time()
        ];
    }

    public function runGossipRound(): array
    {
        $result = $this->javaClient->runGossipRound();
        if (!$result) {
            return [
                'status'    => 'ERROR',
                'message'   => 'Verification service unreachable',
                'transfers' => 0
            ];
        }

        $this->auditRepo->log('MESH_GOSSIP_ROUND', 'SIMULATOR', [
            'transfers'    => $result['transfers'] ?? 0,
            'deviceCounts' => $result['deviceCounts'] ?? []
        ]);

        return [
            'status'       => 'SUCCESS',
            'transfers'    => $result['transfers'] ?? 0,
            'deviceCounts' => $result['deviceCounts'] ?? []
        ];
    }

    public function resetMesh(): array
    {
        $this->javaClient->resetMesh();
        $this->queueRepo->clearAll();

        $this->auditRepo->log('MESH_RESET', 'ADMIN', [
            'message' => 'Mesh devices, packet queue, and idempotency cache cleared'
        ]);

        return [
            'status'  => 'SUCCESS',
            'message' => 'Mesh simulation and queue reset successfully.'
        ];
    }
}
