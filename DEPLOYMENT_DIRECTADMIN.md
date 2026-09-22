# Deployment ReGen ke DirectAdmin

Panduan ini menganggap document root domain menunjuk ke folder public release dan
folder `_app` berada di dalam release yang sama.

## 1. Sediakan database

Untuk pemasangan baru, import `database/schema.sql`. Untuk database sedia ada,
jalankan migration berikut mengikut urutan melalui phpMyAdmin:

1. `database/migrations/002_google_identity.sql`
2. `database/migrations/003_release_hardening.sql`
3. `database/migrations/004_openai_ai_quota.sql`
4. `database/migrations/005_ai_quota_reservations.sql`
5. `database/migrations/006_email_verification.sql` (jalankan sekali sahaja)

Migration ketiga diperlukan untuk shared rate limiting dan migration keempat
menyimpan rolling limit 15 ReGen AI Tokens secara atomic. Migration kelima memastikan
refund request yang gagal adalah idempotent. Jadual `app_sessions`
mestilah turut tersedia sebelum `SESSION_DRIVER=database` digunakan.

## 2. Simpan konfigurasi server

Salin `php/config.local.example.php` ke `_app/config.local.php` pada server dan isi
nilai production. Fail ini sengaja dikecualikan daripada FTPS deployment.

Konfigurasi minimum:

```php
<?php
return [
    'APP_ENV' => 'production',
    'APP_URL' => 'https://your-domain.example',
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'your_database',
    'DB_USER' => 'your_database_user',
    'DB_PASSWORD' => 'use-a-rotated-password',
    'SESSION_NAME' => 'regen_sid',
    'SESSION_TTL' => '86400',
    'SESSION_IDLE_TTL' => '7200',
    'SESSION_DRIVER' => 'database',
    'GOOGLE_CLIENT_ID' => 'your-client-id.apps.googleusercontent.com',
    'RECAPTCHA_SITE_KEY' => 'your-recaptcha-v3-site-key',
    'RECAPTCHA_SECRET_KEY' => 'your-recaptcha-v3-secret-key',
    'RECAPTCHA_MIN_SCORE' => '0.5',
    'MAIL_FROM_EMAIL' => 'no-reply@your-domain.example',
    'MAIL_FROM_NAME' => 'ReGen',
    'MAIL_REPLY_TO' => 'support@your-domain.example',
    'EMAIL_VERIFICATION_TTL' => '3600',
    'OPENAI_API_KEY' => 'your-openai-project-key',
    'OPENAI_MODEL' => 'gpt-5.4-mini',
];
```

Jangan simpan konfigurasi ini dalam Git. Gunakan project-scoped OpenAI key, tetapkan
project budget/rate limits, dan rotate semua credential yang pernah masuk ke
repository history.

Gunakan key Google reCAPTCHA v3 yang membenarkan domain production. Secret key
mesti kekal dalam `_app/config.local.php` sahaja dan tidak boleh dimasukkan ke HTML
atau JavaScript. Registration dan password login production sengaja gagal tertutup jika key tiada,
placeholder, atau verification provider gagal.

Cipta mailbox `no-reply` (atau sender lain yang sah) pada DirectAdmin dan pastikan
fungsi PHP `mail()` dibenarkan untuk domain tersebut. Sender contoh/placeholder dan
`APP_URL` production tanpa HTTPS sengaja ditolak. Buat pendaftaran staging dengan
alamat yang anda kawal dan periksa folder spam sebelum release. Token verification
tidak pernah disimpan secara mentah; link menggunakan URL fragment dan hanya
digunakan selepas pengguna menekan butang verify.

Sebelum release seterusnya, rotate database credential yang pernah disimpan dalam
`.env-prod`, kemudian purge `.env-prod` dan `.rnd` daripada semua Git history. Padam
fail pada branch semasa sahaja tidak membatalkan credential yang telah terdedah.

## 3. Konfigurasi GitHub environment

Cipta environment `production` dan secrets berikut:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR` — path relatif kepada FTP login root dan mesti berakhir dengan `/`

Optional environment variables:

- `FTP_PROTOCOL` — default `ftps`
- `FTP_PORT` — default `21`

Setiap push ke `main` menjalankan validation, PHP smoke tests, memasang Composer
production dependencies, membina release, dan menghantar fail melalui FTPS.

## 4. Pemeriksaan selepas deploy

1. Buka `/api/health` dan pastikan respons berjaya.
2. Daftar akaun ujian, sahkan melalui link e-mel, kemudian log masuk. Pastikan login
   sebelum verification ditolak dan resend memberikan mesej generik.
3. Bina resume pada viewport telefon dan tablet.
4. Cuba satu cadangan section ReGen AI dan pastikan baki ReGen AI Tokens berkurang satu.
5. Semak ATS score, preview, dan muat turun PDF.
6. Pastikan `_app/config.local.php`, database dump dan upload sementara tidak boleh
   diakses melalui URL awam.
7. Pastikan HTTP dialihkan ke HTTPS pada DirectAdmin/web server dan header HSTS hadir
   pada respons HTTPS production.

Jika migration quota AI belum dijalankan, AI sengaja gagal tertutup supaya limit
tidak boleh dipintas. Jalankan semua migration sebelum menguji OpenAI di production.
