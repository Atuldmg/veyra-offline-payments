<?php
declare(strict_types=1);

namespace Veyra;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            Config::load();
            $host = Config::get('DB_HOST', '127.0.0.1');
            $port = Config::get('DB_PORT', '3306');
            $db   = Config::get('DB_NAME', 'veyra_db');
            $user = Config::get('DB_USER', 'root');
            $pass = Config::get('DB_PASS', '');

            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            try {
                self::$instance = new PDO($dsn, $user, $pass, $options);
            } catch (PDOException $e) {
                error_log("Database connection failure: " . $e->getMessage());
                http_response_code(503);
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'ERROR',
                    'error'  => 'Database connection failed. Please ensure MySQL is running and migrations are applied.'
                ]);
                exit(1);
            }
        }

        return self::$instance;
    }
}
