# XAU M1 Last Swing Structure Full Fix

Update rules scalping:
- Rules scalping lama tetap disimpan sebagai legacy.
- Rules scalping aktif diganti:
  - Support = last swing low M1 di struktur terakhir.
  - Resistance = last swing high M1 di struktur terakhir.
  - BUY valid kalau harga dekat last swing low M1 + bullish engulfing.
  - SELL valid kalau harga dekat last swing high M1 + bearish engulfing.
  - SL BUY di bawah support + ATR sedikit.
  - SL SELL di atas resistance + ATR sedikit.
  - TP tetap RR 1 : 1.25.

Yang dihapus dari active rule:
- Filter maksimal 2x sentuhan.
- Cluster support/resistance.

Chart:
- Garis M1 Support tetap tampil, sekarang dari last swing low M1.
- Garis M1 Resistance tetap tampil, sekarang dari last swing high M1.

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/signal.js
- functions/api/telegram-webhook.js
- src/App.jsx
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Refresh web.
5. Cek /api/signal dan Telegram /signal.