# Step 10AQ - M5 Only Dynamic EMA Limit

Perubahan utama:
- Dashboard hanya menampilkan grafik M5.
- Grafik M15 disembunyikan.
- OB M15 tidak lagi ditampilkan di grafik M5.
- Market API tidak menyimpan/menampilkan candlesM15 agar payload RTDB lebih ringan.
- Strategi utama fokus ke M5 EMA 9/20 + struktur break swing.
- BUY: struktur M5 break swing high, EMA 9/20 naik/searah, entry limit dinamis mengikuti EMA 9, sinyal valid saat candle M5 menyentuh area EMA.
- SELL: struktur M5 break swing low, EMA 9/20 turun/searah, entry limit dinamis mengikuti EMA 9, sinyal valid saat candle M5 menyentuh area EMA.
- Garis Entry / TP / SL tetap tampil di grafik M5.
- Max pending tetap 2 BUY + 2 SELL. Struktur baru membuat pending lama expired.
