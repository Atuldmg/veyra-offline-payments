<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';

use Veyra\Config;
use Veyra\Repositories\QueueRepository;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$repo = new QueueRepository();
$pending = $repo->findPending();

echo json_encode([
    'status' => 'SUCCESS',
    'count'  => count($pending),
    'queue'  => $pending
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
