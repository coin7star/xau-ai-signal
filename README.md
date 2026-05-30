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
