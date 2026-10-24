<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Config.php';
require_once __DIR__ . '/../../src/Database.php';
require_once __DIR__ . '/../../src/Auth.php';
require_once __DIR__ . '/../../src/Repositories/AccountRepository.php';
require_once __DIR__ . '/../../src/Repositories/TransactionRepository.php';
require_once __DIR__ . '/../../src/Repositories/QueueRepository.php';
require_once __DIR__ . '/../../src/Repositories/AuditRepository.php';
require_once __DIR__ . '/../../src/Services/JavaVerificationClient.php';
require_once __DIR__ . '/../../src/Services/TransactionService.php';

use Veyra\Auth;
use Veyra\Config;
use Veyra\Database;
use Veyra\Repositories\TransactionRepository;
use Veyra\Services\TransactionService;

Config::sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$txRepo = new TransactionRepository();
$txService = new TransactionService();

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $tx = $txRepo->findById($id);
        if (!$tx) {
            http_response_code(404);
            echo json_encode(['status' => 'ERROR', 'error' => 'Transaction not found']);
            exit;
        }

        // Fetch audit history for this transaction
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM transaction_status_history WHERE transaction_id = :id ORDER BY id ASC");
        $stmt->execute(['id' => $id]);
        $history = $stmt->fetchAll();

        echo json_encode([
            'status'      => 'SUCCESS',
            'transaction' => $tx,
            'history'     => $history
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
    $txs = $txRepo->findAll($limit);

    echo json_encode([
        'status'       => 'SUCCESS',
        'count'        => count($txs),
        'transactions' => $txs
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['status' => 'ERROR', 'error' => 'Invalid JSON payload']);
        exit;
    }

    // Optional CSRF check if X-CSRF-Token header or csrf_token parameter is passed
    $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($data['csrf_token'] ?? null);
    if (!empty($_SESSION['csrf_token']) && !Auth::verifyCsrfToken($csrf)) {
        http_response_code(403);
        echo json_encode(['status' => 'ERROR', 'error' => 'Invalid or expired CSRF token']);
        exit;
    }

    $senderVpa   = trim((string)($data['senderVpa'] ?? ''));
    $receiverVpa = trim((string)($data['receiverVpa'] ?? ''));
    $amount      = (float)($data['amount'] ?? 0);
    $pin         = trim((string)($data['pin'] ?? ''));
    $ttl         = isset($data['ttl']) ? (int)$data['ttl'] : 5;
    $startDevice = trim((string)($data['startDevice'] ?? 'phone-alice'));

    if ($senderVpa === '' || $receiverVpa === '' || $amount <= 0 || $pin === '') {
        http_response_code(422);
        echo json_encode([
            'status' => 'ERROR',
            'error'  => 'Validation failed: senderVpa, receiverVpa, valid amount (> 0), and pin are required.'
        ]);
        exit;
    }

    try {
        $result = $txService->createOfflineTransaction(
            $senderVpa,
            $receiverVpa,
            $amount,
            $pin,
            $ttl,
            $startDevice
        );

        http_response_code(201);
        echo json_encode([
            'status'  => 'SUCCESS',
            'message' => 'Offline transaction successfully composed, encrypted, queued, and injected into mesh.',
            'data'    => $result
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'status' => 'ERROR',
            'error'  => $e->getMessage()
        ]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'ERROR', 'error' => 'Method Not Allowed']);
