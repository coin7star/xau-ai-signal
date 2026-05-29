# XAU Step 8C User Order Status + Chat Admin

Fitur baru:
- Paywall menampilkan status order terakhir user:
  - Paket
  - Harga
  - Status
  - Order ID
- Jika user sudah punya order pending:
  - Tombol Konfirmasi Pembayaran menjadi "Order Pending"
  - Tombol disabled supaya tidak spam order
- Tambah tombol "Chat Admin + Bukti Bayar"
  - Membuka ADMIN_CONTACT_URL
  - Membawa format pesan otomatis:
    Email
    UID
    Paket
    Harga
    Order ID

Tidak disentuh:
- Admin Panel row Manage
- Chart/candle
- MQ5
- Telegram logic
- Source/status ticker

Cara test:
1. Login akun free.
2. Pilih paket.
3. Klik Konfirmasi Pembayaran.
4. Status order muncul di paywall.
5. Klik Chat Admin + Bukti Bayar.
6. Pesan admin harus sudah berisi Email/UID/Paket/Harga/Order ID.

Catatan:
- ADMIN_CONTACT_URL mengikuti konstanta yang sudah ada di App.jsx.
- Kalau ADMIN_CONTACT_URL adalah WhatsApp/Telegram link, text parameter akan ditambahkan otomatis.