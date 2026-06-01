# Step 10AQ2 - M5 Plan Preview Line

Patch ini memperbaiki kondisi chart yang belum menampilkan garis entry saat data M5 belum mencapai batas lama.

Perubahan:
- Minimal candle M5 untuk strategi utama diturunkan dari 35 menjadi 20 candle.
- Strategy tetap tidak mengirim sinyal valid kalau struktur M5 belum lengkap.
- Chart M5 sekarang menampilkan garis preview EMA9 meskipun status masih WAIT.
- Garis preview diberi label PREVIEW EMA9.
- Kalau setup sudah READY atau LIMIT, garis berubah menjadi BUY LIMIT / SELL LIMIT EMA9 dan menampilkan TP/SL.
- Native candlesM5 dari MT5/VPS tetap diprioritaskan.

Catatan:
- Preview line bukan sinyal entry.
- Sinyal tetap valid hanya saat struktur M5 + EMA 9/20 + candle menyentuh EMA sudah terpenuhi.
