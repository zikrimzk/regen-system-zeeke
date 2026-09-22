<?php
declare(strict_types=1);

return [
    'APP_ENV' => 'production',
    'APP_URL' => 'https://example.com',
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'your_database_name',
    'DB_USER' => 'your_database_user',
    'DB_PASSWORD' => 'replace-with-a-strong-password',

    'SESSION_NAME' => 'regen_sid',
    'SESSION_TTL' => '86400',
    'SESSION_IDLE_TTL' => '7200',
    'SESSION_DRIVER' => 'database',

    'GOOGLE_CLIENT_ID' => 'replace-with-your-web-client-id.apps.googleusercontent.com',

    'RECAPTCHA_SITE_KEY' => 'replace-with-your-recaptcha-v3-site-key',
    'RECAPTCHA_SECRET_KEY' => 'replace-with-your-recaptcha-v3-secret-key',
    'RECAPTCHA_MIN_SCORE' => '0.5',

    'MAIL_FROM_EMAIL' => 'replace-with-your-domain-mailbox',
    'MAIL_FROM_NAME' => 'ReGen',
    'MAIL_REPLY_TO' => 'replace-with-your-support-mailbox',
    'EMAIL_VERIFICATION_TTL' => '3600',
    
    'OPENAI_API_KEY' => 'replace-with-your-openai-project-key',
    'OPENAI_MODEL' => 'gpt-5.4-mini',
    'OPENAI_DAILY_LIMIT' => '15',
    'OPENAI_SUGGEST_USER_MINUTE_LIMIT' => '8',
    'OPENAI_SUGGEST_IP_MINUTE_LIMIT' => '24',
];
