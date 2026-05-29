# XAU Ticker Blank Screen Hotfix

Masalah:
- Setelah update ticker/source card, halaman blank.
- Penyebab: ticker memakai mt5Status.label, tapi di base file aktif mt5Status belum tersedia di render.
- Build tetap bisa lolos, tapi runtime React blank.

Fix:
- Ticker tidak lagi bergantung ke mt5Status.
- Ticker pakai status aman:
  Data Update: Active / Waiting
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

File berubah:
- src/App.jsx
- package.json
- .npmrc

Cara pakai:
1. Upload replace semua ke GitHub.
2. Pastikan package-lock.json tidak ada.
3. Commit.
4. Deploy.
5. Hard refresh browser / close-open Telegram Mini App.

MQ5:
- Tidak perlu update.