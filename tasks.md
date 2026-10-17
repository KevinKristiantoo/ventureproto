# Tasks — Desktop/Mobile Mode Toggle & Perbaikan Lebar Layout

- [ ] 1. Perbaiki & lebarkan layout desktop di CSS
  - Hapus blok @media (min-width:900px) dan @media (min-width:1300px) lama di assets/css/style.css
  - Tambah aturan body.desktop-mode: .app { max-width:1600px; width:100% }, latar cream terang
  - Terapkan padding tepi clamp(24px,4vw,64px) pada .topbar, .screen, .footer-bar
  - Pindahkan semua aturan dua kolom (.desktop-split, .cart-split, .order-split, .home-hero, .recipe-list.as-grid) ke bawah selektor body.desktop-mode
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

- [ ] 2. Tambah styling tombol toggle di CSS
  - Tambah kelas .mode-toggle + .mt-ico, .mt-label
  - _Requirements: 2.1_

- [ ] 3. Implementasi logika mode di assets/js/data.js
  - [ ] 3.1 getViewMode() (baca Store.get('viewMode'), fallback Auto dari innerWidth>=900)  _Req: 3.3_
  - [ ] 3.2 applyViewMode(mode) (toggle body.desktop-mode + update label/ikon #modeToggle)  _Req: 2.3, 2.4_
  - [ ] 3.3 toggleViewMode() (balik mode, Store.set('viewMode',...), applyViewMode)  _Req: 2.2, 3.1_
  - [ ] 3.4 initViewMode() (terapkan saat DOM siap; listener resize hanya saat Auto)  _Req: 3.4_

- [ ] 4. Anti-flash saat load
  - Skrip inline kecil sedini mungkin (partials/head.php atau awal body) membaca localStorage.mc_viewMode dan menambah class desktop-mode sebelum konten dirender
  - _Requirements: 3.2_

- [ ] 5. Tambah tombol toggle di top bar tiap halaman
  - [ ] 5.1 index.php — tambah <button class="mode-toggle" id="modeToggle" onclick="toggleViewMode()"> di .topbar
  - [ ] 5.2 lab.php — idem
  - [ ] 5.3 cart.php — idem
  - [ ] 5.4 order.php — idem
  - Panggil initViewMode() pada tiap halaman setelah data.js dimuat
  - _Requirements: 2.1, 5.1_

- [ ] 6. Verifikasi
  - [ ] 6.1 php -l pada index/lab/cart/order .php + partials/head.php
  - [ ] 6.2 Server lokal: keempat halaman HTTP 200 dan #modeToggle muncul di HTML
  - [ ] 6.3 Cek browser: klik → layout berubah tanpa reload; pindah halaman → konsisten; resize saat Auto → menyesuaikan; Mobile Mode tetap satu kolom + footer sticky
  - _Requirements: 1.1, 2.2, 2.4, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2_
