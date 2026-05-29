# XAU Custom Branded Email Auth Full Fix

Fitur:
- Custom branded email verification via Resend.
- Custom branded reset password via Resend.
- Link email masuk ke halaman custom XAU AI:
  /auth-action?mode=verifyEmail&oobCode=...
  /auth-action?mode=resetPassword&oobCode=...
- Kalau endpoint custom gagal, fallback ke Firebase default email agar user tetap bisa lanjut.

Endpoint baru:
- POST /api/auth-email

ENV Cloudflare yang wajib:
- FIREBASE_WEB_API_KEY
  Isi sama dengan VITE_FIREBASE_API_KEY
- RESEND_API_KEY
- EMAIL_FROM
  Contoh: XAU AI Signal <onboarding@resend.dev>
- APP_URL
  https://xau-ai-signal.pages.dev

Cara kerja:
- Register email/password:
  registerWithEmail -> sendCustomVerifyEmail -> /api/auth-email -> Firebase OOB link -> Resend branded email.
- Lupa password:
  resetPasswordEmail -> sendCustomResetPasswordEmail -> /api/auth-email -> Firebase OOB link -> Resend branded email.
- Email click:
  user buka /auth-action page custom di web XAU AI.

Catatan:
- Ini menghindari kebutuhan save custom Action URL di Firebase Console.
- Resend free domain onboarding@resend.dev bisa dipakai test.
- Untuk production lebih bagus pakai domain email sendiri di Resend.
- Jika Firebase REST tidak mengembalikan oobLink pada project kamu, sistem fallback ke email default Firebase.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.