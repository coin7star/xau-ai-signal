# Step 10I Patch - Clean Signal Card

Patch kecil untuk menghapus paragraf reason panjang di bagian atas signal card karena isinya sudah tampil lebih rapi di box AI Reason Builder.

## Perubahan

- Menghapus tampilan `signal.reason` langsung di hero signal card.
- Tetap mempertahankan `AI Reason Builder`.
- Dashboard jadi lebih ringkas dan tidak duplikat.
- Tidak mengubah strategi, API signal, MQ5, cron, Telegram, Firebase rules, atau ENV.

## Deploy

Tetap pakai Cloudflare Pages:

```txt
npm install && npm run build
```

Output directory:

```txt
dist
```

Jangan pakai `npm ci` kalau repo tidak memakai package-lock.json.
