# Design — Desktop/Mobile Mode Toggle & Perbaikan Lebar Layout

## Ikhtisar
Mengganti mekanisme layout dari "murni media query" menjadi "layout berbasis
class yang dikontrol JS". Class `desktop-mode` pada <body> jadi saklar tunggal:
ada = layout lebar (desktop), tidak ada = layout sempit (mobile). JS menentukan
class ini saat load — mengikuti pilihan tersimpan bila ada, atau otomatis dari
lebar viewport bila belum ada. Tombol di top bar memaksa/mengganti mode.
Alasan class-based: media query tak bisa di-override klik pengguna; dengan class
di <body>, tombol cukup tambah/hapus class dan CSS bereaksi seketika tanpa reload.

## Arsitektur
- <body class="desktop-mode"?> = saklar tunggal.
- topbar tiap halaman punya tombol toggle.
- .app: max 1600px (desktop) / 480px (mobile).
- data.js menyediakan: getViewMode(), applyViewMode(), toggleViewMode(),
  initViewMode(); state di Store 'viewMode' = 'desktop' | 'mobile' | null(auto).

## Komponen & Perubahan

### 1. CSS (assets/css/style.css)
- Hapus blok @media (min-width:900px) dan @media (min-width:1300px) lama
  (yang membatasi .app ke 1100/1180px).
- Tambah aturan body.desktop-mode:
  - .app: max-width:1600px; width:100% (mengisi layar laptop).
  - .topbar/.screen/.footer-bar: padding tepi clamp(24px,4vw,64px).
  - latar body.desktop-mode = cream terang.
  - grid dua kolom: .desktop-split (Lab), .cart-split (Keranjang),
    .order-split (Tiket), .home-hero + .recipe-list.as-grid (Beranda).
- Tambah styling .mode-toggle untuk tombol top bar.
Rasional 1600px + clamp memenuhi Req 1.1–1.3.

### 2. Tombol toggle di top bar (index/lab/cart/order .php)
<button class="mode-toggle" id="modeToggle" onclick="toggleViewMode()">
  <span class="mt-ico">🖥️</span><span class="mt-label">Desktop Mode</span>
</button>
Ditempatkan di .topbar dekat .cart-chip/.spacer. (Req 2.1, 5.1)

### 3. Logika mode (assets/js/data.js) — fungsi global
- getViewMode(): baca Store.get('viewMode'); bila null → innerWidth>=900
  ? 'desktop' : 'mobile' (Auto, Req 3.3).
- applyViewMode(mode): body.classList.toggle('desktop-mode', mode==='desktop');
  update label+ikon #modeToggle menampilkan aksi berikutnya (Req 2.3).
  Desktop aktif → tawarkan "Mobile Mode" (📱); Mobile aktif → "Desktop Mode" (🖥️).
- toggleViewMode(): balik mode aktif, Store.set('viewMode',...), applyViewMode()
  (Req 2.2, 2.4, 3.1).
- initViewMode(): dipanggil saat DOM siap; terapkan getViewMode(); bila belum ada
  pilihan tersimpan, pasang listener resize (Req 3.4). Pilihan tersimpan
  diprioritaskan di atas resize.
Anti-flash (Req 3.2): jalankan penerapan mode sedini mungkin (skrip inline di
head.php / awal body) yang membaca localStorage sinkron dan menambah class
desktop-mode sebelum konten dirender.

### 4. head.php (opsional, anti-flash)
Skrip inline kecil membaca localStorage.mc_viewMode dan menambah class sedini
mungkin agar layout benar sejak frame pertama.

## Alur Data (state)
- localStorage key: mc_viewMode (via Store, prefix mc_).
- Nilai: "desktop" | "mobile" | tidak ada (Auto).
- Tidak ada perubahan backend/DB.

## Trade-off
- Ambang Auto = 900px (sama seperti breakpoint lama).
- Paksa Mobile di layar lebar → 480px terpusat, tetap usable (Req 4.3).
- Paksa Desktop di HP → grid pakai minmax() sehingga mengalir turun bila sempit
  (Req 4.3); kasus tepi.

## Strategi Verifikasi
- php -l untuk file .php yang diedit (pastikan markup tombol tak merusak PHP).
- Server lokal: index/lab/cart/order tetap HTTP 200; #modeToggle + skrip muncul.
- Visual browser: klik → layout berubah tanpa reload; pindah halaman → mode
  tetap; resize saat Auto → menyesuaikan.
