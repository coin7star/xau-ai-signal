# XAU Public Landing Loading Blank Hotfix

Masalah:
- Web blank sebelum landing tampil.
- Penyebab: tombol onBack masuk ke authLoading screen, padahal onBack hanya ada di AuthScreen.
- Runtime error membuat layar blank.

Fix:
- onBack button dihapus dari Loading screen.
- Back button hanya ada di halaman Login/Register.
- showAuthScreen state dipastikan ada.
- Landing page tetap tampil untuk visitor sebelum login.
- Build sudah dites.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.