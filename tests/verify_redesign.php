<?php
declare(strict_types=1);

$baseUrl = 'http://127.0.0.1:8000';
$passed = 0;
$failed = 0;

function runTest(string $name, callable $fn): void {
    global $passed, $failed;
    echo "• Testing: {$name} ... ";
    try {
        $result = $fn();
        if ($result === true) {
            echo "\033[32m[PASS]\033[0m\n";
            $passed++;
        } else {
            echo "\033[31m[FAIL: " . ($result ?: 'Condition failed') . "]\033[0m\n";
            $failed++;
        }
    } catch (\Throwable $e) {
        echo "\033[31m[EXCEPTION: " . $e->getMessage() . "]\033[0m\n";
        $failed++;
    }
}

function httpGet(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'data' => json_decode($body, true), 'raw' => $body];
}

function httpPost(string $url, array $payload): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 5
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'data' => json_decode($body, true), 'raw' => $body];
}

echo "\n======================================================\n";
echo "      VEYRA E2E INTEGRATION & ARCHITECTURE TESTS     \n";
echo "======================================================\n\n";

runTest("1. Health API returns HEALTHY and UP for PHP, MySQL, and Java", function() use ($baseUrl) {
    $res = httpGet("{$baseUrl}/api/health.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $d = $res['data'];
    if (($d['systemStatus'] ?? '') !== 'HEALTHY') return "System not HEALTHY";
    if (($d['services']['phpApi']['status'] ?? '') !== 'UP') return "PHP not UP";
    if (($d['services']['mysqlDatabase']['status'] ?? '') !== 'UP') return "MySQL not UP";
    if (($d['services']['javaService']['status'] ?? '') !== 'UP') return "Java not UP";
    return true;
});

runTest("2. Accounts API returns seeded demo bank accounts with real balances", function() use ($baseUrl) {
    $res = httpGet("{$baseUrl}/api/accounts.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $accs = $res['data'];
    if (!is_array($accs) || count($accs) < 6) return "Expected at least 6 accounts";
    $vpas = array_column($accs, 'vpa');
    if (!in_array('atul@demo', $vpas) || !in_array('bikram@demo', $vpas) || !in_array('roy@demo', $vpas) || !in_array('anand@demo', $vpas)) return "Missing demo accounts";
    return true;
});

runTest("3. Validation rejects negative amount with HTTP 422", function() use ($baseUrl) {
    $res = httpPost("{$baseUrl}/api/transactions.php", [
        'senderVpa'   => 'atul@demo',
        'receiverVpa' => 'bikram@demo',
        'amount'      => -50.00
    ]);
    if ($res['code'] !== 422) return "Expected HTTP 422, got {$res['code']}";
    return true;
});

runTest("4. Validation rejects non-existent sender VPA", function() use ($baseUrl) {
    $res = httpPost("{$baseUrl}/api/transactions.php", [
        'senderVpa'   => 'attacker@fraud',
        'receiverVpa' => 'bikram@demo',
        'amount'      => 100.00
    ]);
    if ($res['code'] !== 422) return "Expected HTTP 422, got {$res['code']}";
    return true;
});

runTest("5. Validation rejects self-transfer", function() use ($baseUrl) {
    $res = httpPost("{$baseUrl}/api/transactions.php", [
        'senderVpa'   => 'atul@demo',
        'receiverVpa' => 'atul@demo',
        'amount'      => 100.00
    ]);
    if ($res['code'] !== 422) return "Expected HTTP 422, got {$res['code']}";
    return true;
});

$createdTxRef = null;
$createdPacketId = null;
runTest("6. Create valid offline payment via PHP & Java bridge", function() use ($baseUrl, &$createdTxRef, &$createdPacketId) {
    $res = httpPost("{$baseUrl}/api/transactions.php", [
        'senderVpa'   => 'samiksha@demo',
        'receiverVpa' => 'bhavya@demo',
        'amount'      => 75.00,
        'note'        => 'Automated test payment'
    ]);
    if ($res['code'] !== 201) return "Expected HTTP 201, got {$res['code']}: " . $res['raw'];
    $data = $res['data']['data'] ?? [];
    if (empty($data['transactionReference']) || empty($data['packetId'])) return "Missing transactionReference or packetId";
    $createdTxRef = $data['transactionReference'];
    $createdPacketId = $data['packetId'];
    return true;
});

runTest("7. Offline Outbox Queue holds encrypted packet", function() use ($baseUrl, &$createdPacketId) {
    $res = httpGet("{$baseUrl}/api/queue.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $items = $res['data']['queue'] ?? [];
    $pids = array_column($items, 'packet_id');
    if (!in_array($createdPacketId, $pids)) return "Packet {$createdPacketId} not found in offline queue";
    return true;
});

runTest("8. Mesh API retrieves peer devices and bridge status", function() use ($baseUrl) {
    $res = httpGet("{$baseUrl}/api/mesh.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $devices = $res['data']['devices'] ?? [];
    if (count($devices) < 5) return "Expected at least 5 mesh devices";
    return true;
});

runTest("9. Mesh gossip propagates packet toward bridge nodes", function() use ($baseUrl) {
    $res = httpPost("{$baseUrl}/api/mesh.php", ['action' => 'gossip']);
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    if (!isset($res['data']['transfers'])) return "Missing transfers count";
    return true;
});

runTest("10. Bridge upload flushes packets and settles ledger", function() use ($baseUrl) {
    $res = httpPost("{$baseUrl}/api/synchronize.php", []);
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    if (!isset($res['data']['uploadsAttempted'])) return "Missing uploadsAttempted";
    return true;
});

runTest("11. Transaction record is updated to SYNCHRONIZED in MySQL", function() use ($baseUrl, &$createdTxRef) {
    $res = httpGet("{$baseUrl}/api/transactions.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $txs = $res['data']['transactions'] ?? [];
    foreach ($txs as $tx) {
        if ($tx['transaction_reference'] === $createdTxRef) {
            if ($tx['status'] !== 'SYNCHRONIZED') {
                return "Status is {$tx['status']}, expected SYNCHRONIZED";
            }
            return true;
        }
    }
    return "Transaction {$createdTxRef} not found";
});

runTest("12. System API returns RSA public key and audit events", function() use ($baseUrl) {
    $res = httpGet("{$baseUrl}/api/system.php");
    if ($res['code'] !== 200) return "HTTP {$res['code']}";
    $d = $res['data'];
    if (empty($d['serverPublicKey'])) return "Missing serverPublicKey";
    if (!is_array($d['recentAudits'])) return "Missing recentAudits";
    return true;
});

echo "\n======================================================\n";
echo "SUMMARY: Passed: {$passed} | Failed: {$failed}\n";
echo "======================================================\n\n";

exit($failed > 0 ? 1 : 0);
