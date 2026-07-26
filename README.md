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
powershell -ExecutionPolicy Bypass -File scripts/smoke-php-http.ps1
```

Smoke test HTTP memerlukan PHP server dan database local yang aktif.
