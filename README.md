# XAU History + Scalp Admin Only Actions Hotfix

Masalah:
- Premium user masih melihat Admin token di CALL History.
- Premium user masih melihat tombol WIN/LOSS/BE/OPEN di SCALP M1 Valid History.

Fix:
- Admin token box hanya render kalau role admin.
- ACTION header hanya render kalau role admin.
- Semua tombol update result CALL dan SCALP hanya render kalau role admin.
- Premium user hanya bisa lihat history/result/winrate.
- SCALP title otomatis:
  - Admin: SCALP M1 Valid History & Manual Result
  - Premium: SCALP M1 Valid Performance
- Tambah viewer note untuk premium user.

Tujuan:
- Premium user bisa lihat performa.
- Hanya admin yang bisa edit result.

File berubah:
- src/App.jsx
- src/style.css
- package.json

MQ5:
- Tidak perlu update.