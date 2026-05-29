# XAU Step 8D Telegram Admin Order Notify

Fitur baru:
- Saat user klik Konfirmasi Pembayaran dan order pending berhasil dibuat:
  - order tetap disimpan ke Firebase
  - sistem kirim notifikasi Telegram ke admin/chat utama

Endpoint baru:
- POST /api/payment-order-notify

ENV dibutuhkan:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- APP_URL optional, default https://xau-ai-signal.pages.dev

Isi notifikasi:
🧾 New Payment Order
Email
UID
Paket
Harga
Status
Order ID
Instruksi: Buka Admin Panel → Refresh Orders → Approve/Reject

Keamanan/stabilitas:
- Notify Telegram dibuat non-blocking.
- Kalau Telegram env salah/error, order tetap berhasil dibuat.
- Tidak menyentuh Admin Panel row Manage.
- Tidak menyentuh chart/candle.
- Tidak menyentuh MQ5.
- Tidak mengubah Step 8B approve/reject.

Cara test:
1. Pastikan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID ada di Cloudflare ENV.
2. Deploy.
3. Login akun free.
4. Klik Konfirmasi Pembayaran.
5. Cek Telegram admin/chat utama.
6. Cek Firebase paymentOrders tetap masuk.

MQ5:
- Tidak perlu update.