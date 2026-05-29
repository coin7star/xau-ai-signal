# XAU Step 8K Admin Order Note

Fitur baru:
- Admin bisa menambahkan catatan internal pada setiap payment order.
- Catatan tersimpan di:
  paymentOrders/{orderId}/adminNote
  paymentOrders/{orderId}/adminNoteUpdatedAt
- Tombol Save Note ada di setiap order row.
- Maksimal catatan 500 karakter.

Endpoint:
- POST /api/admin-orders
  action: saveNote
  orderId
  adminNote

Kegunaan:
- Catatan bukti transfer.
- Nama pengirim.
- Metode pembayaran.
- Alasan reject.
- Audit manual payment.

Tidak disentuh:
- Admin row Manage user.
- Chart/candle.
- MQ5.
- Approve/reject logic tetap sama.
- Order filter/pagination tetap sama.
- Payment history user tetap sama.

Cara test:
1. Login admin.
2. Buka Admin Panel.
3. Isi Admin Token.
4. Refresh Orders.
5. Isi Catatan Admin di salah satu order.
6. Klik Save Note.
7. Cek Firebase:
   paymentOrders/{orderId}/adminNote

MQ5:
- Tidak perlu update.