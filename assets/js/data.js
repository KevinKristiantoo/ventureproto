/* ==========================================================================
   Matcha Cih — Shared data & config
   All prices in IDR. Calories are rough estimates for the profile calculator.
   ========================================================================== */

const MATCHA_DATA = {
  intensity: {
    light:  { key: "light",  name: "Mild",       price: 18000, kcal: 60,  umami: 2, creamy: 2, color: "#cfe3b4", height: "70%" },
    medium: { key: "medium", name: "Balanced",   price: 22000, kcal: 90,  umami: 3, creamy: 3, color: "#8bbf5a", height: "74%" },
    bold:   { key: "bold",   name: "Bold Umami", price: 25000, kcal: 110, umami: 5, creamy: 2, color: "#4d7c34", height: "78%" },
  },
  base: {
    fresh:      { key: "fresh",      name: "Fresh Milk",      price: 0,    kcal: 70, creamy: 3, foam: false },
    oat:        { key: "oat",        name: "Oat Milk",        price: 3000, kcal: 35, creamy: 2, foam: false },
    almond:     { key: "almond",     name: "Almond",          price: 3000, kcal: 30, creamy: 2, foam: false },
    evaporated: { key: "evaporated", name: "Evaporated Milk", price: 4000, kcal: 90, creamy: 4, foam: false },
  },
  /* Sugar level dalam persen */
  sweetener: {
    s0:   { key: "s0",   name: "0%",   price: 0, kcal: 0  },
    s30:  { key: "s30",  name: "30%",  price: 0, kcal: 20 },
    s50:  { key: "s50",  name: "50%",  price: 0, kcal: 35 },
    s75:  { key: "s75",  name: "75%",  price: 0, kcal: 48 },
    s100: { key: "s100", name: "100%", price: 0, kcal: 60 },
  },
  ice: {
    no:     { key: "no",     name: "No Ice",     price: 0, kcal: 0 },
    less:   { key: "less",   name: "Less Ice",   price: 0, kcal: 0 },
    normal: { key: "normal", name: "Normal Ice", price: 0, kcal: 0 },
  },
  toppings: {
    seasalt: { key: "seasalt", name: "Sea Salt Foam",     price: 3000, kcal: 45, creamy: 2, foam: true  },
    jelly:   { key: "jelly",   name: "Matcha Jelly Cubes",price: 2000, kcal: 30, creamy: 0, foam: false, jelly: true },
  },
};

/* Community "Matcha Hack" presets */
const MATCHA_PRESETS = [
  {
    key: "diet",
    emoji: "🥗",
    name: "Anak Diet",
    desc: "Bold Matcha + Oat Milk + Stevia",
    config: { intensity: "bold", base: "oat", sweetener: "stevia", ice: "normal", toppings: [] },
  },
  {
    key: "sweet",
    emoji: "🍯",
    name: "Sweet Tooth",
    desc: "Mild Matcha + Fresh Milk + Sea Salt Foam",
    config: { intensity: "light", base: "fresh", sweetener: "normal", ice: "normal", toppings: ["seasalt"] },
  },
  {
    key: "slayer",
    emoji: "⚔️",
    name: "Pure Umami Slayer",
    desc: "Double Whisked Ceremonial + Less Sweet",
    config: { intensity: "bold", base: "coconut", sweetener: "none", ice: "less", toppings: [] },
  },
];

/* Default build */
function defaultConfig() {
  return { intensity: "medium", base: "fresh", sweetener: "s50", ice: "normal", toppings: [], flavor: null };
}

const IDR = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

/* ---- warna cairan gelas ----
   Warna dasar = intensitas matcha, lalu digeser oleh base (susu/kelapa)
   dan rasa (mis. stroberi -> pink). */
const BASE_TINT = {
  // Oat Milk: bukan susu tambahan — hanya membuat warna matcha lebih TERANG.
  fresh:      { color: "#f3f1de", amount: 0.42 }, // fresh milk      -> krem susu
  oat:        { color: "#ffffff", amount: 0.42, lighten: true },
  almond:     { color: "#efe8da", amount: 0.34 }, // almond          -> krem lembut
  evaporated: { color: "#fbf4e3", amount: 0.46 }, // evaporated milk -> krem pekat
};
const FLAVOR_TINT = {
  strawberry: { color: "#ff6f9c", amount: 0.55 }, // stroberi -> pink
};

/* Campur dua warna hex, t = 0..1 (0 = c1, 1 = c2) */
function mixHex(c1, c2, t) {
  const a = c1.replace("#", ""), b = c2.replace("#", "");
  const r1 = parseInt(a.substring(0, 2), 16), g1 = parseInt(a.substring(2, 4), 16), b1 = parseInt(a.substring(4, 6), 16);
  const r2 = parseInt(b.substring(0, 2), 16), g2 = parseInt(b.substring(2, 4), 16), b2 = parseInt(b.substring(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  const h = (n) => n.toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(bl);
}

/* Hitung warna cairan akhir dari intensitas + base + flavor */
function liquidColorFor(cfg, intensity, base) {
  let color = intensity.color;
  const bt = BASE_TINT[base.key];
  if (bt) color = mixHex(color, bt.color, bt.amount);
  const ft = FLAVOR_TINT[cfg.flavor];
  if (ft) color = mixHex(color, ft.color, ft.amount);
  return color;
}

/* Compute totals, calories, and taste profile from a config object */
function computeBuild(cfg) {
  const D = MATCHA_DATA;
  const intensity = D.intensity[cfg.intensity] || D.intensity.medium;
  const base = D.base[cfg.base] || D.base.fresh;
  const sweet = D.sweetener[cfg.sweetener] || D.sweetener.s50;
  const ice = D.ice[cfg.ice] || D.ice.normal;
  const toppings = (cfg.toppings || []).map((k) => D.toppings[k]).filter(Boolean);

  let price = intensity.price + base.price + sweet.price + ice.price;
  let kcal = intensity.kcal + base.kcal + sweet.kcal;
  let umami = intensity.umami;
  let creamy = intensity.creamy + base.creamy;
  let hasFoam = base.foam;
  let hasJelly = false;

  toppings.forEach((t) => {
    price += t.price;
    kcal += t.kcal;
    creamy += t.creamy || 0;
    if (t.foam) hasFoam = true;
    if (t.jelly) hasJelly = true;
  });

  // less ice slightly concentrates flavor perception
  if (cfg.ice === "less") umami = Math.min(5, umami + 1);

  umami = Math.max(1, Math.min(5, umami));
  creamy = Math.max(1, Math.min(5, creamy));

  const flavor = (cfg.flavor && FLAVOR_LABEL[cfg.flavor])
    ? { key: cfg.flavor, name: FLAVOR_LABEL[cfg.flavor] }
    : null;

  return {
    price, kcal, umami, creamy, hasFoam, hasJelly,
    intensity, base, sweet, ice, toppings, flavor,
    liquidColor: liquidColorFor(cfg, intensity, base),
    liquidHeight: intensity.height,
  };
}

/* Human-readable ingredient list */
function buildIngredientList(cfg) {
  const b = computeBuild(cfg);
  const items = [
    { name: "Susu: " + b.base.name, price: b.base.price },
    { name: "Gula: " + b.sweet.name, price: b.sweet.price },
    { name: "Es: " + b.ice.name, price: b.ice.price },
  ];
  if (cfg.flavor && FLAVOR_LABEL[cfg.flavor]) {
    items.push({ name: "Rasa: " + FLAVOR_LABEL[cfg.flavor], price: 0 });
  }
  return items;
}

/* Nama tampilan rasa */
const FLAVOR_LABEL = {
  strawberry: "Stroberi",
};

/* ---------- localStorage helpers (client-side state across screens) ---------- */
const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("mc_" + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  set(key, val) { try { localStorage.setItem("mc_" + key, JSON.stringify(val)); } catch (e) {} },
  del(key) { try { localStorage.removeItem("mc_" + key); } catch (e) {} },
};

/* Toast helper */
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ==========================================================================
   View Mode — Desktop / Mobile toggle
   State disimpan di localStorage 'viewMode' = 'desktop' | 'mobile' | (null=auto).
   ========================================================================== */
const VIEWMODE_BREAKPOINT = 900;

/* Mode efektif saat ini: pilihan tersimpan, atau Auto dari lebar layar. */
function getViewMode() {
  const forced = Store.get("viewMode", null);
  if (forced === "desktop" || forced === "mobile") return forced;
  return autoViewMode();
}

/* Deteksi otomatis: HP/tablet -> mobile, laptop/PC -> desktop.
   Memakai User-Agent + layar sentuh + lebar layar sebagai penentu. */
function isMobileDevice() {
  const ua = navigator.userAgent || navigator.vendor || "";
  if (/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile|BlackBerry|webOS/i.test(ua)) return true;
  // iPad modern melaporkan diri sebagai Mac, deteksi lewat layar sentuh.
  const touch = (navigator.maxTouchPoints || 0) > 1;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 820;
  return touch && narrow;
}
function autoViewMode() {
  // Prioritas: kalau perangkatnya HP/tablet -> mobile; selain itu ikut lebar layar.
  if (isMobileDevice()) return "mobile";
  return (window.innerWidth >= VIEWMODE_BREAKPOINT) ? "desktop" : "mobile";
}

/* Terapkan mode ke <body> + perbarui label/ikon tombol toggle. */
function applyViewMode(mode) {
  const isDesktop = mode === "desktop";
  document.body.classList.toggle("desktop-mode", isDesktop);

  const btn = document.getElementById("modeToggle");
  if (btn) {
    const ico = btn.querySelector(".mt-ico");
    const label = btn.querySelector(".mt-label");
    // Tombol menawarkan aksi berikutnya (kebalikan dari mode aktif).
    if (isDesktop) {
      if (ico) ico.textContent = "📱";
      if (label) label.textContent = "Mobile Mode";
    } else {
      if (ico) ico.textContent = "🖥️";
      if (label) label.textContent = "Desktop Mode";
    }
  }
}

/* Balik mode, simpan pilihan, terapkan. Dipanggil dari tombol. */
function toggleViewMode() {
  const next = getViewMode() === "desktop" ? "mobile" : "desktop";
  Store.set("viewMode", next);
  applyViewMode(next);
}

/* Inisialisasi saat halaman dimuat. Bila belum ada pilihan tersimpan (Auto),
   ikuti perubahan ukuran jendela. */
function initViewMode() {
  applyViewMode(getViewMode());
  window.addEventListener("resize", () => {
    // Hanya auto-menyesuaikan bila pengguna belum memaksa mode.
    if (Store.get("viewMode", null) === null) applyViewMode(getViewMode());
  });
}

/* Terapkan sedini mungkin untuk mengurangi flash (body sudah ada saat data.js
   dieksekusi karena di-include di akhir body), lalu inisialisasi penuh
   (termasuk listener resize & label tombol) begitu DOM siap. Berlaku otomatis
   untuk semua halaman yang meng-include data.js. */
if (typeof document !== "undefined") {
  if (document.body) applyViewMode(getViewMode());
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initViewMode);
  } else {
    initViewMode();
  }
}

/* ==========================================================================
   Auth UI helper — tombol Login / akun di navbar (semua halaman)
   ========================================================================== */
let _currentUser = null;

/* Perbarui tampilan chip login sesuai status sesi. */
function renderLoginChip() {
  const chip = document.getElementById("loginChip");
  const label = document.getElementById("loginLabel");
  if (!chip || !label) return;
  if (_currentUser) {
    label.textContent = _currentUser.username + (_currentUser.role === "admin" ? " (admin)" : "");
    chip.classList.add("is-user");
  } else {
    label.textContent = "Login";
    chip.classList.remove("is-user");
  }
}

/* Klik chip: tamu -> ke login; sudah login -> buka dropdown profil. */
function accountAction() {
  if (!_currentUser) {
    location.href = "login.html";
    return;
  }
  toggleProfileMenu();
}

/* Buka/tutup dropdown profil di bawah chip login. */
function toggleProfileMenu() {
  let menu = document.getElementById("profileMenu");
  if (menu) { closeProfileMenu(); return; }

  const chip = document.getElementById("loginChip");
  if (!chip) return;

  const isAdmin = _currentUser.role === "admin";
  const initial = (_currentUser.username || "?").charAt(0).toUpperCase();

  menu = document.createElement("div");
  menu.id = "profileMenu";
  menu.className = "profile-menu";
  menu.innerHTML = `
    <div class="pm-head">
      <div class="pm-avatar">${initial}</div>
      <div class="pm-info">
        <div class="pm-name">${escapeAttr(_currentUser.username)}</div>
        <div class="pm-role">${isAdmin ? "Administrator" : "Pengguna"}</div>
      </div>
    </div>
    ${isAdmin ? '<button class="pm-item" id="pmAdmin">🛠️ Dashboard Admin</button>' : ''}
    <button class="pm-item pm-logout" id="pmLogout">🚪 Logout</button>
  `;
  document.body.appendChild(menu);

  // Posisikan tepat di bawah chip (align kanan).
  const r = chip.getBoundingClientRect();
  menu.style.top = (r.bottom + 8) + "px";
  menu.style.right = Math.max(8, window.innerWidth - r.right) + "px";

  const adminBtn = document.getElementById("pmAdmin");
  if (adminBtn) adminBtn.onclick = () => { location.href = "admin.html"; };
  document.getElementById("pmLogout").onclick = () => { closeProfileMenu(); logoutUser(); };

  // Tutup saat klik di luar / tekan Escape.
  setTimeout(() => {
    document.addEventListener("click", onOutsideClick, true);
    document.addEventListener("keydown", onEscClose, true);
  }, 0);
}

function onOutsideClick(e) {
  const menu = document.getElementById("profileMenu");
  const chip = document.getElementById("loginChip");
  if (!menu) return;
  if (menu.contains(e.target) || (chip && chip.contains(e.target))) return;
  closeProfileMenu();
}
function onEscClose(e) { if (e.key === "Escape") closeProfileMenu(); }

function closeProfileMenu() {
  const menu = document.getElementById("profileMenu");
  if (menu) menu.remove();
  document.removeEventListener("click", onOutsideClick, true);
  document.removeEventListener("keydown", onEscClose, true);
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function logoutUser() {
  fetch("api/auth.php?action=logout", { method: "POST" })
    .then(r => r.json())
    .then(() => {
      _currentUser = null;
      Store.del("user");
      renderLoginChip();
      showToast("Berhasil logout");
      // Bila sedang di halaman admin, kembali ke beranda (halaman jadi tak bisa diakses).
      if (/admin(_support)?\.html/i.test(location.pathname)) {
        setTimeout(() => { location.href = "index.html"; }, 500);
      }
    })
    .catch(() => showToast("Gagal logout"));
}

/* Cek sesi aktif di server saat load, sinkronkan chip. */
function initAuthChip() {
  if (!document.getElementById("loginChip")) return;
  fetch("api/auth.php?action=whoami")
    .then(r => r.json())
    .then(res => {
      _currentUser = (res.ok && res.user) ? res.user : null;
      if (_currentUser) Store.set("user", _currentUser); else Store.del("user");
      renderLoginChip();

      // Admin yang sudah login diarahkan langsung ke dashboard order saat
      // membuka beranda pelanggan — kecuali sengaja lewat (?stay=1).
      if (_currentUser && _currentUser.role === "admin") {
        // "Beranda" = index.html atau URL folder (diakhiri "/", mis. file:///.../VentureCopy/).
        const last = location.pathname.split("/").pop();
        const onHome = /^index\.html$/i.test(last) || last === "";
        const stay = new URLSearchParams(location.search).get("stay");
        if (onHome && !stay) location.href = "admin.html";
      }
    })
    .catch(() => { renderLoginChip(); });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthChip);
  } else {
    initAuthChip();
  }
}
