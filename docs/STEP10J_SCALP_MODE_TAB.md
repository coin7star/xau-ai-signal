# Step 10J Patch 7.3.4 — Scalp Mode Tab

Patch ini memindahkan panel **M1 SR + EMA Scalp** dari tab History ke tab khusus **Scalp Mode**.

## Perubahan

- Navbar dashboard menambah tab **Scalp Mode**.
- Panel scalping M1 tidak lagi tampil di tab History.
- Riwayat SCALP M1 valid juga ditempatkan di tab Scalp Mode agar semua fitur scalping berada di satu area.
- Tab History tetap lebih bersih untuk CALL History, payment history, dan analytics utama.

## File utama

- `src/App.jsx`
- `package.json`
- `README.md`

## Deploy

Gunakan Cloudflare Pages build command:

```txt
npm install && npm run build
```

Output directory:

```txt
dist
```

Jangan gunakan `npm ci` jika repo tidak memakai `package-lock.json`.
