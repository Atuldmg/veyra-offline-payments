<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/MeshRepository.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';
require_once __DIR__ . '/../../src/Services/MeshService.php';

use Veyra\Config;
use Veyra\Services\MeshService;

Config::sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$meshService = new MeshService();

if ($method === 'GET') {
    $state = $meshService->getMeshState();
    echo json_encode([
        'status' => 'SUCCESS',
        'data'   => $state
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?: [];
    $action = $data['action'] ?? ($_GET['action'] ?? 'gossip');

    if ($action === 'gossip') {
        $res = $meshService->runGossipRound();
        echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($action === 'reset') {
        $res = $meshService->resetMesh();
        echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'ERROR', 'error' => "Unknown mesh action: {$action}"]);
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'ERROR', 'error' => 'Method Not Allowed']);
