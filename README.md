# XAU Step 8G User Telegram Order Status

Fitur baru:
- Saat admin approve order:
  - premium user otomatis aktif seperti Step 8B
  - user menerima notifikasi Telegram jika sudah connect
- Saat admin reject order:
  - order ditolak seperti Step 8B
  - user menerima notifikasi Telegram jika sudah connect

Pesan approve:
✅ Premium Aktif
Paket
Order ID
Premium aktif sampai tanggal

Pesan reject:
❌ Pembayaran Ditolak
Paket
Order ID
Instruksi hubungi admin

Endpoint yang diubah:
- POST /api/admin-orders

ENV dibutuhkan:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID tetap dipakai untuk admin order notify Step 8D
- User telegramChatId di users/{uid} wajib ada agar user dapat notif

Stabilitas:
- Kalau user belum connect Telegram, approve/reject tetap berhasil.
- Kalau Telegram error, approve/reject tetap berhasil.
- Response admin akan memberi info:
  - Notif Telegram user terkirim
  - User belum connect Telegram
  - Notif Telegram user tidak terkirim

Tidak disentuh:
- Admin row Manage
- Chart/candle
- MQ5
- Payment order pagination Step 8F

Cara test:
1. Pastikan user sudah connect Telegram lewat /connect KODE.
2. User buat order pending.
3. Admin klik Refresh Orders.
4. Admin klik Approve.
5. User harus menerima notif Telegram premium aktif.
6. Coba Reject untuk order lain, user harus menerima notif pembayaran ditolak.

MQ5:
- Tidak perlu update.