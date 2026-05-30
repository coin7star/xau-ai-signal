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
