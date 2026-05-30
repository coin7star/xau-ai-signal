# XAU Step 9A FIX Custom Firebase Auth Action Route

Fix penting:
- Memperbaiki bug Step 9A yang membuat halaman utama hanya menampilkan teks URL.
- Route /auth-action sekarang dipasang di App dengan benar.
- getPublicAppUrl tidak lagi mengembalikan JSX.
- App.jsx kembali export default function App dengan benar.
- firebaseClient resetPasswordEmail sekarang memakai actionCodeSettings:
  https://www.xauaisignal.online/auth-action
- sendEmailVerification juga diarahkan ke /auth-action.

Cloudflare ENV:
- VITE_APP_URL=https://www.xauaisignal.online
- APP_URL=https://www.xauaisignal.online
- DASHBOARD_URL=https://www.xauaisignal.online

Firebase:
- Authorized domains sudah harus ada:
  www.xauaisignal.online
  xauaisignal.online
- Email sender custom:
  noreply@xauaisignal.online

Cara test:
1. Upload ZIP ini ke GitHub.
2. Redeploy Cloudflare Pages.
3. Buka https://www.xauaisignal.online
4. Pastikan dashboard normal, bukan teks URL.
5. Test lupa password.
6. Link reset harus menuju /auth-action.
7. Test ganti sandi.

Tidak disentuh:
- Chart/candle
- MQ5
- Admin panel
- Payment orders
- Telegram
- Revenue summary