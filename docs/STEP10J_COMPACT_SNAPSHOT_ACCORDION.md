# Step 10J - Compact Snapshot Accordion

Update ini merapikan panel `RSI + MFI + EMA + OB M15` agar tidak lagi berupa card-card besar.

## Yang berubah

- Snapshot indikator dibuat menjadi baris accordion.
- Setiap baris bisa diklik untuk buka/tutup detail.
- Default hanya baris penting awal yang terbuka.
- Layout lebih siap untuk tambahan strategi/indikator baru.
- Tidak mengubah logic signal, MQ5, Firebase, Telegram, atau Bybit cron.

## Kenapa dibuat begini

Dashboard akan lebih rapi saat nanti ditambah indikator baru. User premium bisa melihat ringkasan dulu, lalu membuka detail indikator yang ingin dicek.

## Cloudflare

Tetap aman untuk Cloudflare Pages:

```txt
npm install && npm run build
```

Tidak memakai `package-lock.json`.
