# XAU M1 Scalping Mode Full Fix

Update:
- Strategi utama tetap ada:
  RSI + MFI + EMA 9/20 + Fresh OB M15.
- Ditambah mode baru:
  M1 Scalping Mode.
- Scalping tidak menghapus strategi lama.
- Scalping tampil di dashboard sebagai sinyal cepat sambil menunggu CALL utama.

Rule Scalping M1:
- EMA 5 / EMA 13 untuk trigger cepat.
- Break high/low 12 candle M1.
- RSI + MFI sebagai filter momentum.
- Volume spike sebagai bonus score.
- SL pakai ATR + recent swing M1.
- TP pakai RR cepat 1 : 1.25.

Catatan:
- Telegram CALL utama tetap pakai strategi utama.
- Scalping ditampilkan di web dan /signal Telegram sebagai informasi cepat.
- MQ5 tidak perlu update karena candle M1 sudah dikirim.

File berubah:
- functions/api/signal.js
- functions/api/telegram-webhook.js
- src/App.jsx
- src/style.css
- package.json

Cara pakai:
1. Upload replace semua ke GitHub.
2. Commit changes.
3. Tunggu deploy Cloudflare sukses.
4. Refresh web.
5. Cek panel M1 Scalping Mode.
