# Step 10BI - History Scroll Wrapper Fix

Fix panel Riwayat Sinyal & Update Manual yang masih memanjang ke bawah karena class scroll belum ditempel pada wrapper tabel utama.

## Update
- Wrapper history utama sekarang memakai `historyTable mainHistoryScrollTable`.
- List history dipaksa memakai `overflow-y: scroll`.
- Tinggi desktop dibuat 560px dan mobile 430px.
- Header kolom tetap sticky saat list discroll.
- Semua history tetap tampil, hanya area list yang scroll agar halaman tidak terlalu panjang.

## Tidak berubah
- Strategi M1 EMA Cross Direct Entry tidak berubah.
- Auto result, Telegram, TP1 BE, dan cron tidak berubah.
