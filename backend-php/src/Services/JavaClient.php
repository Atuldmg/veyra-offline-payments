<?php
declare(strict_types=1);

namespace Veyra\Services;

use Veyra\Config;

class JavaClient
{
    private string $baseUrl;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(Config::get('JAVA_SERVICE_URL', 'http://127.0.0.1:8080'), '/');
        $this->timeout = (int)Config::get('JAVA_SERVICE_TIMEOUT_SECONDS', 5);
    }

    public function checkHealth(): array
    {
        $ch = curl_init("{$this->baseUrl}/api/accounts");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 2,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($code >= 200 && $code < 300) {
            return ['status' => 'UP', 'service' => 'Java Spring Boot (UPI Offline Mesh)', 'url' => $this->baseUrl];
        }
        return ['status' => 'DOWN', 'error' => $err ?: "HTTP Code {$code}", 'url' => $this->baseUrl];
    }

    public function getServerKey(): ?array
    {
        return $this->request('GET', '/api/server-key');
    }

    public function getAccounts(): ?array
    {
        return $this->request('GET', '/api/accounts');
    }

    public function getMeshState(): ?array
    {
        return $this->request('GET', '/api/mesh/state');
    }

    public function getTransactions(): ?array
    {
        return $this->request('GET', '/api/transactions');
    }

    public function sendPayment(string $senderVpa, string $receiverVpa, float $amount, string $pin = "1234"): ?array
    {
        return $this->request('POST', '/api/demo/send', [
            'sender'   => $senderVpa,
            'receiver' => $receiverVpa,
            'amount'   => $amount,
            'pin'      => $pin
        ]);
    }

    public function runGossip(): ?array
    {
        return $this->request('POST', '/api/mesh/gossip');
    }

    public function flushBridges(): ?array
    {
        return $this->request('POST', '/api/mesh/flush');
    }

    public function resetMesh(): ?array
    {
        return $this->request('POST', '/api/mesh/reset');
    }

    private function request(string $method, string $path, ?array $body = null): ?array
    {
        $url = $this->baseUrl . $path;
        $ch = curl_init($url);

        $headers = ['Accept: application/json'];
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $httpCode < 200 || $httpCode >= 400) {
            error_log("JavaClient request failed: {$method} {$url} -> Code: {$httpCode}, Err: {$err}");
            return null;
        }

        $decoded = json_decode($response, true);
        return is_array($decoded) ? $decoded : null;
    }
}
