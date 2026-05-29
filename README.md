# XAU Step 8L Private Admin Note Security

Tujuan:
- Catatan admin jangan lagi disimpan langsung di paymentOrders/{orderId}.
- Catatan admin dipindah ke path khusus admin:
  adminOrderNotes/{orderId}

Perubahan:
1. Save Note sekarang menyimpan ke:
   adminOrderNotes/{orderId}
   - orderId
   - uid
   - email
   - adminNote
   - adminNoteUpdatedAt
   - updatedAt

2. GET /api/admin-orders:
   - tetap membaca paymentOrders
   - membaca adminOrderNotes
   - merge adminNote hanya untuk response admin panel

3. Cleanup best-effort:
   - Saat Save Note, sistem mencoba menghapus adminNote lama dari paymentOrders:
     adminNote: null
     adminNoteUpdatedAt: null

4. User Payment History:
   - getUserPaymentOrders defensif membuang adminNote/adminNoteUpdatedAt jika ada data lama.

Manfaat:
- User UI tetap tidak melihat catatan admin.
- Payment history user tidak membawa adminNote.
- Admin panel tetap bisa melihat dan edit catatan.
- Catatan admin lebih terpisah dari data order user.

Catatan penting:
- Keamanan penuh tetap membutuhkan Firebase Rules yang benar.
- Disarankan rules:
  - user hanya read order milik uid sendiri dari paymentOrders
  - user tidak bisa read adminOrderNotes
  - adminOrderNotes hanya diakses via Cloudflare API admin

Tidak disentuh:
- Admin row Manage user
- Chart/candle
- MQ5
- Approve/reject
- Telegram/email notify

Cara test:
1. Deploy.
2. Login admin.
3. Refresh Orders.
4. Isi catatan admin.
5. Klik Save Note.
6. Cek Firebase:
   adminOrderNotes/{orderId}/adminNote ada.
7. Cek paymentOrders/{orderId}/adminNote harus null/hilang setelah save note.
8. Login user, Payment History tidak menampilkan note admin.

MQ5:
- Tidak perlu update.