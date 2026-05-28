# XAU Telegram Connect Step 2 Full Fix

Step 2:
- Premium user bisa connect akun Telegram masing-masing.
- Dashboard punya card Telegram Connect.
- User generate kode dari web.
- User kirim /connect KODE ke bot Telegram.
- Bot simpan telegramChatId ke users/{uid}.

Endpoint baru:
- GET /api/telegram-connect-code?uid=...
- POST /api/telegram-connect-code
- POST /api/telegram-disconnect

Command bot baru:
- /connect KODE
- /disconnect
- /me

Data baru di Firebase:
- telegramConnectCodes/{code}
- users/{uid}/telegramChatId
- users/{uid}/telegramUsername
- users/{uid}/telegramConnected
- users/{uid}/telegramConnectedAt

Flow test:
1. Login dashboard sebagai user premium/admin.
2. Scroll ke card Telegram Alert.
3. Klik Generate Connect Code.
4. Copy command /connect XAU-xxxxxx.
5. Kirim command ke bot Telegram.
6. Klik Refresh Status di dashboard.
7. Status harus Connected.

Catatan:
- Step ini belum kirim auto alert ke semua premium user.
- Multi-user Telegram alert lanjut Step 3.
- Auto alert utama lama tetap aman.
- MQ5 tidak perlu update.

BotFather command list disarankan:
start - Buka dashboard XAU AI
connect - Hubungkan Telegram premium
disconnect - Putuskan Telegram
me - Cek koneksi Telegram
status - Cek status bot
help - Panduan penggunaan