<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/vendor/autoload.php';

$temporary = sys_get_temp_dir() . '/regen-mail-check-' . bin2hex(random_bytes(8));
if (!mkdir($temporary, 0700)) throw new RuntimeException('Cannot create mail check directory.');
$checks = 0;
$verify = static function (string $contents, array $expected) use ($temporary, &$checks): void {
    file_put_contents($temporary . '/.env', $contents);
    ReGen\Config::load($temporary);
    foreach ($expected as $key => $value) {
        if (ReGen\Config::get($key) !== $value) throw new RuntimeException('Mail configuration mismatch: ' . $key);
        $checks++;
    }
};
try {
    $verify("MAIL_MAILER=smtp\nMAIL_HOST=mail.example.com\nMAIL_PORT=465\nMAIL_USERNAME=sender@example.com\nMAIL_PASSWORD=\"test # with = and spaces\"\nMAIL_FROM_ADDRESS=sender@example.com\nMAIL_FROM_NAME=\"ReGen\"\n", [
        'mail.transport' => 'smtp', 'mail.smtp_host' => 'mail.example.com', 'mail.smtp_port' => 465,
        'mail.smtp_username' => 'sender@example.com', 'mail.smtp_password' => 'test # with = and spaces',
        'mail.smtp_encryption' => 'ssl', 'mail.from_email' => 'sender@example.com', 'mail.from_name' => 'ReGen',
    ]);
    $verify("MAIL_TRANSPORT=smtp\nSMTP_HOST=legacy.example.com\nSMTP_PORT=587\nSMTP_USERNAME=old@example.com\nSMTP_PASSWORD=legacy\nSMTP_ENCRYPTION=tls\nMAIL_FROM_EMAIL=old@example.com\n", [
        'mail.transport' => 'smtp', 'mail.smtp_host' => 'legacy.example.com', 'mail.smtp_port' => 587,
        'mail.smtp_username' => 'old@example.com', 'mail.smtp_password' => 'legacy',
        'mail.smtp_encryption' => 'tls', 'mail.from_email' => 'old@example.com',
    ]);
    $verify("SMTP_HOST=old.example.com\nMAIL_HOST=new.example.com\nSMTP_PASSWORD=legacy\nMAIL_PASSWORD=\"\"\nMAIL_FROM_EMAIL=old@example.com\nMAIL_FROM_ADDRESS=new@example.com\nMAIL_PORT=587\nMAIL_ENCRYPTION=starttls\n", [
        'mail.smtp_host' => 'new.example.com', 'mail.smtp_password' => '',
        'mail.from_email' => 'new@example.com', 'mail.smtp_encryption' => 'tls',
    ]);
    $verify('MAIL_PASSWORD="quote\\" and slash\\\\ and $literal"', ['mail.smtp_password' => 'quote" and slash\\ and $literal']);
    $verify('', ['mail.smtp_host' => '', 'mail.smtp_password' => '', 'mail.smtp_encryption' => 'tls', 'mail.smtp_port' => 587]);
    echo "Mail configuration compatibility passed ($checks assertions; no messages sent).\n";
} finally {
    if (is_file($temporary . '/.env')) unlink($temporary . '/.env');
    rmdir($temporary);
    ReGen\Config::load(dirname(__DIR__));
}
