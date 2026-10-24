<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Services/JavaClient.php';

use Veyra\Config;
use Veyra\Database;
use Veyra\Services\JavaClient;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$dbStatus = 'DOWN';
try {
    $db = Database::getConnection();
    $stmt = $db->query("SELECT 1");
    if ($stmt) $dbStatus = 'UP';
} catch (\Throwable $t) {
    $dbStatus = 'DOWN: ' . $t->getMessage();
}

$javaClient = new JavaClient();
$javaHealth = $javaClient->checkHealth();

$overall = ($dbStatus === 'UP' && $javaHealth['status'] === 'UP') ? 'HEALTHY' : 'DEGRADED';

echo json_encode([
    'brand'        => 'VEYRA',
    'tagline'      => 'Secure Transactions. Resilient Networks.',
    'systemStatus' => $overall,
    'timestamp'    => date('c'),
    'services'     => [
        'phpApi' => [
            'status'     => 'UP',
            'phpVersion' => PHP_VERSION,
            'serverTime' => date('Y-m-d H:i:s T')
        ],
        'mysqlDatabase' => [
            'status'   => $dbStatus,
            'database' => 'veyra_db'
        ],
        'javaService' => $javaHealth
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
