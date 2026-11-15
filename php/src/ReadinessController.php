<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class ReadinessController
{
    public static function serve(?PDO $db = null): never
    {
        try {
            if ((new SchemaReadiness($db ?? Database::connection()))->coreMissing() === []) {
                Http::json(['success' => true, 'message' => 'ReGen API ready']);
            }
            throw new \RuntimeException('Core schema postconditions are missing.');
        } catch (\Throwable $error) {
            $requestId = ErrorReporter::report($error, 'health', recordIncident: false);
            Http::json(['success' => false, 'message' => 'Service unavailable', 'requestId' => $requestId], 503);
        }
    }
}
