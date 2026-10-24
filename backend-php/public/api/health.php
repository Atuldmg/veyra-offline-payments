<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';

use Veyra\Config;
use Veyra\Database;
use Veyra\Services\JavaVerificationClient;

Config::sendCorsHeaders();

$mysqlStatus = 'DOWN';
try {
    $db = Database::getConnection();
    $stmt = $db->query("SELECT 1");
    if ($stmt) {
        $mysqlStatus = 'UP';
    }
} catch (Exception $e) {
    $mysqlStatus = 'DOWN (' . $e->getMessage() . ')';
}

$javaClient = new JavaVerificationClient();
$javaHealth = $javaClient->checkHealth();
$javaStatus = $javaHealth ? ($javaHealth['status'] ?? 'UP') : 'DOWN';

$overallStatus = ($mysqlStatus === 'UP' && $javaStatus === 'UP') ? 'HEALTHY' : 'DEGRADED';

echo json_encode([
    'brand'           => 'VEYRA',
    'tagline'         => 'Secure Transactions. Resilient Networks.',
    'systemStatus'    => $overallStatus,
    'timestamp'       => date('c'),
    'environment'     => Config::get('APP_ENV', 'development'),
    'services'        => [
        'phpApi' => [
            'status'     => 'UP',
            'phpVersion' => PHP_VERSION,
            'serverTime' => date('Y-m-d H:i:s T')
        ],
        'mysqlDatabase' => [
            'status'   => $mysqlStatus,
            'database' => Config::get('DB_NAME', 'veyra_db')
        ],
        'javaVerificationService' => [
            'status'            => $javaStatus,
            'details'           => $javaHealth,
            'serviceUrl'        => Config::get('JAVA_SERVICE_URL', 'http://127.0.0.1:8085')
        ]
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
