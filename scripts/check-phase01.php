<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__) . '/vendor/autoload.php';

use ReGen\{AdminAccess, AdminRoutes, Routes, SchemaReadiness, Session};

$assertions = 0;
$check = static function (bool $passed, string $message) use (&$assertions): void {
    if (!$passed) throw new RuntimeException($message);
    $assertions++;
};

foreach (Routes::PAGES as $path => [$view, $group]) {
    $candidate = in_array($group, ['candidate', 'auth'], true);
    $check(Routes::maintenanceBlocks($path, 'GET') === $candidate, 'Incorrect maintenance policy at ' . $path);
    $alias = match ($path) {
        '/admin/login' => '/admin-login.html',
        '/store/activity' => '/token-activity.html',
        '/store/payments' => '/payments.html',
        default => $path . '.html',
    };
    $check(Routes::legacyPage($alias, 'GET') === $path, 'Missing legacy route for ' . $path);
    $check(Routes::maintenanceBlocks($alias, 'HEAD') === $candidate, 'Legacy path differs from ' . $path);
    $check(Routes::privateResponse($path), 'Private/auth page needs no-store at ' . $path);
}
foreach (['/api/store/payments', '/api/mochi/chat', '/api/auth/me', '/api/future', '/api/webhooks/hitpay/other'] as $path) {
    $check(Routes::maintenanceBlocks($path, 'POST'), 'Unexpected API maintenance exception: ' . $path);
}
foreach ([['/api/health','GET'], ['/api/system/status','GET'], ['/api/auth/logout','POST'],
          ['/api/realtime/session','GET'], ['/api/admin/maintenance','PUT'], ['/api/webhooks/hitpay/sandbox','POST']] as [$path, $method]) {
    $check(!Routes::maintenanceBlocks($path, $method), 'Recovery path was unexpectedly blocked: ' . $path);
}
$check(Routes::webhookMode('/api/webhooks/hitpay/live', 'GET') === null, 'Provider callbacks must be POST.');
$check(Routes::realtime('/api/realtime/session', 'POST') === false, 'Realtime exceptions must be method-bound.');
$check(Routes::legacyPage('/nested/builder.html', 'GET') === null, 'Legacy aliases must use exact paths.');
foreach (['//example.invalid', '/\example.invalid', 'https://example.invalid/builder', '/%2fbuilder',
          '/foo/../builder', '/api/profile', '/admin', '/builder#untrusted'] as $path) {
    $check(Routes::returnTarget($path) === null, 'Unexpected sign-in return: ' . $path);
}
$link = '/builder?id=24&section=skills&review=1';
$check(Routes::returnTarget('/builder.html?id=24&section=skills&review=1') === $link, 'Legacy resume ID/state lost.');
$check(Routes::returnTarget('/payments/result?order=RG-123abcd') === '/payments/result?order=RG-123abcd', 'Payment link lost.');
$check(Routes::returnTarget('/verify-email?state=pending', true) === '/verify-email?state=pending', 'Verification return lost.');
$_SESSION = [];
Session::rememberCandidateReturn($link);
$check(Session::afterLoginPath() === $link && Session::afterLoginPath() === '/dashboard', 'Sign-in return should be consumed.');
$_SESSION['candidateReturn'] = ['url'=>$link, 'until'=>time()-1];
$check(Session::afterLoginPath() === '/dashboard', 'Expired sign-in return should be discarded.');

$check(AdminRoutes::capabilities('/api/admin/users/1/export', 'POST') === ['users.export'], 'Export needs its own capability.');
$check(AdminRoutes::capabilities('/api/admin/templates/classic/resumes/1/pdf', 'GET') === ['templates.view', 'templates.resumes'], 'Template permissions do not imply private resume access.');
$check(AdminRoutes::capabilities('/api/admin/recovery/1/restore', 'POST') === ['recovery.manage'], 'Restore requires recovery management.');
$check(AdminRoutes::capabilities('/api/admin/tickets/1/attachments/1', 'GET') === ['support.view'], 'Ticket attachments require support read access.');
$check(AdminRoutes::capabilities('/api/admin/users/future-sensitive-action', 'POST') === null, 'New actions should have no inherited grant.');
$check(AdminRoutes::capabilities('/api/admin/alerts/1', 'POST') === null, 'Self actions must declare a method.');
$check(AdminAccess::moduleForRoute('/api/admin/me') === null, 'Admin self-service does not require a module.');

// Model actual metadata responses for incomplete upgrades without applying DDL.
class ReadinessStatement extends PDOStatement
{
    public function __construct(private readonly array $rows) {}
    public function getIterator(): Iterator { return new ArrayIterator($this->rows); }
    public function fetchColumn(int $column = 0): mixed { return $this->rows[0][$column] ?? false; }
}
class ReadinessMetadata extends PDO
{
    public function __construct(private readonly array $columns, private readonly array $indexes = [], private readonly bool $maintenanceRow = true) {}
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        return new ReadinessStatement(match (true) {
            str_contains($query, 'information_schema.COLUMNS') => $this->columns,
            str_contains($query, 'information_schema.STATISTICS') => $this->indexes,
            $query === 'SELECT 1 FROM maintenance_controls WHERE id=1' => $this->maintenanceRow ? [[1]] : [],
            default => throw new LogicException('Unexpected readiness query'),
        });
    }
}
$schema = (string) file_get_contents(dirname(__DIR__) . '/database/schema.sql');
preg_match_all('/CREATE TABLE IF NOT EXISTS (\w+)\s*\((.*?)\)\s*ENGINE=/s', $schema, $definitions, PREG_SET_ORDER);
$columns = [];
foreach ($definitions as [, $table, $definition]) {
    preg_match_all('/^\s*([a-z_][a-z_0-9]*)\b/m', $definition, $fields);
    foreach ($fields[1] as $column) $columns[] = ['TABLE_NAME'=>$table, 'COLUMN_NAME'=>$column];
}
preg_match_all('/ALTER TABLE (\w+)([^;]+);/s', $schema, $alterations, PREG_SET_ORDER);
foreach ($alterations as [, $table, $definition]) {
    preg_match_all('/ADD COLUMN ([a-z_0-9]+)/', $definition, $fields);
    foreach ($fields[1] as $column) $columns[] = ['TABLE_NAME'=>$table, 'COLUMN_NAME'=>$column];
}
$indexes = [];
foreach (['reference'=>['reference'],'attempt'=>['user_id','request_key'],'request'=>['gateway_mode','gateway_request_id'],
          'charge'=>['gateway_mode','gateway_charge_id']] as $name => $key) {
    foreach ($key as $column) $indexes[] = ['INDEX_NAME'=>$name, 'COLUMN_NAME'=>$column, 'SUB_PART'=>null];
}
$readiness = new SchemaReadiness(new ReadinessMetadata($columns, $indexes));
$check($readiness->coreMissing() === [], 'Fresh-schema columns differ from core readiness checks: ' . implode(', ', $readiness->coreMissing()));
$payment = $readiness->payments();
$check($payment['schemaReady'] && !$payment['configured'] && !$payment['providerVerified'], 'Readiness must distinguish schema from gateway setup.');
$missingPayment = array_filter($columns, static fn(array $row): bool => $row['TABLE_NAME'] !== 'payment_orders');
$readiness = new SchemaReadiness(new ReadinessMetadata($missingPayment));
$check($readiness->coreMissing() === [] && $readiness->payments()['missing'] === ['payment_orders'], 'Missing orders should be reported as a separate payment failure.');
$badIndex = $indexes;
$badIndex[array_key_last($badIndex)]['SUB_PART'] = 4;
$readiness = new SchemaReadiness(new ReadinessMetadata($columns, $badIndex, false));
$check($readiness->coreMissing() === ['maintenance_controls row 1'], 'Missing maintenance singleton was not detected.');
$check(in_array('payment_orders unique (gateway_mode, gateway_charge_id)', $readiness->payments()['missing'], true), 'A partial unique index must not satisfy full charge identity.');

echo "Phase 01 route policy, scoped admin methods, return URLs and schema postconditions passed ($assertions assertions; metadata simulated).\n";
