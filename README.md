# XAU Step 7 Anti-sharing Security LV1

Step 7 fitur:
- Anti-sharing premium Level 1.
- 1 akun premium/admin dikunci ke 1 device/browser utama.
- Device ID dibuat di localStorage.
- Device ID disimpan ke Firebase RTDB users/{uid}/deviceId.
- Jika akun premium login dari device/browser lain, tampil Device Blocked Screen.
- User diarahkan hubungi admin.
- Dashboard premium menampilkan Security Premium notice.
- Admin panel menampilkan:
  - lastLoginAt
  - deviceName
  - securityStatus
- Admin panel punya tombol Reset Device.
- Reset Device menghapus deviceId sehingga user bisa claim device baru.

Cara kerja:
1. Premium/admin pertama kali login:
   deviceId tersimpan sebagai device utama.
2. Login dari browser/device yang sama:
   allowed.
3. Login dari browser/device lain:
   blocked.
4. Admin klik Reset Device:
   deviceId dihapus.
5. User login ulang dari device baru:
   device baru menjadi device utama.

Catatan:
- Ini Level 1, bukan anti-sharing mutlak.
- Kalau user clear browser localStorage, deviceId berubah dan bisa kena block.
- Admin bisa reset device jika user memang ganti HP/browser.
- Untuk Level 2 nanti bisa tambah Telegram approval.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.