# Step 10AK — Strategy Control Center

Admin master switch untuk semua sinyal dan alert.

## Konsep

Alert user premium hanya berjalan kalau dua kondisi terpenuhi:

- Admin Master Switch = ON
- User Personal Alert = ON

Kalau salah satu OFF, alert tidak dikirim.

## Control yang ditambahkan

- Main Signal Alert
- Main Signal Result Alert
- M1 Scalp Mode
- M1 Scalp Auto Result
- SMC AI Live Backtest
- SMC AI Admin Alert
- SMC AI Result Admin Alert
- SMC AI Premium User Alert

Default aman: SMC AI Premium User Alert OFF.

## Data path

`/xauusd/settings/strategyControls`

## Catatan

Patch ini tidak mengubah rule Strategy A, M1 Scalp, atau Strategy B. Ini hanya menambahkan master control agar strategi dan alert lebih mudah dikendalikan dari Admin panel.
