# XAU Cloudflare NPM Install Fix

Masalah:
- Cloudflare gagal sebelum build:
  npm error Exit handler never called!
- Error terjadi saat:
  npm clean-install --progress=false
- Ini bug/issue di npm Cloudflare worker, bukan error React/Vite project.

Fix:
- package-lock.json dihapus dari ZIP ini.
- .npmrc ditambah:
  package-lock=false
  progress=false
  audit=false
  fund=false
- Tujuan: Cloudflare pakai npm install biasa, bukan npm clean-install.

Cara pakai:
1. Upload replace semua file ke GitHub.
2. Pastikan package-lock.json lama di GitHub ikut terhapus.
3. Commit.
4. Deploy ulang Cloudflare.
5. Kalau masih stuck, aktifkan Build cache Cloudflare.

Penting:
- Jangan upload node_modules.
- Jangan upload dist.
- MQ5 tidak perlu update.