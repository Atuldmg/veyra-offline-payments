<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Auth.php';

use Veyra\Auth;
use Veyra\Config;

Config::sendCorsHeaders();

$token = Auth::getCsrfToken();
echo json_encode([
    'status'    => 'SUCCESS',
    'csrfToken' => $token
]);
