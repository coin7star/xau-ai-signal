# Step 10AM4 — Persistent OB M15 Rules

Patch ini mengubah perilaku tampilan dan validasi OB M15.

## Perubahan

- OB M15 tidak hilang hanya karena sekali disentuh harga.
- OB tetap dianggap valid/terlihat selama belum invalid.
- OB baru yang lebih relevan tetap bisa menggantikan OB lama.
- OB baru hilang jika harga menutup jauh melewati zona OB menggunakan buffer ATR/ukuran zona.
- Chart M1/M15 tetap bisa menampilkan area OB yang sudah pernah disentuh tetapi belum dibreak.

## Catatan

Patch ini tidak mengubah Strategy A, M1 Scalp, SMC AI Telegram, cron, atau auto result.
