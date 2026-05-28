# XAU Support Resistance Touch-2 Full Fix

Update baru:
1. M1 scalping tetap pakai rules lama sebagai legacy (tidak dihapus).
2. Rules scalping aktif sekarang lebih ketat:
   - BUY hanya saat harga dekat support struktur M1
   - Harus muncul bullish engulfing
   - Support yang dipakai maksimal 2 kali sentuhan
   - SL di bawah support + ATR sedikit
   - TP RR 1 : 1.25

   - SELL hanya saat harga dekat resistance struktur M1
   - Harus muncul bearish engulfing
   - Resistance yang dipakai maksimal 2 kali sentuhan
   - SL di atas resistance + ATR sedikit
   - TP RR 1 : 1.25

3. Di chart M1 sekarang ditambah garis:
   - M1 Support
   - M1 Resistance

4. Fresh OB M15 tetap tampil seperti sebelumnya.

MQ5:
- Tidak perlu update.
- Karena update ini hanya ubah backend signal + tampilan web.
- MQ5 tetap kirim candle seperti biasa.

File berubah:
- src/App.jsx
- src/style.css
- functions/api/signal.js
- functions/api/telegram-webhook.js
- package.json

Cara pakai:
1. Upload replace semua isi zip ke repo GitHub.
2. Commit changes.
3. Tunggu deploy Cloudflare selesai.
4. Refresh website.
5. Test /api/signal dan Telegram /signal.