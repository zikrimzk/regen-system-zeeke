# ReGen Resume Builder

Runtime production ReGen ialah PHP 8.1+ dengan MySQL/MariaDB. Node.js, `npm`, `nodemon`, Docker dan akses terminal server tidak diperlukan.

Frontend dan behavior API asal dikekalkan. Fail Node lama masih berada dalam repository sebagai rujukan migrasi, tetapi workflow production hanya membina dan menghantar release PHP.

## Local PHP

1. Import [`database/schema.sql`](database/schema.sql).
2. Jalankan `composer install`.
3. Salin `php/config.local.example.php` sebagai `php/config.local.php` dan masukkan database local.
4. Jalankan:

```powershell
php -S 127.0.0.1:8000 -t public public/router.php
```

5. Buka `http://127.0.0.1:8000`.

## DirectAdmin

Ikut panduan lengkap dalam [`DEPLOYMENT_DIRECTADMIN.md`](DEPLOYMENT_DIRECTADMIN.md).

Setiap push ke branch `main` mencetuskan workflow [`.github/workflows/deploy-php.yml`](.github/workflows/deploy-php.yml) untuk build dan deploy melalui FTPS.

## Pemeriksaan

```powershell
composer validate --strict
php scripts/smoke-php-pdf.php
php scripts/smoke-php-google-auth.php
php scripts/smoke-php-google-auth-db.php
powershell -ExecutionPolicy Bypass -File scripts/smoke-php-http.ps1
```

Smoke test HTTP memerlukan PHP server dan database local yang aktif.

## Google Sign-In

ReGen menggunakan Google Identity Services dan mengesahkan Google ID token pada
server PHP. Aplikasi hanya menggunakan identiti asas pengguna dan tidak menyimpan
Google access token atau refresh token.

1. Untuk database sedia ada, jalankan
   [`database/migrations/002_google_identity.sql`](database/migrations/002_google_identity.sql)
   sekali melalui phpMyAdmin.
2. Untuk local, tambah `GOOGLE_CLIENT_ID` ke `php/config.local.php`:

   ```php
   'GOOGLE_CLIENT_ID' => 'your-client-id.apps.googleusercontent.com',
   ```

3. Untuk production, tambah GitHub Actions environment secret bernama
   `GOOGLE_CLIENT_ID`. Workflow deployment akan memasukkannya ke konfigurasi
   production secara automatik.
4. Pastikan Google Web OAuth client mempunyai:
   - Authorized JavaScript origin: `https://regen.zeeke.appnest.my`
   - Authorized redirect URI: `https://regen.zeeke.appnest.my/api/auth/google`

Untuk local Google Identity Services, gunakan origin
`http://localhost:8000` dan redirect URI
`http://localhost:8000/api/auth/google`, sepadan dengan `APP_URL`. Google
menolak `login_uri` HTTP yang menggunakan alamat loopback IP, jadi buka aplikasi
local menggunakan `localhost` dan bukannya `127.0.0.1`.
