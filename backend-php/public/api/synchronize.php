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
use Veyra\Services\TransactionService;

Config::sendCorsHeaders();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

try {
    $service = new TransactionService();
    $result = $service->synchronizeBridges();
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
} catch (\Throwable $t) {
    http_response_code(500);
    echo json_encode([
        'status' => 'ERROR',
        'error'  => $t->getMessage()
    ]);
}
