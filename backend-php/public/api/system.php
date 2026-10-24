<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaClient.php';

use Veyra\Config;
use Veyra\Repositories\AuditRepository;
use Veyra\Services\JavaClient;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$javaClient = new JavaClient();
$serverKey = $javaClient->getServerKey();
$javaHealth = $javaClient->checkHealth();

$auditRepo = new AuditRepository();
$audits = $auditRepo->getRecent(10);

echo json_encode([
    'brand'           => 'VEYRA',
    'tagline'         => 'Secure Transactions. Resilient Networks.',
    'version'         => '1.0.0-PROTOTYPE',
    'serverPublicKey' => $serverKey['publicKey'] ?? null,
    'hybridScheme'    => $serverKey['hybridScheme'] ?? 'RSA-OAEP encrypts an AES-256-GCM session key',
    'algorithm'       => $serverKey['algorithm'] ?? 'RSA-2048 / OAEP-SHA256',
    'javaVerifier'    => $javaHealth,
    'recentAudits'    => $audits
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
