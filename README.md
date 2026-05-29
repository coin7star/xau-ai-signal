# XAU Step 8H Optional Email Notify on Approve/Reject

Fitur baru:
- Saat admin approve order:
  - premium tetap aktif seperti sebelumnya
  - sistem coba kirim email "Premium Aktif" ke email user
- Saat admin reject order:
  - status reject tetap tersimpan
  - sistem coba kirim email "Pembayaran Belum Dikonfirmasi" ke email user

Penting:
- Email bersifat optional.
- Kalau RESEND_API_KEY / EMAIL_FROM belum siap:
  - approve/reject tetap sukses
  - sistem skip email
  - admin panel menampilkan "Email approval belum aktif."
- Kalau Resend error:
  - approve/reject tetap sukses
  - admin panel menampilkan "Email user tidak terkirim."

ENV email untuk nanti:
- RESEND_API_KEY
- EMAIL_FROM
  Contoh setelah domain verified:
  XAU AI Signal <noreply@domainkamu.com>
- APP_URL

Kenapa dibuat begini:
- User baru belum tentu connect Telegram.
- Email lebih cocok untuk notifikasi approval user baru.
- Tapi karena domain Resend belum siap, sistem harus tetap aman dan tidak memblokir approve/reject.

Tidak disentuh:
- Admin row Manage
- Chart/candle
- MQ5
- Pending Orders pagination
- Payment order anti-spam

Cara test sekarang tanpa domain:
1. Deploy.
2. Approve order.
3. Premium tetap aktif.
4. Admin message harus menyebut email belum aktif/skip.

Cara test nanti setelah domain Resend verified:
1. Set RESEND_API_KEY.
2. Set EMAIL_FROM.
3. Redeploy.
4. Approve order baru.
5. User menerima email premium aktif.