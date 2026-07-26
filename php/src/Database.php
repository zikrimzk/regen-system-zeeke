<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            Config::get('db.host'),
            Config::get('db.port'),
            Config::get('db.name')
        );

        try {
            self::$connection = new PDO(
                $dsn,
                (string) Config::get('db.user'),
                (string) Config::get('db.password'),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_STRINGIFY_FETCHES => false,
                    PDO::ATTR_TIMEOUT => 10,
                ]
            );
            self::$connection->exec("SET time_zone = '+00:00'");
            return self::$connection;
        } catch (PDOException $error) {
            error_log('[Database Connection Error] ' . $error->getMessage());
            throw new \RuntimeException('Database connection failed.', 0, $error);
        }
    }
}
