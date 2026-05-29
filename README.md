# XAU Paywall Package Selection Safe Hotfix

Masalah:
- Patch sebelumnya bikin blank di akun FREE/paywall.
- Penyebab:
  PaywallScreen memakai authUser/authProfile yang tidak ada di scope function.
  Yang benar adalah props user/profile.

Fix:
- Dibuat ulang dari versi stable:
  xau-manual-payment-no-duplicate-polish.zip
- Paywall punya pilihan paket:
  - 7 Day = Rp10K
  - 30 Day = Rp30K
- Tidak pakai authUser/authProfile.
- Pakai user/profile props yang valid.
- Tombol:
  - Hubungi Admin
  - Copy Info Aktivasi
  - Logout
- Teks endpoint internal tidak muncul.
- Build sudah dites.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.