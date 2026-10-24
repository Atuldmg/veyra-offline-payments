<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';
require_once __DIR__ . '/../../src/Services/TransactionService.php';
require_once __DIR__ . '/../../src/Services/QueueService.php';

use Veyra\Config;
use Veyra\Services\QueueService;

Config::sendCorsHeaders();

$service = new QueueService();
$queue = $service->getPendingQueue();

echo json_encode([
    'status'       => 'SUCCESS',
    'pendingCount' => count($queue),
    'queue'        => $queue
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
