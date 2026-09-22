# ReGen Resume Builder

Runtime production ReGen ialah PHP 8.1+ dengan MySQL/MariaDB. Node.js, `npm`, `nodemon`, Docker dan akses terminal server tidak diperlukan.

UI menggunakan reka bentuk light corporate yang responsif untuk telefon, tablet dan
desktop. Runtime production hanya membina dan menghantar release PHP; fail Node
lama kekal sebagai alat ujian dan rujukan migrasi.

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
php scripts/smoke-php-ai.php
php scripts/smoke-php-ats.php
php scripts/smoke-php-google-auth.php
php scripts/smoke-php-google-auth-db.php
php scripts/smoke-php-recaptcha.php
php scripts/smoke-php-email-verification.php
php scripts/smoke-php-email-verification-db.php
powershell -ExecutionPolicy Bypass -File scripts/smoke-php-http.ps1
```

Smoke test HTTP dan email-verification-db memerlukan PHP server/database local
yang aktif serta migration semasa.

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
`http://localhost:8080` dan redirect URI
`http://localhost:8080/api/auth/google`, sepadan dengan `APP_URL`. Google
menolak `login_uri` HTTP yang menggunakan alamat loopback IP, jadi buka aplikasi
local menggunakan `localhost` dan bukannya `127.0.0.1`.

## reCAPTCHA untuk authentication

Pendaftaran dan password login menggunakan Google reCAPTCHA v3 dengan action
`register` dan `login`. Permintaan resend verification menggunakan action
`resend_verification`.
Browser hanya menerima site key; secret key dan semakan token, action serta score
sentiasa berada pada server PHP. Cipta key v3 untuk domain aplikasi, kemudian
konfigurasikan nilai berikut tanpa memasukkan secret sebenar ke Git:

```env
RECAPTCHA_SITE_KEY=your-recaptcha-v3-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-v3-secret-key
RECAPTCHA_MIN_SCORE=0.5
```

Nilai minimum score mesti antara `0` dan `1`; nilai tidak sah kembali kepada `0.5`.
Production gagal tertutup jika konfigurasi tiada atau Google tidak dapat disahkan.
Development dan test kekal boleh digunakan tanpa key supaya setup local tidak
terkunci. Endpoint awam `/api/auth/recaptcha/config` hanya mendedahkan site key dan
status enabled, tidak pernah secret key. Google sign-in tidak menggunakan reCAPTCHA
tambahan kerana ID token Google telah disahkan pada server.

## Email verification

Akaun password baharu tidak menerima session sehingga alamat e-mel disahkan.
ReGen menghantar link `/verify-email#token=...`; fragment tersebut tidak dihantar
kepada web server atau access log. Halaman hanya menggunakan token selepas pengguna
menekan butang verify secara jelas, kemudian server menggunakan transaksi database
untuk mengesahkan expiry dan menggunakan token sekali sahaja. Database hanya
menyimpan SHA-256 hash binary, bukan token atau link asal.

Untuk database sedia ada, jalankan
[`database/migrations/006_email_verification.sql`](database/migrations/006_email_verification.sql)
sekali sahaja. Migration menandakan akaun legacy sebagai verified ketika column
mula-mula dicipta, kemudian membuang default tersebut supaya pendaftaran baharu
bermula sebagai unverified.

DirectAdmin biasanya menyediakan penghantaran melalui fungsi PHP `mail()`. Cipta
mailbox atau forwarder pada domain production dan tetapkan:

```env
MAIL_FROM_EMAIL=no-reply@your-domain.example
MAIL_FROM_NAME=ReGen
MAIL_REPLY_TO=support@your-domain.example
EMAIL_VERIFICATION_TTL=3600
```

`APP_URL` mesti URL HTTPS production yang betul. Nilai contoh, sender tidak sah,
header newline, atau URL HTTP production akan gagal tertutup. Jika mail transport
menolak penghantaran, akaun kekal unverified, kegagalan direkod tanpa token, recipient,
atau verification link, dan pengguna masih boleh meminta link baharu. Endpoint resend
memberikan jawapan generik untuk mengurangkan account enumeration dan mempunyai
rate limit per IP serta hash e-mel. Google account dianggap verified hanya selepas
server menerima claim `email_verified` yang sah daripada Google; akaun password
sedia ada dengan e-mel sama masih perlu disahkan dan memasukkan password sebelum
Google identity boleh dipautkan.

## ReGen AI (OpenAI)

ReGen menggunakan OpenAI Responses API dengan model default `gpt-5.4-mini` untuk
penulisan profesional berstruktur dengan kos penggunaan yang lebih rendah.

AI kini berfungsi pada tahap section, bukan setiap field. Satu permintaan menyemak
semua long-form fields berkaitan dalam Summary, Experience, Projects, Activities,
Skills, Achievements, atau Certifications. Cadangan dipaparkan sebagai perbandingan
sebelum/selepas dan tidak mengubah borang sehingga pengguna memilih
`Use Suggestions`. `Regenerate` menggunakan satu ReGen AI Token baharu.

Arahan server menekankan ayat tepat, profesional, natural, HR-oriented dan
ATS-friendly tanpa keyword stuffing atau fakta rekaan. Server hanya menghantar
konteks resume profesional yang diperlukan. Nama, e-mel, telefon, alamat, lokasi,
gambar, data Personal dan References dikecualikan serta disemak semula sebelum
setiap request. Nama syarikat, organisasi, jawatan dan projek boleh digunakan sebagai
context anchor, tetapi model diarahkan supaya tidak membawa masuk fakta luar yang
tidak diberikan pengguna. Cadangan Skills boleh menggunakan bukti daripada
Experience, Projects dan section profesional lain, dan server menolak skill baharu
yang tidak dapat disokong oleh konteks tersebut. Requests menggunakan `store: false`
serta `safety_identifier` pseudonymous; OpenAI key dan user ID mentah kekal pada
server dan tidak pernah dihantar kepada browser.

Secara default production, setiap pengguna menerima 15 ReGen AI Tokens dalam rolling
window 24 jam yang bermula pada masa action AI pertama. Satu cadangan section atau
AI review baharu menggunakan satu Token. Penggunaan dikira secara atomic di database
untuk mengelakkan parallel request bypass. Jika provider gagal, reservation dipulangkan
hanya jika ia masih berada dalam window yang sama. Dashboard dan panel builder
menunjukkan baki Tokens serta masa reset. ATS score kekal local dan deterministic;
hanya komen pilihan di final review menggunakan satu Token jika komen tersimpan
tidak boleh digunakan.

Untuk local, simpan secret dalam `.env` yang diabaikan Git:

```env
OPENAI_API_KEY=your-openai-project-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_DAILY_LIMIT=100
OPENAI_SUGGEST_USER_MINUTE_LIMIT=120
OPENAI_SUGGEST_IP_MINUTE_LIMIT=240
```

Untuk DirectAdmin, gunakan nilai yang sama dalam `_app/config.local.php`. Jangan
masukkan key sebenar ke `.env.example`, Git, JavaScript, HTML, log, atau screenshot.
Tanpa override, `APP_ENV=development` atau `test` menggunakan 100 Tokens setiap
24 jam dengan burst 120 action pengguna dan 240 action IP seminit. Production
menggunakan default 15, 8, dan 24. Override `OPENAI_DAILY_LIMIT` menerima 1 hingga
1000; override burst pengguna menerima 1 hingga 1000 dan burst IP 1 hingga 2000.
Nilai tidak sah kembali kepada default environment tersebut. Menaikkan limit local
terus menggunakan kiraan window sedia ada, jadi database tidak perlu direset.
Jika `APP_ENV` tidak dikonfigurasi, aplikasi menggunakan `production` sebagai fallback
selamat; local development perlu menetapkan `APP_ENV=development` secara jelas.
Aktifkan project budget dan billing alerts pada OpenAI Platform. Tanpa
`OPENAI_API_KEY`, builder dan local ATS checks masih berfungsi tetapi action AI akan
disabled.

## Session, security dan skala

- Production menggunakan `SESSION_DRIVER=database`, session rotation, absolute
  expiry 24 jam, idle expiry 2 jam dan CSRF token untuk semua perubahan authenticated.
- Login, registration, AI dan ATS endpoints mempunyai shared database rate limits,
  dengan locked-file fallback semasa database limiter belum tersedia.
- Jalankan [`database/migrations/003_release_hardening.sql`](database/migrations/003_release_hardening.sql)
  untuk database sedia ada sebelum mengaktifkan release ini. Schema baru sudah
  mengandungi jadual yang sama.
- Jalankan [`database/migrations/004_openai_ai_quota.sql`](database/migrations/004_openai_ai_quota.sql)
  untuk mengaktifkan shared 15-request rolling window bagi setiap pengguna.
- Jalankan [`database/migrations/005_ai_quota_reservations.sql`](database/migrations/005_ai_quota_reservations.sql)
  supaya refund untuk request provider yang gagal adalah idempotent.
- Jalankan [`database/migrations/006_email_verification.sql`](database/migrations/006_email_verification.sql)
  sekali untuk token verification single-use dan status e-mel.
- Upload gambar hanya menerima JPG/PNG yang sah, dinyahsaiz di browser, dan disemak
  semula pada server.
- Security headers, strict script CSP, no-store API responses dan same-origin checks
  diaktifkan untuk production.

## Checklist sebelum release

1. Jalankan migration `002_google_identity.sql`, `003_release_hardening.sql`,
   `004_openai_ai_quota.sql`, `005_ai_quota_reservations.sql`, kemudian
   `006_email_verification.sql` melalui
   phpMyAdmin.
2. Simpan production secret hanya di `_app/config.local.php`; jangan deploy fail
   `.env-prod` atau secret melalui Git.
3. Rotate database password dan mana-mana API key yang pernah berada dalam Git
   history, kemudian kemas kini server.
4. Jalankan semua pemeriksaan di atas dan buat satu ujian login, builder mobile,
   ReGen AI, ATS review dan PDF di staging.
5. Tetapkan OpenAI project budget/rate limits dan semak penggunaan sebenar sebelum
   membuka traffic besar.
