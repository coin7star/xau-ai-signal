# XAU Step 9A Custom Firebase Auth Action Handler

Fitur baru:
- Route custom: /auth-action
- Reset password bisa diproses di halaman resmi XAU AI Signal.
- Verify email bisa diproses di halaman resmi XAU AI Signal.
- Recover email basic support.
- Forgot password email diarahkan ke:
  https://www.xauaisignal.online/auth-action

ENV yang wajib ada di Cloudflare Pages:
- VITE_APP_URL=https://www.xauaisignal.online
- APP_URL=https://www.xauaisignal.online
- DASHBOARD_URL=https://www.xauaisignal.online

Firebase Console:
1. Authentication > Settings > Authorized domains
   Pastikan ada:
   - www.xauaisignal.online
   - xauaisignal.online

2. Authentication > Templates
   Custom email domain sudah verified:
   - noreply@xauaisignal.online

3. Templates > Password reset > Customize action URL
   Isi:
   https://www.xauaisignal.online/auth-action

4. Templates > Email address verification > Customize action URL
   Isi:
   https://www.xauaisignal.online/auth-action

Catatan:
- Jika Firebase menolak Action URL di template, minimal kode forgot password sudah mengirim actionCodeSettings ke /auth-action.
- Email sender tetap noreply@xauaisignal.online setelah custom domain verified.
- Spam awal masih normal untuk domain baru; klik Report not spam di Gmail untuk melatih reputasi.

Tidak disentuh:
- Chart/candle
- MQ5
- Admin row Manage user
- Payment orders
- Revenue summary
- Export CSV
- Telegram logic

Cara test:
1. Deploy ke Cloudflare Pages.
2. Buka https://www.xauaisignal.online
3. Klik lupa password.
4. Cek email reset.
5. Link harus mengarah ke /auth-action atau setelah klik masuk ke halaman reset custom.
6. Masukkan password baru.
7. Login dengan password baru.

MQ5:
- Tidak perlu update.