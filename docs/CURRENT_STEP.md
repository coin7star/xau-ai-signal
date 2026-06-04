# Step 10CB — Clear History Trade Controls

## Update
Menambahkan kontrol admin untuk membersihkan history trade langsung dari dashboard tanpa harus hapus manual lewat Firebase RTDB.

## File penting
- `functions/api/history-reset.js`
- `src/App.jsx`
- `src/style.css`
- `package.json`

## Fitur
- Tombol **Clear History Trade** di panel Reset Analisis.
- Menghapus `/xauusd/callHistory` dari RTDB.
- Menyimpan audit kecil di `/xauusd/historyReset`.
- Otomatis reset titik analisis supaya WR, TP1/BE, dan Limit Pullback mulai dari nol.
- Tidak menghapus market feed MT5, candle, Telegram connect, user premium, payment/admin data, atau setting strategi.

## Pengaman
- Wajib admin token.
- Wajib konfirmasi dua tahap.
- Prompt harus mengetik `CLEAR_HISTORY` agar tidak kepencet tidak sengaja.

## Catatan
Gunakan Clear History Trade hanya saat ingin mulai forward test baru dari nol. Kalau hanya ingin reset statistik tanpa hapus riwayat, gunakan **Reset Limit** atau **Reset Semua Analisis**.
