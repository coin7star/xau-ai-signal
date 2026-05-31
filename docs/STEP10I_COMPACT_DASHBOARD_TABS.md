# Step 10I — Compact Dashboard Tabs

Tujuan step ini adalah mengurangi tampilan dashboard yang terlalu ramai untuk premium user.

## Perubahan utama

Dashboard premium sekarang memakai tab/navbar internal:

- **Sinyal**: signal utama, confidence, reason builder, entry/SL/TP, snapshot RSI/MFI/EMA/OB.
- **Candle**: chart M1 dan M15.
- **History**: performance analytics, call history, scalp history, dan payment history.
- **Telegram**: panel connect Telegram premium.
- **Admin**: hanya muncul untuk admin, berisi admin panel, Bybit test feed, dan AI market analysis.

## Kenapa dibuat begini

Sebelumnya semua card muncul sekaligus sehingga dashboard terlihat semak, terutama di HP. Dengan tab, user premium fokus ke bagian penting dulu.

## Catatan teknis

- Tidak mengubah logic signal.
- Tidak mengubah MQ5.
- Tidak mengubah Firebase rules.
- Tidak mengubah cron Bybit.
- Tidak menambah ENV baru.
- Tetap Cloudflare safe: tidak memakai package-lock.json.
