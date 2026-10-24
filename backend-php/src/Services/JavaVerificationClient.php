<?php
declare(strict_types=1);

namespace Veyra\Services;

use Veyra\Config;

/**
 * Communicates with the VEYRA Java Spring Boot Verification Microservice
 * via authenticated server-to-server HTTP REST calls.
 */
class JavaVerificationClient
{
    private string $baseUrl;
    private string $internalApiKey;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(Config::get('JAVA_SERVICE_URL', 'http://127.0.0.1:8085'), '/');
        $this->internalApiKey = Config::get('VEYRA_INTERNAL_API_KEY', 'veyra_secret_internal_token_2026');
        $this->timeout = (int)Config::get('JAVA_SERVICE_TIMEOUT_SECONDS', 5);
    }

    public function checkHealth(): ?array
    {
        return $this->request('GET', '/api/v1/health');
    }

    public function getPublicKey(): ?array
    {
        return $this->request('GET', '/api/v1/crypto/public-key');
    }

    public function encryptPayload(array $data): ?array
    {
        return $this->request('POST', '/api/v1/crypto/encrypt', $data);
    }

    public function verifyPacket(array $packetData): ?array
    {
        return $this->request('POST', '/api/v1/verify', $packetData);
    }

    public function getMeshState(): ?array
    {
        return $this->request('GET', '/api/v1/mesh/state');
    }

    public function injectMeshPacket(array $data): ?array
    {
        return $this->request('POST', '/api/v1/mesh/inject', $data);
    }

    public function runGossipRound(): ?array
    {
        return $this->request('POST', '/api/v1/mesh/gossip');
    }

    public function flushBridgeUploads(): ?array
    {
        return $this->request('POST', '/api/v1/mesh/flush');
    }

    public function resetMesh(): ?array
    {
        return $this->request('POST', '/api/v1/mesh/reset');
    }

    private function request(string $method, string $path, ?array $payload = null): ?array
    {
        $url = $this->baseUrl . $path;
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            "X-Veyra-Internal-Key: {$this->internalApiKey}"
        ];

        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

            if ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                if ($payload !== null) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
                }
            }

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($response === false || $httpCode < 200 || $httpCode >= 400) {
                error_log("JavaVerificationClient failure: URL={$url}, Code={$httpCode}, Error={$err}");
                return null;
            }

            return json_decode($response, true);
        } else {
            // Fallback using stream context
            $opts = [
                'http' => [
                    'method'  => $method,
                    'header'  => implode("\r\n", $headers) . "\r\n",
                    'timeout' => $this->timeout,
                    'ignore_errors' => true
                ]
            ];
            if ($method === 'POST' && $payload !== null) {
                $opts['http']['content'] = json_encode($payload);
            }
            $context = stream_context_create($opts);
            $res = @file_get_contents($url, false, $context);
            if ($res === false) {
                return null;
            }
            return json_decode($res, true);
        }
    }
}
