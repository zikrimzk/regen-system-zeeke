<?php
declare(strict_types=1);

namespace ReGen;

final class MaintenanceController
{
    public function __construct(private readonly MaintenanceService $maintenance) {}

    public function enforce(string $root, string $path, string $method): void
    {
        if (!Routes::maintenanceBlocks($path, $method)) return;
        $state = $this->maintenance->status();
        if (!$state['active']) return;
        if (str_starts_with($path, '/api/')) self::unavailable($state);
        header('Retry-After: 30');
        $this->render($root, (string) ($_SERVER['REQUEST_URI'] ?? $path), 503, state: $state);
    }

    public static function unavailable(array $state): never
    {
        header('Retry-After: 30');
        Http::json(['success'=>false,'code'=>'MAINTENANCE_MODE','message'=>$state['message'],'maintenance'=>$state],503);
    }

    public function render(string $root, string $returnTo='/dashboard', int $code=200, bool $preview=false, ?array $state=null): never
    {
        $state ??= $this->maintenance->status();
        header('Cache-Control: no-store');
        $returnTo = Routes::returnTarget($returnTo, includeAuth: true) ?? '/dashboard';
        $safe = static fn(string $text): string => htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        PageRenderer::render($root, 'maintenance.html', [
            '{{MAINTENANCE_TITLE}}' => $safe($state['title']),
            '{{MAINTENANCE_MESSAGE}}' => $safe($state['message']),
            '{{MAINTENANCE_RETURN}}' => $safe($returnTo),
            '{{MAINTENANCE_PREVIEW}}' => $preview ? 'true' : 'false',
        ], $code);
    }
}
