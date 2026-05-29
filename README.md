# XAU Market Monitoring Badge Hotfix

Update:
- Badge/status yang masih tampil "not-call-signal" diganti menjadi "Market Monitoring".
- Menambahkan formatter display status agar status internal lebih rapi:
  - not-call-signal -> Market Monitoring
  - call/call-signal -> CALL Active
- Logic signal tidak diubah.
- Admin Panel tidak disentuh.
- Chart/candle tidak disentuh.
- MQ5 tidak perlu update.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.