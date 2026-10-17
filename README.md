# 🍵 Matcha Cih

Web mobile untuk meracik matcha custom di booth kampus. Dibangun dengan **HTML, CSS, JavaScript, dan PHP** (tanpa database — pakai penyimpanan file JSON, jalan langsung di XAMPP).

## Fitur Utama

- **Interactive Dynamic Cup** — ilustrasi gelas yang warnanya berubah (Light → Bold) dan menampilkan lapisan foam/jelly secara real-time.
- **Taste Profile & Sweetness Calculator** — meter Umami/Pahit & Creamy (bintang) + estimasi kalori yang otomatis turun saat pilih Oat Milk / Stevia.
- **Preset "Matcha Hack"** — shortcut komunitas: Anak Diet, Sweet Tooth, Pure Umami Slayer.
- **Resep bisa di-share (#MatchaID)** — beri nama racikan, dapat link unik untuk dibagikan ke WhatsApp.
- **Keranjang + QRIS** — ringkasan pesanan, form cepat (nama + WhatsApp), pembayaran QRIS.
- **Tiket Digital & Live Tracker** — kode tiket (#M-028) + status bergerak: Diterima → Di-whisk → Siap Diambil.

## Struktur

```
Venture/
├── index.php          # Layar 1: Beranda & pemilih mode
├── lab.php            # Layar 2: Customization Lab (inti)
├── cart.php           # Layar 3: Keranjang & pembayaran QRIS
├── order.php          # Layar 4: Tiket & pelacak pesanan
├── partials/head.php  # <head> bersama
├── assets/
│   ├── css/style.css  # Design system (forest/matcha green + cream)
│   └── js/
│       ├── data.js    # Config menu, harga, kalori, presets, helper
│       └── lab.js     # Controller Customization Lab
├── api/
│   ├── db.php         # Penyimpanan JSON + file locking
│   ├── order.php      # create / status / advance pesanan
│   └── recipe.php     # share / get / popular resep
└── data/              # Dibuat otomatis: orders/recipes/shares/counters .json
```

## Cara Menjalankan

**Via XAMPP:** taruh folder di `htdocs`, start Apache, buka `http://localhost/Venture/`.

**Via PHP built-in server:**
```powershell
& "C:\xampp\php\php.exe" -S 127.0.0.1:8000
```
lalu buka `http://127.0.0.1:8000/`.

## Catatan

- Folder `data/` harus punya izin tulis (otomatis dibuat saat pertama diakses).
- Tombol "Simulasikan Progres Booth" di layar tiket memajukan status pesanan (mensimulasikan sisi barista). Halaman juga auto-refresh tiap 5 detik.
- Nomor tiket mulai dari #M-028.

## Login & Admin

- Login bersifat **opsional** — pengguna bisa memesan tanpa akun (klik "Skip").
- Halaman admin: `admin.php` (lihat semua pesanan & lanjutkan status).
- Akun admin default: **admin** / **admin123**.

### Membuat / mengubah akun lewat phpMyAdmin (mode plain text — tahap awal)

Untuk saat ini password boleh disimpan sebagai teks biasa langsung dari SQL:

```sql
-- Tambah admin baru
INSERT INTO users (username, pass_hash, role) VALUES ('booth1', 'rahasia123', 'admin');

-- Ubah password admin yang ada
UPDATE users SET pass_hash = 'passwordbaru' WHERE username = 'admin';
```

Sistem login otomatis mendeteksi: bila nilai `pass_hash` berupa hash bcrypt
(diawali `$2y$`), dipakai `password_verify`; bila teks biasa, dibandingkan langsung.
Jadi akun plain text dan akun ter-hash sama-sama bisa login.

> ⚠️ **Keamanan Password:** Menyimpan password sebagai teks biasa TIDAK aman
> untuk produksi. Saat bisnis sudah berjalan, minta ubah kembali ke hash penuh
> (nonaktifkan pembandingan plain text di `api/auth.php` fungsi `verify_password`,
> dan hash ulang semua password lama).

### Membuat hash bcrypt (untuk nanti saat pindah ke mode aman)

Jalankan di terminal untuk menghasilkan hash yang bisa ditempel ke SQL:

```powershell
& "C:\xampp\php\php.exe" -r "echo password_hash('passwordku', PASSWORD_DEFAULT), PHP_EOL;"
```
