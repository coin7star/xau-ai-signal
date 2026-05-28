# XAU Scalp No Legacy Clean Full Fix

Update:
- Legacy Scalp Backup sudah dihapus.
- Active scalp sekarang cuma 1 rules:
  SR + Engulfing + EMA 9/20 Filter.

Rules aktif SCALP M1:

BUY valid kalau:
1. EMA 9 > EMA 20
2. Harga dekat support M1 / last swing low
3. Ada bullish engulfing
4. Score minimal 70/100
5. SL = low candle touch support - 1.5 ATR
6. TP = RR 1 : 1.25

SELL valid kalau:
1. EMA 9 < EMA 20
2. Harga dekat resistance M1 / last swing high
3. Ada bearish engulfing
4. Score minimal 70/100
5. SL = high candle touch resistance + 1.5 ATR
6. TP = RR 1 : 1.25

Yang tetap:
- Main CALL strategy
- Fresh OB M15
- Scalp valid history
- Firebase bandwidth saver
- Telegram /signal
- Telegram /scalp_history
- Win/Loss manual

MQ5:
- Tidak perlu update.

File berubah:
- functions/api/signal.js
- functions/api/telegram-webhook.js
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Refresh web.
5. Test /api/signal dan Telegram /signal.