# XAU Step 9B Custom Reset Email via Resend + Firebase Admin

Fitur:
- Forgot password tidak lagi mengirim email default Firebase.
- Web memanggil `/api/custom-reset-email`.
- Cloudflare Function membuat Firebase reset link via Firebase Admin REST.
- Email dikirim via Resend dari `noreply@xauaisignal.online`.
- Link email langsung ke:
  `https://www.xauaisignal.online/auth-action?mode=resetPassword&oobCode=...`
- Halaman `/auth-action` memproses sandi baru di domain resmi XAU AI Signal.

ENV Cloudflare yang dibutuhkan:
- RESEND_API_KEY
- EMAIL_FROM=XAU AI Signal <noreply@xauaisignal.online>
- APP_URL=https://www.xauaisignal.online
- VITE_APP_URL=https://www.xauaisignal.online
- DASHBOARD_URL=https://www.xauaisignal.online
- VITE_FIREBASE_API_KEY=isi lama
- FIREBASE_PROJECT_ID=sultan-trading-data
- FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=isi dari Firebase service account
- FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=isi private key dari Firebase service account

Nama ENV Firebase Admin yang juga didukung:
- FIREBASE_SERVICE_ACCOUNT_JSON
- FIREBASE_SERVICE_ACCOUNT
- FIREBASE_ADMIN_SERVICE_ACCOUNT
- FIREBASE_SERVICE_ACCOUNT_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_ADMIN_CLIENT_EMAIL
- FIREBASE_ADMIN_PRIVATE_KEY

Cara test:
1. Upload ZIP ini ke GitHub.
2. Redeploy Cloudflare Pages.
3. Buka https://www.xauaisignal.online.
4. Klik lupa password.
5. Cek email dari noreply@xauaisignal.online.
6. Link harus langsung ke www.xauaisignal.online/auth-action.
7. Buat password baru.
8. Login ulang.

Catatan:
- Firebase Templates Action URL boleh dibiarkan default kalau Firebase Console error.
- Email spam masih normal untuk domain baru; klik “Laporkan bukan spam”.
- MQ5 tidak perlu update.


# Step 9C Custom Verification Email

- Register akun baru memakai /api/custom-verify-email.
- Email verifikasi dikirim via Resend.
- Link langsung ke https://www.xauaisignal.online/auth-action?mode=verifyEmail&oobCode=...
- Firebase Template Action URL boleh tetap default jika console error.


## Step 10C — Bybit Test Feed Panel

Tambahan aman/read-only:
- Menampilkan panel monitor Bybit XAUUSDT Perpetual dari Firebase path test.
- Membaca `/bybit_test/xauusdt/latest` dan `/bybit_test/xauusdt/status`.
- Refresh otomatis setiap 30 detik.
- Tidak mengubah path utama `/xauusd/*`.
- Tidak mengganti chart utama MT5.
- Tidak mengubah sinyal, Telegram, admin, payment, atau cron PHP.ID.

Pastikan Step 10B cron PHP.ID sudah jalan dan update path:
- `https://xauusd-signal-web-default-rtdb.firebaseio.com/bybit_test/xauusdt/status.json`

Cara test:
1. Upload ZIP ke GitHub.
2. Redeploy Cloudflare Pages.
3. Login sebagai user premium/admin.
4. Cari panel `BYBIT TEST FEED · READ ONLY`.
5. Pastikan status `LIVE`, harga XAUUSDT muncul, dan last update berubah.


## Step 10D
- Admin-only Bybit test feed now includes MT5 vs Bybit comparison.
- Read only: does not change signal, charts, Telegram, or /xauusd/latest.


## Step 10F - Bybit Guard Error Monitor Admin Only

Tambahan:
- Panel Bybit admin sekarang membaca `/bybit_test/xauusdt/error`.
- Menampilkan Guard PASSED/FAILED, error terakhir, spread guard, range harga valid.
- Tetap read-only dan hidden dari user biasa.
- Tidak mengubah path utama `/xauusd/latest`.


## Step 10G - Bybit Rate Limit Safe Cron

Tambahan aman:
- File cron baru: `cron/bybit-xauusdt-safe-cron.php`.
- Cron membaca endpoint resmi Bybit V5 `GET /v5/market/tickers` dan `GET /v5/market/kline`.
- Ada `minRunGap`, `freshDataSeconds`, request gap, dan cooldown otomatis saat Bybit rate-limit/error.
- Jika Bybit error, data `/bybit_test/xauusdt/latest` lama tidak dihapus agar panel admin tidak blank.
- Panel admin Bybit sekarang menampilkan status `RATE LIMIT SAFE · STEP 10G`.
- Tetap read-only: tidak mengubah MT5 utama, signal utama, Telegram utama, atau path `/xauusd/latest`.

Cara pakai cepat:
1. Upload folder project ini ke GitHub.
2. Redeploy Cloudflare Pages untuk update panel admin.
3. Upload `cron/bybit-xauusdt-safe-cron.php` ke PHP.ID / hosting cron.
4. Set `FIREBASE_DATABASE_URL` dan `BYBIT_CRON_SECRET` di hosting cron.
5. Jalankan cron tiap 1 menit ke:
   `https://domain-cron-kamu.com/bybit-xauusdt-safe-cron.php?token=ISI_BYBIT_CRON_SECRET`
6. Login dashboard sebagai admin, lalu cek panel Bybit.

Detail lengkap ada di `docs/STEP10G_BYBIT_SAFE_CRON.md`.

## Step 10H - Human-readable Reason Builder

Tambahan:
- Signal utama sekarang punya `reasonDetails` untuk menjelaskan alasan sinyal secara lebih manusiawi.
- Output `reason` tidak lagi hanya list indikator pendek, tapi dirangkai seperti analisa trader: bias EMA, kondisi RSI, MFI, OB M15, risiko ATR, dan aksi yang ditunggu.
- Dashboard menampilkan box `AI Reason Builder` dengan checklist mudah dibaca pemula.
- Ada `blockers` / `Yang ditunggu` agar user tahu kenapa sinyal masih WAIT atau READY.
- Tidak mengubah rule entry utama: CALL tetap butuh EMA cross + RSI + MFI + OB M15 cocok.
- Tidak mengubah Telegram utama, histori, MT5, Firebase path utama, atau Bybit cron.

Contoh output:
`Belum ada CALL valid. Bias utama masih bearish karena EMA 9 berada di bawah EMA 20. RSI lebih mendukung SELL, tapi filter lain belum lengkap. Aksi: tunggu harga dekat Bearish OB M15.`

Detail lengkap ada di `docs/STEP10H_HUMAN_REASON_BUILDER.md`.


## Cloudflare Pages Deploy Note

Repo ini sengaja tidak memakai `package-lock.json` supaya Cloudflare Pages memakai `npm install`, bukan `npm ci` / clean install. Ini mengikuti setup deploy sebelumnya yang lebih lancar di Cloudflare Pages.

Recommended Cloudflare Pages build command:

```txt
npm install && npm run build
```

Build output directory:

```txt
dist
```


## Step 10I — Compact Dashboard Tabs

Dashboard premium sekarang dibuat lebih rapi dengan tab/navbar: Sinyal, Candle, History, Telegram, dan Admin. Default user premium hanya melihat bagian penting dulu agar tidak semak. Tidak ada package-lock.json dan build Cloudflare tetap pakai `npm install && npm run build`.


## Step 10I Patch - Clean Signal Card

Signal card sekarang lebih bersih. Paragraf reason panjang di bawah confidence dihapus karena sudah terwakili oleh box AI Reason Builder. Patch ini hanya perubahan UI kecil dan tetap aman untuk Cloudflare tanpa package-lock.json.

## Step 10J — Compact Snapshot Accordion

Panel `RSI + MFI + EMA + OB M15` sekarang dirapikan menjadi baris accordion yang bisa dibuka/tutup saat diklik. Ini membuat dashboard premium lebih bersih dan lebih siap kalau nanti ditambah strategi atau indikator baru. Tidak mengubah logic signal utama, MT5, Telegram, Firebase, atau Bybit cron.


## Step 10J Patch — Premium Feed Label

Status bar dashboard dibuat lebih premium dengan label `Market Feed: Premium Live Engine`, `M1 Stream`, `M15 Stream`, `Last Price`, dan `Feed Status`. Tidak ada perubahan logic backend.


## Step 10J Patch 7.3.2 — Premium Telegram Copy

Telegram bot copywriting dibuat lebih premium dan tidak menampilkan istilah teknis backend seperti Firebase, token, atau bahasa internal admin pada pesan user.

Yang diubah:
- `/status` sekarang memakai label `XAU AI Premium Status`.
- `Firebase` diganti menjadi `Live Data Engine`.
- `Telegram token` diganti menjadi `Bot Gateway`.
- `Dashboard` diganti menjadi `Premium Dashboard`.
- `Mode` diganti menjadi `Access Mode`.
- `Auto Alert` diganti menjadi `Main Signal Alert`.
- Pesan pindah fitur dibuat lebih profesional.

Catatan teknis tetap aman: perubahan ini hanya copywriting Telegram, tidak mengubah Firebase, signal logic, MQ5, cron, atau Telegram connection flow.

## Step 10J Patch — Premium Offline Copy

- Mengganti kalimat offline/pause yang terlalu teknis menjadi bahasa premium dan user-friendly.
- Istilah backend seperti Firebase/RTDB/MT5/VPS tidak ditampilkan lagi di area utama user.
- Tidak mengubah logic signal, Telegram, MQ5, Firebase, atau cron.


## Step 10J Patch 7.3.4 — Scalp Mode Tab

Dashboard sekarang memisahkan panel M1 SR + EMA Scalp ke tab khusus **Scalp Mode**.

Tujuan update:
- Tab History tetap fokus ke riwayat CALL dan analytics.
- Setup scalping M1 tidak memenuhi halaman utama.
- Nanti kalau ada strategi scalping baru, indikator tambahan, atau filter M1 baru, semuanya bisa dikembangkan di tab Scalp Mode tanpa membuat dashboard terlihat ramai.

Catatan deploy Cloudflare:
- Tidak memakai `package-lock.json`.
- Build command tetap `npm install && npm run build`.
- Output directory tetap `dist`.

## Step 10J Patch — Premium Alert Status Copy

Badge status alert di header dashboard dibuat lebih premium dan user friendly. Istilah internal seperti `not-call-signal` tidak lagi tampil ke user, diganti menjadi label yang lebih jelas seperti `Menunggu setup valid` atau `Signal Alert Standby`.


## Step 10J Patch 7.3.6 - Snapshot Row Alignment

Panel `RSI + MFI + EMA + OB M15` dirapikan lagi agar judul indikator lebih dekat dengan tombol buka/tutup dan sejajar rapi dengan nilai serta status. Patch ini hanya mengubah tampilan accordion snapshot, tidak mengubah logic signal, MT5, Telegram, Firebase, Bybit cron, atau aturan premium.

Cloudflare safe: tidak memakai `package-lock.json`, tidak menyertakan `node_modules`, dan build tetap `npm install && npm run build`.

## Step 10K — Chart Tab Stability Fix

Patch ini memperbaiki chart Candle yang kadang kosong setelah pindah tab atau reload. Chart M1/M15 sekarang otomatis dibuat ulang saat tab Candle dibuka, lalu data candle, EMA, OB, support, dan resistance disinkronkan ulang.

## Step 10L — Weekend / Market Closed Friendly Mode

Dashboard sekarang membedakan kondisi market tutup/weekend dengan koneksi live yang benar-benar terputus. Saat XAU/forex sedang jeda, UI menampilkan status **Market Session Paused**, tetap menampilkan candle terakhir yang tersimpan, dan memberi pesan yang lebih profesional untuk user premium.


## Step 10M - Mobile Header Polish
- Header dashboard premium di HP dibuat lebih rapi.
- Badge status disusun lebih nyaman dibaca di layar kecil.
- Label role dan akses dibuat lebih user friendly.


## Step 10M Patch 2 - Desktop Header Balance
- Header dashboard PC dirapikan lagi setelah mobile polish.
- HP tetap memakai layout grid rapi.
- Desktop lebar kembali satu baris, desktop sedang aman dua baris.


## Step 10N - Emergency Rollback Stable
- Rollback ke versi stabil sebelum Admin Accordion karena patch accordion menyebabkan blank screen.
- Dashboard utama diprioritaskan hidup dulu.
- Admin Accordion akan dibuat ulang setelah error Console dicek.


## Step 10N - Admin Windows Lite
- Tab Admin dibuat lebih ringkas dengan panel buka/tutup.
- Menggunakan native details/summary agar lebih aman dari crash React.
- Panel lama tetap dipakai, hanya dibungkus seperti jendela.


## Step 10O - Telegram Connect Guard
- Panel Telegram Connect dibuat lebih aman.
- User yang sudah connected tidak bisa generate connect code baru sebelum disconnect.
- Copy command dikunci saat Telegram sudah terhubung.


## Step 10P - Telegram Connect UX Polish
- Panel Telegram Connect dibuat lebih ringkas saat status sudah aktif.
- Security note dan tutorial hanya tampil saat belum connected.
- Flow tombol Telegram dibuat sesuai status koneksi.


## Step 10Q - Telegram Alert Premium Format
- Format MAIN CALL Telegram dibuat lebih premium.
- Alert READY dan CALL dibedakan.
- Pesan Telegram menampilkan trade plan, market reason, setup snapshot, dan tombol dashboard.
- Tidak mengubah logic signal utama.


## Step 10Q1 - Secure Telegram Test Endpoint
- `/api/telegram-test` tidak lagi public GET.
- Test alert sekarang dilindungi admin token/secret, method POST, dan cooldown anti-spam.
- Tombol test alert tersedia di tab Admin.


## Step 10R Lite - Result Tracker UI Prep
- Menambahkan panel Result Tracker Lite di tab History.
- Menyiapkan status RUNNING / WIN / LOSS / BE / EXPIRED untuk auto result engine berikutnya.
- OPEN ditampilkan sebagai RUNNING agar lebih user friendly.
- Tidak mengubah MQ5, Telegram alert, Firebase rules, atau Bybit cron.


## Step 10S - Auto Result Engine
- Menambahkan endpoint `/api/result-tracker` untuk cek TP/SL/expired pada signal RUNNING.
- Admin bisa menjalankan pengecekan dari tab History.
- Belum mengirim result otomatis ke Telegram; disiapkan untuk step berikutnya.


## Step 10T - Telegram Result Alert
- Auto Result Engine mengirim alert Telegram saat signal menjadi WIN / LOSS / EXPIRED.
- Result alert memakai format premium dan tombol dashboard.
- Anti duplicate menggunakan `resultAlertSent`.


## Step 10T1 - Telegram Result Alert Test
- Menambah endpoint aman `/api/result-alert-test` khusus POST + admin token.
- Menambah tombol Test WIN / LOSS / EXPIRED di Admin panel.
- Test result alert hanya mengirim pesan Telegram dan tidak mengubah history asli.
- Menyiapkan cooldown opsional `RESULT_ALERT_TEST_COOLDOWN_SEC`.


## Step 10U - Auto Result Cron Runner
- Menambahkan endpoint `/api/result-tracker-cron` untuk menjalankan Auto Result Engine otomatis lewat cron.
- Menambahkan `cron/result-tracker-cron-runner.php` untuk PHP.ID cron.
- Auto result memakai live feed utama MT5/VPS dari `/xauusd/latest`, bukan Bybit test feed.
- Cron dilindungi `RESULT_TRACKER_CRON_SECRET`, cooldown, dan fresh-feed guard.


## Step 10U1 - Cron Security Hardening
- Auto Result Cron endpoint sekarang POST-only.
- PHP cron runner memakai runner token dan mengirim secret lewat header, bukan query URL Cloudflare.
- Result tetap memakai data MT5/VPS live feed only, bukan Bybit.


## Step 10V - Cron Health Monitor
- Menambahkan panel Auto Result Cron Monitor di dashboard History.
- Dashboard bisa melihat last run, feed age, scanned, updated, dan Telegram sent.
- Source result tetap MT5/VPS Live Feed, bukan Bybit.


## Step 10W - Performance Analytics Upgrade
- Performance Analytics 7/30 hari di-upgrade.
- Tambah EXPIRED, Clean WR, Total WR, dan Best Snapshot yang lebih informatif.
- Analytics mengikuti result dari Auto Result Engine / Auto Result Cron.


## Step 10X - Signal Quality Guard v2
- Menambahkan panel market safety check di tab Sinyal.
- Guard mengecek feed MT5/VPS, spread, data candle, volatilitas, confidence, setup, dan OB M15.
- CALL bisa ditahan menjadi WAIT jika kualitas market belum aman.


## Step 10Y - Telegram Multi-user Alert Prep
- Menyiapkan preferensi Telegram alert per user.
- Tambah toggle Main Signal Alert dan Result Alert di panel Telegram.
- Tambah admin stat Alert ON untuk persiapan multi-user premium alert.


## Step 10Y1 - Broadcast Panel Polish
- Panel Broadcast Telegram manual dibuat lebih premium dan jelas.
- Tambah estimated receiver, preview pesan, counter karakter, dan cooldown anti-spam.
- Manual Broadcast tetap berbeda dari Auto Signal Alert.


## Step 10Z - Auto Signal Multi-user Dry Run
- Menambahkan simulasi penerima auto signal multi-user.
- Admin bisa melihat eligible receiver dan skipped user tanpa mengirim Telegram.
- Persiapan aman sebelum multi-user Telegram alert live.


## Step 10Z1 - Telegram Alert Auto-ON Info
- User yang berhasil connect Telegram otomatis mendapatkan Main Signal Alert ON dan Result Alert ON.
- User bisa mematikan alert sendiri dari Telegram panel.
- UI Telegram panel memberi info jelas bahwa OFF berarti tidak menerima sinyal/result alert.


## Step 10Z2 - Telegram Premium User Copy
- Copywriting panel Telegram untuk user premium dibuat lebih bersih.
- Istilah `admin` di area user-facing diganti menjadi pengumuman resmi XAU AI.


## Step 10AA - Strategy B SMC AI Engine Prep
- Menambahkan Strategy B bernama SMC AI sebagai live-backtest paralel.
- Strategy A tetap tidak diubah.
- Flow SMC AI: Fresh OB M15 → Sweep M1 → CHOCH M1 → EMA 9/20 M1.
- RSI dan MFI menjadi confidence booster, bukan syarat wajib.
- Dashboard mendapat tab baru SMC AI.


## Step 10AB - Strategy B SMC AI History & Live Backtest
- Strategy B `SMC AI` sekarang punya history live-backtest terpisah di `/xauusd/strategyB/history`.
- Hanya CALL BUY/SELL valid dari alur OB → Sweep → CHOCH → EMA yang disimpan.
- Strategy A tidak diubah dan statistiknya tetap terpisah.
- Ditambahkan anti duplicate 15 menit untuk mencegah SMC AI menyimpan signal yang sama berulang.
- Dashboard tab SMC AI menampilkan history, WR, average RR, average TP/SL, dan profit factor sederhana.


## Step 10AC - Strategy B Auto Result Tracker
- Auto Result Engine sekarang ikut memantau history SMC AI di `/xauusd/strategyB/history`.
- Result SMC AI otomatis berubah dari OPEN/RUNNING menjadi WIN, LOSS, atau EXPIRED memakai live feed utama MT5/VPS.
- Bybit test feed tetap tidak dipakai untuk result.
- Strategy B tetap live-backtest only dan belum mengirim Telegram result alert live.
- Strategy A, CALL History utama, dan SCALP History tetap terpisah.


## Step 10AD - Strategy B Stats 7/30 Days
- Menambahkan analytics 7D/30D khusus SMC AI / Strategy B.
- Menambahkan Clean WR, Total WR, Average RR, Average TP/SL, Profit Factor, dan Best Snapshot.
- Strategy A tetap terpisah dan tidak diubah.


## Step 10AE - Strategy Compare A vs B
- Tambah panel Strategy Lab untuk membandingkan Strategy A dan Strategy B SMC AI.
- Membandingkan 7D/30D Clean WR, total signal, average RR, expired rate, dan profit factor.
- Memberi insight ringan tanpa mengubah logic Strategy A maupun Strategy B.


## Step 10AE1 - Separate M1 Scalp from Strategy A
- Panel Strategy Lab sekarang membandingkan Main Signal Only vs SMC AI.
- M1 Scalp dipisahkan dari Strategy A dan tetap punya tab/statistik sendiri.


## Step 10AE2 - Move Strategy Lab to History Panel
- Panel Compare Strategy A vs Strategy B dipindah ke tab History.
- Tab SMC AI dibuat lebih fokus ke live setup Strategy B.
- Logic signal tidak diubah.


## Step 10AF - SMC AI Telegram Alert Test Mode
- Menambahkan panel Admin untuk test format Telegram Strategy B / SMC AI.
- Test BUY dan SELL dikirim hanya ke global/admin Telegram chat.
- Tidak mengubah history SMC AI dan belum dikirim ke user premium.


## Step 10AG - SMC AI Auto Admin Alert
- Strategy B / SMC AI sekarang bisa mengirim alert otomatis ke Telegram admin/global saat CALL asli muncul.
- Alert masih mode admin monitoring only dan belum dikirim ke user premium.
- Strategy A tetap tidak diubah.


## Step 10AH - SMC AI Result Alert Test Mode
- Menambahkan endpoint dan tombol admin untuk test result WIN/LOSS/EXPIRED khusus Strategy B / SMC AI.
- Test ini hanya ke Telegram admin/global dan tidak mengubah history asli.


## Step 10AI - SMC AI Auto Result Admin Alert
- Auto Result Engine sekarang mengirim WIN/LOSS/EXPIRED SMC AI ke Telegram admin/global.
- Strategy B tetap live-backtest only dan belum dikirim ke user premium.
- Result tetap memakai MT5/VPS live feed, bukan Bybit.


## Step 10AJ - Strategy Lab 3-Way Compare
- Strategy Lab sekarang membandingkan Main Signal, M1 Scalp, dan SMC AI secara terpisah.
- M1 Scalp tetap tidak dihitung sebagai Strategy A.
- Patch ini hanya UI/analytics compare dan aman untuk rollback.


## Step 10AK - Strategy Control Center
- Tambah Admin master switch untuk Main Signal, M1 Scalp, dan SMC AI.
- User premium tetap mengikuti personal toggle masing-masing.
- SMC AI Premium User Alert default OFF agar tetap aman sebelum live multi-user.


## Step 10AL - SMC AI Multi-user Premium Alert Live
- SMC AI CALL asli bisa dikirim ke user premium jika master switch admin ON.
- Tetap memakai user personal alert preference dan anti duplicate delivery.
- Strategy A dan M1 Scalp tidak diubah.


## Step 10AM - Premium User Friendly Copy
- Bahasa di area user premium dibuat lebih ramah dan tidak terlalu teknis.
- Landing page/paywall memakai istilah support/tim XAU AI untuk user.
- Istilah internal tetap dipertahankan di Admin panel bila diperlukan.
- Tidak mengubah logic sinyal, cron, Telegram, atau strategi.


## Step 10AM1 - Remove EMA 5/13 Scalp Card
- Menghapus card EMA 5/13 dari tampilan Scalp Mode agar tidak membingungkan.
- Scalp tetap mengikuti filter/rule EMA 9/20 yang sudah dipakai.
