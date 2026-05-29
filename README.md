# XAU Rollback Firebase Default Email Full Fix

Rollback:
- Email verification kembali pakai Firebase default.
- Reset password kembali pakai Firebase default.
- Endpoint custom /api/auth-email dihapus.
- Tidak perlu RESEND_API_KEY.
- Tidak perlu EMAIL_FROM.
- Tidak perlu service account OAuth untuk email.

Alasan:
- Resend onboarding@resend.dev hanya bisa kirim test ke email akun Resend sendiri.
- Untuk kirim ke semua user, harus verify domain dulu di Resend.
- Sementara pakai Firebase default agar user mana pun tetap bisa reset password/verifikasi email.

Fitur yang tetap ada:
- Landing page publik
- Pricing 7 Day / 30 Day
- Manual payment
- Paywall pilih paket
- Copy info aktivasi
- Forgot password
- Admin panel
- Telegram connect
- Multi-user alert
- Performance analytics
- Dashboard premium clean

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

ENV yang boleh kamu biarkan tapi tidak dipakai untuk email:
- RESEND_API_KEY
- EMAIL_FROM
- FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL
- FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY

MQ5:
- Tidak perlu update.