# Step 10X — Signal Quality Guard v2

Upgrade ini menambahkan guard kualitas sinyal sebelum CALL dipakai.

## Fungsi
- Cek live feed MT5/VPS masih fresh.
- Cek spread, data candle, ATR/volatilitas, confidence, setup, dan OB M15.
- Menampilkan panel Signal Quality Guard di tab Sinyal.
- Kalau CALL muncul saat guard belum lolos, CALL ditahan menjadi WAIT agar tidak asal entry.

## Catatan
- Sumber harga tetap MT5/VPS live feed.
- Bybit test feed tidak dipakai untuk guard utama.
- Tidak perlu update MQ5.
