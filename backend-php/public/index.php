<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';

use Veyra\Config;

Config::sendCorsHeaders();

echo json_encode([
    'brand'     => 'VEYRA',
    'tagline'   => 'Secure Transactions. Resilient Networks.',
    'service'   => 'VEYRA PHP Application & API Gateway',
    'version'   => '1.0.0-PROTOTYPE',
    'status'    => 'ONLINE',
    'endpoints' => [
        'GET  /api/health.php'        => 'System health and dependent service status',
        'GET  /api/accounts.php'      => 'List demo accounts and balances',
        'GET  /api/transactions.php'  => 'List transaction ledger history',
        'POST /api/transactions.php'  => 'Create and inject an offline payment packet',
        'GET  /api/queue.php'         => 'Inspect pending offline packets awaiting sync',
        'GET  /api/mesh.php'          => 'Current mesh node simulation state',
        'POST /api/mesh.php'          => 'Run gossip round or reset mesh',
        'POST /api/synchronize.php'   => 'Bridge uplink flush and settlement',
        'GET  /api/system.php'        => 'Cryptographic key info and audit log',
        'GET  /api/csrf.php'          => 'Acquire CSRF token'
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
