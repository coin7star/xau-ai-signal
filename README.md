# XAU Force Hide Source Card + Ticker Fix

Masalah:
- Data Source card besar masih muncul di akun premium.
- Penyebab: class card aktif tidak kena selector hide sebelumnya.

Fix:
- Ticker compact dipasang tepat setelah navbar/header.
- Section lama yang berisi:
  Data source / Firebase RTDB / M1 Candle / M15 Candle
  dibungkus khusus admin:
  isAdmin && (...)
- Jadi premium user tidak melihat card besar.
- Admin masih bisa melihat card lama kalau perlu debug.
- CSS safety tetap hide class lama sourceGrid/dataSourceGrid jika ada.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

Cara pakai:
1. Upload replace semua ke GitHub.
2. Pastikan package-lock.json tidak ada.
3. Commit.
4. Deploy.
5. Hard refresh browser / close-open Telegram Mini App.

MQ5:
- Tidak perlu update.