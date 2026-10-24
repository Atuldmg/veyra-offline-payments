<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Repositories/AccountRepository.php';

use Veyra\Config;
use Veyra\Repositories\AccountRepository;

Config::sendCorsHeaders();

$repo = new AccountRepository();
$accounts = $repo->findAll();

echo json_encode([
    'status'   => 'SUCCESS',
    'count'    => count($accounts),
    'accounts' => $accounts
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
