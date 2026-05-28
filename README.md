# XAU Admin Panel + Logout Step 1 Full Fix

Update:
- Web dashboard sekarang punya menu Logout yang jelas di navbar.
- Jika akun role admin, muncul tombol Admin di navbar.
- Admin Panel bisa:
  - Load semua user
  - Search user by email / UID / role
  - Set Premium 7 hari
  - Set Premium 30 hari
  - Set Free
  - Set Admin

Syarat:
- Akun kamu harus role: "admin"
- Cloudflare ENV wajib ada:
  ADMIN_ACTION_TOKEN=token_admin_kamu
  FIREBASE_DATABASE_URL=database_url_kamu

Cara pakai Admin Panel:
1. Login pakai akun admin.
2. Klik tombol Admin di navbar.
3. Isi ADMIN_ACTION_TOKEN.
4. Klik Refresh Users.
5. Klik Premium 7D / Premium 30D / Free / Admin pada user.

Catatan:
- MQ5 tidak perlu update.
- Telegram auto alert MAIN CALL tetap aman.
- Step ini cuma merapikan pengelolaan premium user.