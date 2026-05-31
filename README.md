# XAU Step 9B Custom Reset Email via Resend + Firebase Admin

Fitur:
- Forgot password tidak lagi mengirim email default Firebase.
- Web memanggil `/api/custom-reset-email`.
- Cloudflare Function membuat Firebase reset link via Firebase Admin REST.
- Email dikirim via Resend dari `noreply@xauaisignal.online`.
- Link email langsung ke:
  `https://www.xauaisignal.online/auth-action?mode=resetPassword&oobCode=...`
- Halaman `/auth-action` memproses sandi baru di domain resmi XAU AI Signal.

ENV Cloudflare yang dibutuhkan:
- RESEND_API_KEY
- EMAIL_FROM=XAU AI Signal <noreply@xauaisignal.online>
- APP_URL=https://www.xauaisignal.online
- VITE_APP_URL=https://www.xauaisignal.online
- DASHBOARD_URL=https://www.xauaisignal.online
- VITE_FIREBASE_API_KEY=isi lama
- FIREBASE_PROJECT_ID=sultan-trading-data
- FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=isi dari Firebase service account
- FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=isi private key dari Firebase service account

Nama ENV Firebase Admin yang juga didukung:
- FIREBASE_SERVICE_ACCOUNT_JSON
- FIREBASE_SERVICE_ACCOUNT
- FIREBASE_ADMIN_SERVICE_ACCOUNT
- FIREBASE_SERVICE_ACCOUNT_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_ADMIN_CLIENT_EMAIL
- FIREBASE_ADMIN_PRIVATE_KEY

Cara test:
1. Upload ZIP ini ke GitHub.
2. Redeploy Cloudflare Pages.
3. Buka https://www.xauaisignal.online.
4. Klik lupa password.
5. Cek email dari noreply@xauaisignal.online.
6. Link harus langsung ke www.xauaisignal.online/auth-action.
7. Buat password baru.
8. Login ulang.

Catatan:
- Firebase Templates Action URL boleh dibiarkan default kalau Firebase Console error.
- Email spam masih normal untuk domain baru; klik “Laporkan bukan spam”.
- MQ5 tidak perlu update.


# Step 9C Custom Verification Email

- Register akun baru memakai /api/custom-verify-email.
- Email verifikasi dikirim via Resend.
- Link langsung ke https://www.xauaisignal.online/auth-action?mode=verifyEmail&oobCode=...
- Firebase Template Action URL boleh tetap default jika console error.


## Step 10C — Bybit Test Feed Panel

Tambahan aman/read-only:
- Menampilkan panel monitor Bybit XAUUSDT Perpetual dari Firebase path test.
- Membaca `/bybit_test/xauusdt/latest` dan `/bybit_test/xauusdt/status`.
- Refresh otomatis setiap 30 detik.
- Tidak mengubah path utama `/xauusd/*`.
- Tidak mengganti chart utama MT5.
- Tidak mengubah sinyal, Telegram, admin, payment, atau cron PHP.ID.

Pastikan Step 10B cron PHP.ID sudah jalan dan update path:
- `https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt/status.json`

Cara test:
1. Upload ZIP ke GitHub.
2. Redeploy Cloudflare Pages.
3. Login sebagai user premium/admin.
4. Cari panel `BYBIT TEST FEED · READ ONLY`.
5. Pastikan status `LIVE`, harga XAUUSDT muncul, dan last update berubah.


## Step 10D
- Admin-only Bybit test feed now includes MT5 vs Bybit comparison.
- Read only: does not change signal, charts, Telegram, or /xauusd/latest.


## Step 10F - Bybit Guard Error Monitor Admin Only

Tambahan:
- Panel Bybit admin sekarang membaca `/bybit_test/xauusdt/error`.
- Menampilkan Guard PASSED/FAILED, error terakhir, spread guard, range harga valid.
- Tetap read-only dan hidden dari user biasa.
- Tidak mengubah path utama `/xauusd/latest`.


## Step 10G - Bybit Rate Limit Safe Cron

Tambahan aman:
- File cron baru: `cron/bybit-xauusdt-safe-cron.php`.
- Cron membaca endpoint resmi Bybit V5 `GET /v5/market/tickers` dan `GET /v5/market/kline`.
- Ada `minRunGap`, `freshDataSeconds`, request gap, dan cooldown otomatis saat Bybit rate-limit/error.
- Jika Bybit error, data `/bybit_test/xauusdt/latest` lama tidak dihapus agar panel admin tidak blank.
- Panel admin Bybit sekarang menampilkan status `RATE LIMIT SAFE · STEP 10G`.
- Tetap read-only: tidak mengubah MT5 utama, signal utama, Telegram utama, atau path `/xauusd/latest`.

Cara pakai cepat:
1. Upload folder project ini ke GitHub.
2. Redeploy Cloudflare Pages untuk update panel admin.
3. Upload `cron/bybit-xauusdt-safe-cron.php` ke PHP.ID / hosting cron.
4. Set `FIREBASE_DATABASE_URL` dan `BYBIT_CRON_SECRET` di hosting cron.
5. Jalankan cron tiap 1 menit ke:
   `https://domain-cron-kamu.com/bybit-xauusdt-safe-cron.php?token=ISI_BYBIT_CRON_SECRET`
6. Login dashboard sebagai admin, lalu cek panel Bybit.

Detail lengkap ada di `docs/STEP10G_BYBIT_SAFE_CRON.md`.

## Step 10H - Human-readable Reason Builder

Tambahan:
- Signal utama sekarang punya `reasonDetails` untuk menjelaskan alasan sinyal secara lebih manusiawi.
- Output `reason` tidak lagi hanya list indikator pendek, tapi dirangkai seperti analisa trader: bias EMA, kondisi RSI, MFI, OB M15, risiko ATR, dan aksi yang ditunggu.
- Dashboard menampilkan box `AI Reason Builder` dengan checklist mudah dibaca pemula.
- Ada `blockers` / `Yang ditunggu` agar user tahu kenapa sinyal masih WAIT atau READY.
- Tidak mengubah rule entry utama: CALL tetap butuh EMA cross + RSI + MFI + OB M15 cocok.
- Tidak mengubah Telegram utama, histori, MT5, Firebase path utama, atau Bybit cron.

Contoh output:
`Belum ada CALL valid. Bias utama masih bearish karena EMA 9 berada di bawah EMA 20. RSI lebih mendukung SELL, tapi filter lain belum lengkap. Aksi: tunggu harga dekat Bearish OB M15.`

Detail lengkap ada di `docs/STEP10H_HUMAN_REASON_BUILDER.md`.


## Cloudflare Pages Deploy Note

Repo ini sengaja tidak memakai `package-lock.json` supaya Cloudflare Pages memakai `npm install`, bukan `npm ci` / clean install. Ini mengikuti setup deploy sebelumnya yang lebih lancar di Cloudflare Pages.

Recommended Cloudflare Pages build command:

```txt
npm install && npm run build
```

Build output directory:

```txt
dist
```


## Step 10I — Compact Dashboard Tabs

Dashboard premium sekarang dibuat lebih rapi dengan tab/navbar: Sinyal, Candle, History, Telegram, dan Admin. Default user premium hanya melihat bagian penting dulu agar tidak semak. Tidak ada package-lock.json dan build Cloudflare tetap pakai `npm install && npm run build`.
