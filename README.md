# XAU Telegram Connect Card Visible Fix

Masalah:
- Akun ADMIN/PREMIUM sudah masuk dashboard.
- Tapi card Generate Connect Code tidak muncul di web.

Fix:
- TelegramConnectPanel dipasang tegas tepat setelah navbar/header.
- Card hanya muncul untuk role premium/admin.
- Loader status Telegram dipanggil setelah user premium masuk.
- Endpoint Step 2 tetap ada:
  GET/POST /api/telegram-connect-code
  POST /api/telegram-disconnect

Cara test:
1. Upload replace semua ke GitHub.
2. Commit.
3. Tunggu Cloudflare deploy.
4. Login pakai akun admin/premium.
5. Tepat di bawah navbar harus muncul card:
   Connect Telegram Premium
6. Klik Generate Connect Code.
7. Kirim /connect XAU-xxxxxx ke bot.
8. Klik Refresh Status.

Catatan:
- Kalau card belum muncul, hard refresh browser / Mini App.
- Multi-user alert tetap Step 3.