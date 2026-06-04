# Step 10BB — Auto Result Live Price Field Fix

## Masalah
Dashboard bisa menampilkan Harga Live dari MT5/VPS, tetapi tombol Update Hasil / auto result masih bisa menampilkan pesan `Live price belum tersedia`.

Penyebabnya tracker backend hanya membaca beberapa field harga seperti `lastPrice` dan `price`, sementara feed MT5/VPS pada beberapa broker bisa mengirim harga melalui field `lastClose`, `bid`, atau `ask`.

## Fix
- `functions/api/result-tracker.js` dibuat membaca field harga MT5/VPS lebih lengkap:
  - `lastPrice`
  - `price`
  - `lastClose`
  - `close`
  - `bid`
  - `ask`
  - nested `latest`, `ticker`, dan `m1`
  - fallback candle M1 terakhir
- Summary tracker sekarang mengirim `checkedAt` supaya UI waktu cek manual lebih akurat.

## Dampak
Jika harga live sudah melewati SL/TP, auto result bisa langsung menutup sinyal menjadi `LOSS`, `WIN`, atau `BE` tanpa salah membaca harga kosong.

Strategi tidak berubah. Ini hanya fix pembacaan harga untuk auto result.
