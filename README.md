# XAU MT5 Stale Blank Screen Hotfix

Masalah:
- Setelah update MT5/VPS stale auto pause, web blank.
- Penyebab: shouldPauseHeavyRefresh dipakai di useEffect sebelum variabel mt5Status dibuat.
- React kena runtime error, layar jadi kosong.

Fix:
- mt5Status dan shouldPauseHeavyRefresh dipindah ke atas sebelum useEffect auto-refresh.
- Duplicate declaration di bagian bawah dihapus.
- Fitur hemat RTDB tetap jalan:
  - MT5 live: refresh normal
  - MT5 stale > 3 menit: heavy refresh pause, lite check 60s

File berubah:
- src/App.jsx
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit.
3. Tunggu Cloudflare deploy.
4. Hard refresh browser / close-open Telegram Mini App.

MQ5:
- Tidak perlu update.