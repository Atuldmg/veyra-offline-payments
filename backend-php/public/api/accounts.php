<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AccountRepository.php';
require_once __DIR__ . '/../../src/Services/JavaClient.php';

use Veyra\Config;
use Veyra\Repositories\AccountRepository;
use Veyra\Services\JavaClient;

Config::sendCorsHeaders();
header('Content-Type: application/json');

$repo = new AccountRepository();

$javaClient = new JavaClient();
$javaAccounts = $javaClient->getAccounts();
if ($javaAccounts && is_array($javaAccounts)) {
    $repo->syncBalancesFromExternal($javaAccounts);
}

$accounts = $repo->findAll();
echo json_encode($accounts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
