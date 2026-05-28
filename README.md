# XAU Email Verification Anti Spam Full Fix

Update:
- User yang register via email/password wajib verifikasi email dulu.
- Setelah register, sistem otomatis kirim email verification link.
- Kalau email belum verified:
  - Dashboard tidak dibuka
  - Paywall juga belum ditampilkan
  - User masuk halaman Verifikasi Email
- Halaman Verifikasi Email punya tombol:
  - Kirim Ulang Link
  - Saya Sudah Verifikasi
  - Logout
- Google login biasanya langsung verified karena email Google sudah verified.

Data user:
- users/{uid}/emailVerified otomatis tersimpan true/false.

Flow:
1. User register email/password.
2. Firebase kirim email verification.
3. User klik link di email.
4. User balik ke web.
5. Klik Saya Sudah Verifikasi.
6. Kalau verified, lanjut ke paywall atau dashboard premium.

Firebase yang perlu aktif:
- Authentication Email/Password
- Email template default Firebase sudah cukup.
- Authorized domain harus ada:
  xau-ai-signal.pages.dev

Catatan:
- MQ5 tidak perlu update.
- Admin Panel tetap jalan.
- Paywall tetap jalan setelah email verified.