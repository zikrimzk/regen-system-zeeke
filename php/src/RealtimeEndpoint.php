<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Keep frequent update reads outside the document, AI and mail application graph. */
final class RealtimeEndpoint
{
    use Actions\LiveActions;

    private function __construct(private readonly PDO $db,private readonly string $projectRoot) {}

    public static function dispatch(PDO $db,string $root): void
    {
        $path=Http::path();
        if(!str_starts_with($path,'/api/realtime/'))return;
        RateLimiter::configure($db);
        (new OperationsMonitor($db))->enforceBlock();
        (new self($db,$root))->liveRoutes($path,Http::method());
        Http::json(['success'=>false,'message'=>'Update endpoint not found.'],404);
    }
}
