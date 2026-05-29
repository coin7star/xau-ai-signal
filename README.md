# XAU Chart Candle Restore Hotfix

Masalah:
- Setelah clean rollback sebelum Step 7, Admin Panel normal, tapi tampilan candle/grafik hilang.
- Penyebab kemungkinan baseline rollback mengambil versi sebelum fix grafik candle.

Fix:
- Restore file chart/dashboard dari baseline yang lebih baru dan sebelumnya chart sudah work.
- Tidak menambah Step 7.
- Tidak menambah Login Activity.
- Tidak mengubah Admin Panel sensitif.
- Email tetap Firebase default.
- Tambah CSS guard agar container chart punya tinggi minimal.

Source chart baseline:
xau-forgot-password-visible-stable-fix.zip

Target recovery baseline:
xau-clean-rollback-before-step7-admin-fix.zip

Yang dipertahankan:
- Landing page
- Login/Register
- Forgot password Firebase default
- Paywall pilih paket
- Manual payment
- Admin Panel stable
- Telegram connect
- Multi-user alert
- Performance Analytics
- Candle chart/dashboard dari versi yang lebih baru

MQ5:
- Tidak perlu update.