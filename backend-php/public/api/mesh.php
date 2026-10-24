<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Services/JavaClient.php';
require_once __DIR__ . '/../../src/Services/MeshService.php';

use Veyra\Config;
use Veyra\Services\MeshService;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$meshService = new MeshService();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode($meshService->getState(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: [];
    $action = $body['action'] ?? 'gossip';

    if ($action === 'reset') {
        echo json_encode($meshService->resetMesh(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode($meshService->runGossip(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
