# XAU Premium CALL History + Probability Full Fix

Fitur baru:
- History CALL otomatis tersimpan ke Firebase saat signal CALL BUY/SELL valid.
- Win/Loss manual dari web:
  - WIN
  - LOSS
  - BE
  - OPEN
- Statistik performa:
  - Total CALL
  - Open
  - Closed
  - Win
  - Loss
  - BE
  - Win Rate
- Probability Score:
  - tampil di UI Confirmation Snapshot
  - tersimpan di CALL history
  - ikut tampil di endpoint /api/signal
- Telegram command /history:
  - tampilkan 5 CALL terakhir dan statistik singkat

Endpoint baru:
- GET /api/call-history
- POST /api/call-history

ENV baru:
- ADMIN_ACTION_TOKEN=buat_token_admin_bebas

Cara pakai:
1. Upload replace semua file ke GitHub.
2. Tambah ENV Cloudflare:
   ADMIN_ACTION_TOKEN=token_bebas_kamu
3. Deploy.
4. Di web, isi Admin token yang sama.
5. Saat CALL BUY/SELL muncul, history otomatis masuk.
6. Klik WIN / LOSS / BE manual setelah tahu hasil trade.
7. Telegram bisa test:
   /history

Catatan:
- MQ5 tidak perlu update.
- Untuk jual/premium nanti, ini sudah jadi dasar tracking performa.
