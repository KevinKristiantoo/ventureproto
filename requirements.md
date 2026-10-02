# Requirements — Desktop/Mobile Mode Toggle & Perbaikan Lebar Layout

## Ringkasan
Layout desktop Matcha Cih belum mengisi penuh lebar layar (konten mentok
~1100–1180px, ada ruang kosong besar di kiri-kanan). Mode tampilan juga hanya
otomatis dari lebar layar tanpa kontrol pengguna. Fitur ini: (1) melebarkan
layout desktop secara proporsional, (2) menambah tombol toggle Mobile/Desktop
Mode dengan pilihan yang tersimpan antar halaman.

## Glossary
- Mobile Mode: satu kolom sempit (~480px, dipusatkan), footer sticky — layout asli.
- Desktop Mode: layout lebar yang memakai hampir seluruh lebar layar, dua kolom.
- Auto mode: aplikasi memilih Mobile/Desktop otomatis dari lebar viewport bila
  pengguna belum memaksa mode.
- Forced mode: mode yang dipilih lewat tombol; menimpa Auto mode.

## Requirement 1 — Desktop layout mengisi lebar layar
User story: Sebagai pengguna laptop/PC, saya ingin tampilan mengisi lebar layar,
sehingga tidak ada ruang kosong mubazir di kiri-kanan.
Acceptance Criteria:
1. WHEN Desktop Mode di layar lebar THEN konten SHALL melebar mendekati tepi kiri
   dan kanan (padding tepi proporsional, tidak mentok ~1100px).
2. WHEN lebar viewport bertambah THEN padding tepi SHALL menyesuaikan proporsional
   (mis. clamp) agar konten tetap rapi.
3. IF viewport sangat besar THEN lebar konten SHALL dibatasi maksimum wajar
   (~1600px) dan tetap terpusat.
4. WHEN Desktop Mode THEN latar SHALL cream terang, bukan hijau gelap.

## Requirement 2 — Tombol toggle Mobile/Desktop Mode
User story: Sebagai pengguna, saya ingin tombol untuk berpindah mode manual.
Acceptance Criteria:
1. WHEN halaman mana pun dimuat THEN tombol toggle SHALL tampil di top bar.
2. WHEN diklik saat Desktop Mode THEN beralih ke Mobile Mode, dan sebaliknya.
3. WHEN mode berpindah THEN label/ikon tombol SHALL memperbarui teks aksi berikutnya.
4. WHEN mode berpindah THEN perubahan layout SHALL langsung terlihat tanpa reload.

## Requirement 3 — Pilihan mode tersimpan & konsisten antar halaman
User story: Sebagai pengguna, saya ingin pilihan mode diingat antar halaman.
Acceptance Criteria:
1. WHEN pengguna memaksa mode THEN pilihan SHALL disimpan di localStorage.
2. WHEN berpindah/membuka halaman lain THEN mode tersimpan SHALL diterapkan
   sebelum konten tampil (tanpa flash layout salah).
3. IF belum ada pilihan tersimpan THEN pakai Auto mode dari lebar viewport.
4. WHILE Auto mode AND ukuran jendela melewati ambang THEN mode SHALL menyesuaikan.

## Requirement 4 — Mobile Mode tetap utuh
User story: Sebagai pengguna HP, saya ingin tampilan mobile tetap sama.
Acceptance Criteria:
1. WHEN Mobile Mode THEN semua halaman SHALL satu kolom seperti versi saat ini.
2. WHEN Mobile Mode THEN footer total SHALL tetap sticky di bawah.
3. WHEN mode dipaksa berlawanan dengan lebar layar THEN layout SHALL tetap usable.

## Requirement 5 — Konsistensi lintas halaman
User story: Sebagai pengguna, saya ingin tombol & perilaku mode sama di semua halaman.
Acceptance Criteria:
1. WHEN meninjau Beranda, Lab, Keranjang, Tiket THEN masing-masing SHALL punya
   tombol toggle yang sama.
2. WHEN mode aktif THEN layout dua kolom (Lab/Keranjang/Tiket) dan grid Beranda
   SHALL mengikuti mode yang sama.

## Catatan teknis (non-normatif)
- Hanya menyentuh: assets/css/style.css (layout via body.desktop-mode),
  tombol+skrip toggle di top bar, dan Store di assets/js/data.js.
- Tidak ada perubahan backend PHP / skema DB.
- Verifikasi: tiap halaman tetap HTTP 200 + wrapper layout ada; cek visual di browser.
