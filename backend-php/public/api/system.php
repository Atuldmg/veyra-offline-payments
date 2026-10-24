<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';

use Veyra\Config;
use Veyra\Repositories\AuditRepository;
use Veyra\Services\JavaVerificationClient;

Config::sendCorsHeaders();

$auditRepo = new AuditRepository();
$recentAudits = $auditRepo->getRecent(15);

$javaClient = new JavaVerificationClient();
$keyInfo = $javaClient->getPublicKey();
$healthInfo = $javaClient->checkHealth();

echo json_encode([
    'brand'          => 'VEYRA',
    'tagline'        => 'Secure Transactions. Resilient Networks.',
    'version'        => '1.0.0-PROTOTYPE',
    'architecture'   => [
        'frontend'    => 'HTML5 / CSS3 / Vanilla JS / Bootstrap 5.3.3',
        'backendApi'  => 'PHP 8.0+ / PDO MySQL (Prepared Statements, Transactions)',
        'verifier'    => 'Java 17+ / Spring Boot 3.3.5 (RSA-2048 OAEP, AES-256-GCM, Atomic Cache)',
        'database'    => 'MySQL 8.0+ / MariaDB (Normalized Relational Ledger)'
    ],
    'publicKeyInfo'  => $keyInfo,
    'verifierHealth' => $healthInfo,
    'recentAudits'   => $recentAudits,
    'timestamp'      => date('c')
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
