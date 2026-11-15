<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$email = strtolower(trim((string) ($argv[1] ?? '')));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 200) {
    fwrite(STDERR, "Usage: php scripts/create-admin.php administrator@example.com\nSupply a unique 12–128 character password on standard input.\n");
    exit(1);
}
$password = rtrim((string) stream_get_contents(STDIN), "\r\n");
if (strlen($password) < 12 || strlen($password) > 128) {
    fwrite(STDERR, "The password must contain 12–128 characters.\n");
    exit(1);
}
$hash = password_hash($password, PASSWORD_DEFAULT);
$quote = static fn (string $value): string => "'" . str_replace("'", "''", $value) . "'";
echo "INSERT INTO admins (first_name, last_name, email, password_hash, role, status, must_change_password) VALUES\n";
echo "('System', 'Administrator', " . $quote($email) . ', ' . $quote($hash) . ", 'super_admin', 'active', 0);\n";
