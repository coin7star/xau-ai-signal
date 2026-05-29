# XAU Public Landing Page Blank Hotfix

Masalah:
- Landing page baru blank di runtime.
- Penyebab paling mungkin: icon/component di landing belum tersedia di runtime.

Fix:
- Landing page diganti versi aman tanpa icon dependency baru.
- Tetap punya:
  - Hero profesional
  - Fitur premium
  - Cara kerja
  - Paket beta
  - FAQ
  - Risk disclaimer
  - Login/Register
- Build sudah dites.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.