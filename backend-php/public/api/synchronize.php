<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Auth.php';
require_once __DIR__ . '/../../src/Repositories/AccountRepository.php';
require_once __DIR__ . '/../../src/Repositories/TransactionRepository.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';
require_once __DIR__ . '/../../src/Services/TransactionService.php';
require_once __DIR__ . '/../../src/Services/QueueService.php';

use Veyra\Config;
use Veyra\Services\QueueService;

Config::sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $service = new QueueService();
    $result = $service->synchronize();
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'ERROR', 'error' => 'Method Not Allowed. Use POST to trigger bridge synchronization.']);
