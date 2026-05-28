# XAU AI Signal Firebase Full Fix

Versi ini mengganti Cloudflare KV jadi Firebase Realtime Database.

Flow:
MT5 -> Cloudflare Pages Functions -> Firebase RTDB -> Web Dashboard

Cloudflare Pages:
- Framework preset: None
- Build command: npm run build
- Build output directory: dist
- Root directory: kosong

ENV wajib:
- FIREBASE_DATABASE_URL
- MT5_INGEST_TOKEN

Firebase Realtime Database rules demo:
{
  "rules": {
    "xauusd": {
      ".read": true,
      ".write": true
    }
  }
}
