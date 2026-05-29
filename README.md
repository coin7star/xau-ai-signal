# XAU Step 8E Anti-Spam Payment Order

Masalah:
- Tombol Konfirmasi Pembayaran bisa diklik berkali-kali.
- Bisa membuat banyak order pending dan spam notifikasi Telegram admin.

Fix:
- Client guard:
  - Setelah order pending dibuat, tombol berubah jadi "Order Pending".
  - Tombol disabled selama status pending.
  - Jika user klik lagi, muncul pesan bahwa order pending masih ada.

- Database guard:
  - createPaymentOrder membaca users/{uid}.
  - Jika lastPaymentStatus masih pending dan lastPaymentOrderId ada:
    - tidak membuat order baru.
    - tidak kirim notifikasi Telegram baru.
    - mengembalikan order pending lama.

Yang tidak disentuh:
- Admin Panel row Manage
- Chart/candle
- MQ5
- Telegram signal logic
- Admin approve/reject Step 8B

Cara test:
1. Login akun free.
2. Klik Konfirmasi Pembayaran.
3. Order masuk Firebase + Telegram notif admin.
4. Klik lagi.
5. Tidak boleh membuat order baru.
6. Tombol harus menjadi Order Pending.
7. Telegram tidak spam notif baru.

MQ5:
- Tidak perlu update.