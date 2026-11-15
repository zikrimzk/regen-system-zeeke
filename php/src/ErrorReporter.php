<?php
declare(strict_types=1);

namespace ReGen;

use PDOException;
use Throwable;

final class ErrorReporter
{
    public static function report(Throwable $error, string $context = 'request', bool $recordIncident = true): string
    {
        $id = (string) ($_SERVER['REGEN_REQUEST_ID'] ?? bin2hex(random_bytes(8)));
        $_SERVER['REGEN_REQUEST_ID'] = $id;
        $details = [
            'requestId' => $id,
            'context' => $context,
            'type' => $error::class,
            'source' => basename($error->getFile()) . ':' . $error->getLine(),
        ];
        $cause = $error;
        while ($cause->getPrevious() !== null) $cause = $cause->getPrevious();
        if ($cause instanceof PDOException) {
            $details['sqlState'] = (string) ($cause->errorInfo[0] ?? $cause->getCode());
            $details['databaseCode'] = (int) ($cause->errorInfo[1] ?? 0);
        }
        if ($error instanceof \GuzzleHttp\Exception\ConnectException || $error instanceof \GuzzleHttp\Exception\RequestException) {
            $details['transportCode'] = (int) ($error->getHandlerContext()['errno'] ?? 0);
        }
        // LOG DIAGNOSTIC CODES WITHOUT SQL, CREDENTIALS OR PERSONAL DATA.
        error_log('[ReGen PHP Error] ' . json_encode($details, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));
        $db = Database::existingConnection();
        if ($recordIncident && $db !== null && !$db->inTransaction()) {
            try {
                $key = 'runtime:' . substr(hash('sha256', $details['type'] . $details['source']), 0, 32) . ':' . gmdate('Y-m-d-H');
                (new AdminAlertService($db))->incident($key, 'high', 'An application error needs investigation',
                    'A request could not complete. Reference ' . $id . '. Check the protected PHP error log for diagnostic codes.', 'operations');
            } catch (Throwable) {
                // Reporting must preserve the original failure even when the database is unavailable.
            }
        }
        return $id;
    }
}
