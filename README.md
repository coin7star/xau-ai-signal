# XAU Hide Debug Cards for Premium Full Fix

Update:
- Card teknis/debug disembunyikan dari premium user.
- Card yang disembunyikan untuk premium:
  - Bot Command Ready
  - Set Webhook
  - Analisa AI sinkron / Fallback
  - AI API endpoint/debug text
- Card tersebut tetap muncul untuk admin.
- Premium user hanya melihat status clean:
  - Signal Engine Active
  - Premium Mode
  - Debug hidden

Detected patch:
- Bot/Webhook card wrapped: True
- AI/Fallback card wrapped: True

Cloudflare:
- package-lock.json dihapus.
- .npmrc tetap ada supaya Cloudflare tidak maksa npm clean-install.

Cara pakai:
1. Upload replace semua file ke GitHub.
2. Pastikan package-lock.json tidak ada di GitHub.
3. Commit.
4. Deploy Cloudflare.
5. Login sebagai premium: debug card harus hilang.
6. Login sebagai admin: debug card tetap muncul.

MQ5:
- Tidak perlu update.