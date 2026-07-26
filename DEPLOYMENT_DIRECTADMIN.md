# Deployment ReGen PHP ke DirectAdmin

Versi production ReGen sekarang menggunakan PHP + MySQL/MariaDB. Ia tidak memerlukan Node.js, `npm`, `nodemon`, Docker, terminal server, Apache Handlers atau Softaculous.

## 1. Semak keperluan hosting

Di DirectAdmin, pilih PHP 8.1 atau lebih baharu untuk domain. PHP 8.3 disyorkan.

Extension yang diperlukan:

- `pdo_mysql`
- `mbstring`
- `dom`
- `curl`
- `fileinfo`
- `iconv`

Hosting juga perlu membenarkan `.htaccess` dan Apache `mod_rewrite`. Kebanyakan pakej DirectAdmin biasa sudah menyediakan semua ini.

## 2. Sediakan database

1. Buka **MySQL Management** dalam DirectAdmin.
2. Cipta satu database dan user database.
3. Beri user itu akses penuh kepada database tersebut.
4. Buka **phpMyAdmin**.
5. Pilih database tadi.
6. Tekan **Import** dan import fail [`database/schema.sql`](database/schema.sql).

Catat lima nilai ini:

- host database, biasanya `localhost`
- port, biasanya `3306`
- nama database penuh
- username database penuh
- password database

Nama database dan username DirectAdmin selalunya mempunyai prefix akaun, contohnya `appnest_regen`.

## 3. Cipta FTP account

Gunakan FTP account yang hanya mempunyai akses kepada folder website ini jika DirectAdmin membenarkannya.

Folder production biasanya salah satu daripada:

- `/domains/appnest.my/public_html/` untuk akaun FTP utama; atau
- `/public_html/` untuk FTP account yang root-nya sudah berada dalam folder domain.

Pastikan nilai sebenar dengan melihat folder pertama yang muncul selepas login melalui FileZilla. Folder yang mengandungi `public_html` menentukan nilai `FTP_SERVER_DIR`.

Gunakan FTPS explicit pada port 21 jika hosting menyokongnya. Jangan simpan password FTP atau database dalam repository.

## 4. Masukkan GitHub Secrets

Di repository GitHub, buka:

**Settings → Environments → New environment → `production`**

Dalam environment `production`, tambah secrets berikut:

| Secret | Nilai |
|---|---|
| `APP_URL` | `https://appnest.my` |
| `DB_HOST` | biasanya `localhost` |
| `DB_PORT` | biasanya `3306` |
| `DB_NAME` | nama database penuh DirectAdmin |
| `DB_USER` | username database penuh |
| `DB_PASSWORD` | password database |
| `FTP_SERVER` | hostname FTP daripada hosting |
| `FTP_USERNAME` | username FTP |
| `FTP_PASSWORD` | password FTP |
| `FTP_SERVER_DIR` | folder `public_html` yang tepat, dengan `/` di hujung |

Kemudian tambah environment variables jika nilai lalai tidak sesuai:

| Variable | Nilai lalai |
|---|---|
| `FTP_PROTOCOL` | `ftps` |
| `FTP_PORT` | `21` |

Jika provider hanya memberi FTP biasa, tukar `FTP_PROTOCOL` kepada `ftp`. Ini kurang selamat dan hanya patut digunakan jika FTPS memang tidak disediakan.

## 5. Jalankan deployment pertamac

Workflow berada di [`.github/workflows/deploy-php.yml`](.github/workflows/deploy-php.yml). Setiap push ke branch `main` akan:

1. memeriksa sintaks PHP;
2. memasang dependency production Composer;
3. membina release tanpa fail Node atau development;
4. menghasilkan config production daripada GitHub Secrets;
5. menghantar release ke DirectAdmin melalui FTPS.

Commit dan push perubahan ke `main`. Selepas itu buka tab **Actions** di GitHub dan tunggu workflow **Deploy PHP to DirectAdmin** menjadi hijau.

Workflow juga boleh dijalankan secara manual melalui **Actions → Deploy PHP to DirectAdmin → Run workflow**.

## 6. Pengesahan selepas deploy

Buka URL berikut:

```text
https://appnest.my/api/health
```

Respons yang betul:

```json
{"success":true,"message":"ReGen API ready"}
```

Kemudian uji dalam browser incognito:

1. register akaun baharu;
2. cipta/buka resume;
3. isi dan simpan setiap section;
4. refresh browser dan pastikan data kekal;
5. upload dan delete gambar;
6. semak preview;
7. download PDF;
8. logout dan login semula.

## 7. Jika berlaku error

### `500 Internal Server Error`

Semak **DirectAdmin → Site Summary / Statistics / Logs → Error Log**.

Punca lazim:

- PHP lebih lama daripada 8.1;
- extension `pdo_mysql`, `mbstring` atau `dom` tiada;
- database secret tersalah;
- schema belum diimport;
- `.htaccess`/`mod_rewrite` tidak dibenarkan.

### `Service unavailable` pada `/api/health`

Ini hampir selalu bermaksud sambungan database gagal. Semak `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` serta permission user database.

### GitHub workflow gagal pada FTPS

Semak hostname, port, protocol dan `FTP_SERVER_DIR`. Jika login FileZilla bermula terus di folder domain, jangan gunakan path akaun utama.

### Website lama masih muncul

Kosongkan cache browser dan pastikan workflow deploy ke folder `public_html` untuk domain yang betul.

## 8. Rollback

Cari commit production terakhir yang stabil di GitHub, revert commit yang bermasalah, kemudian push revert itu ke `main`. Workflow akan deploy semula versi stabil.

## Nota kapasiti

Versi ini sesuai untuk user testing dan penggunaan production sederhana pada shared hosting. Ia mempunyai session selamat, prepared statements, validasi upload, rate limit asas dan PDF tanpa Chromium.

Jumlah pengguna serentak sebenar masih bergantung pada had CPU, RAM, proses PHP, saiz database dan polisi hosting. Shared hosting tidak boleh diberi jaminan “mass scale” tanpa load test pada server sebenar; pantau error log dan penggunaan resource selepas user testing.
