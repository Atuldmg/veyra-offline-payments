<?php
declare(strict_types=1);

namespace Veyra;

class Config
{
    private static array $env = [];
    private static bool $loaded = false;

    public static function load(): void
    {
        if (self::$loaded) {
            return;
        }

        $envFile = dirname(__DIR__, 2) . '/.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                if (str_contains($line, '=')) {
                    [$key, $val] = explode('=', $line, 2);
                    $key = trim($key);
                    $val = trim($val, " \t\n\r\0\x0B\"'");
                    self::$env[$key] = $val;
                }
            }
        }
        self::$loaded = true;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        self::load();
        if (isset(self::$env[$key])) {
            return self::$env[$key];
        }
        $val = getenv($key);
        if ($val !== false) {
            return $val;
        }
        return $_SERVER[$key] ?? $default;
    }

    public static function sendCorsHeaders(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
