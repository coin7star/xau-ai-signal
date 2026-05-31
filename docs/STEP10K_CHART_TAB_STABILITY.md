# Step 10K — Chart Tab Stability Fix

Patch ini memperbaiki chart Candle yang kadang kosong setelah pindah tab atau reload dashboard.

## Penyebab

Chart candlestick memakai canvas internal dari lightweight-charts. Saat tab Candle ditutup, elemen DOM chart ikut hilang. Sebelumnya instance chart lama masih tersimpan di memory, sehingga saat tab Candle dibuka lagi aplikasi mengira chart sudah siap padahal container baru masih kosong.

## Fix

- Reset chart instance saat tab Candle dibuka ulang.
- Disconnect ResizeObserver lama agar tidak nyangkut ke container lama.
- Buat ulang chart M1 dan M15 setelah container benar-benar tampil.
- Sync ulang candle, EMA, OB, support, dan resistance setelah chart dibuat ulang.
- Tombol Refresh Manual juga memaksa chart rebuild agar recovery lebih cepat.

## Catatan deploy

Aman untuk Cloudflare Pages:

- Tidak ada package-lock.json.
- Tidak ada node_modules di ZIP.
- Tidak ada dist di ZIP.
- Build command tetap `npm install && npm run build`.
