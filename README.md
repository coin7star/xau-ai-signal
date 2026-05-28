# XAU Email OTP Code Verification Full Fix

Update:
- Selain link verifikasi Firebase, sekarang user bisa verifikasi email pakai kode angka 6 digit.
- Cocok untuk user yang takut klik link dari email.
- Kode berlaku 10 menit.

Flow:
1. User register.
2. User masuk halaman Verifikasi Email.
3. User bisa pilih:
   - Kirim Kode
   - Kirim Link
4. Kalau pilih Kirim Kode:
   - Sistem kirim kode 6 digit ke email via Resend.
   - User input kode.
   - Jika benar, users/{uid}/emailCodeVerified = true.
   - Dashboard/paywall lanjut terbuka.

ENV Cloudflare wajib untuk kode email:
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=XAU AI Signal <onboarding@resend.dev>

ENV lama tetap:
FIREBASE_DATABASE_URL=...
VITE_FIREBASE_*=...

Endpoint baru:
POST /api/send-email-code
POST /api/verify-email-code

Database baru:
emailCodes/{uid}
users/{uid}/emailCodeVerified

Catatan:
- Link Firebase tetap ada sebagai opsi backup.
- Google login biasanya sudah verified.
- MQ5 tidak perlu update.