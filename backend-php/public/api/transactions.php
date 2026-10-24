<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AccountRepository.php';
require_once __DIR__ . '/../../src/Repositories/TransactionRepository.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaClient.php';
require_once __DIR__ . '/../../src/Services/TransactionService.php';

use Veyra\Config;
use Veyra\Repositories\TransactionRepository;
use Veyra\Services\TransactionService;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $txRepo = new TransactionRepository();
    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
    $txs = $txRepo->findAll($limit);
    $counts = $txRepo->getCountsByStatus();

    echo json_encode([
        'status'       => 'SUCCESS',
        'metrics'      => $counts,
        'transactions' => $txs
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?: [];

    $senderVpa   = trim((string)($body['senderVpa'] ?? $body['sender'] ?? ''));
    $receiverVpa = trim((string)($body['receiverVpa'] ?? $body['receiver'] ?? ''));
    $amount      = (float)($body['amount'] ?? 0);
    $pin         = trim((string)($body['pin'] ?? '1234'));
    $ttl         = (int)($body['ttl'] ?? 5);

    if (empty($senderVpa) || empty($receiverVpa) || $amount <= 0) {
        http_response_code(422);
        echo json_encode([
            'status' => 'ERROR',
            'error'  => 'Missing or invalid fields: senderVpa, receiverVpa, and positive amount are required.'
        ]);
        exit;
    }

    try {
        $txService = new TransactionService();
        $result = $txService->createOfflineTransaction($senderVpa, $receiverVpa, $amount, $pin, $ttl);
        http_response_code(201);
        echo json_encode([
            'status'  => 'SUCCESS',
            'message' => 'Offline transaction successfully composed, encrypted, queued, and injected into virtual BLE mesh.',
            'data'    => $result
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    } catch (\Throwable $t) {
        http_response_code(422);
        echo json_encode([
            'status' => 'ERROR',
            'error'  => $t->getMessage()
        ]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
