# XAU Step 8B Safe Render Fix

Masalah:
- Section Pending Payment Orders muncul.
- Setelah klik Refresh Orders, web blank.
- Penyebab paling mungkin: ada field order dari Firebase yang berupa object dan dirender langsung di JSX.

Fix:
- Tambah safeOrderText().
- Tambah safeOrderDate().
- Tambah normalizeOrderForUi().
- Semua order dari API dinormalisasi jadi string sebelum ditampilkan.
- Jika API error/non-JSON, tidak blank; tampil pesan error.
- Admin Panel row Manage tidak disentuh.
- Chart/candle tidak disentuh.

Cara test:
1. Deploy.
2. Login admin.
3. Admin Panel.
4. Isi Admin Token.
5. Klik Refresh Orders.
6. Order harus tampil atau muncul pesan error, bukan blank.

MQ5:
- Tidak perlu update.