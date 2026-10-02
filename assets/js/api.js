/* ==========================================================================
   Matcha Cih — Client-side "API" (NO DATABASE / NO PHP)
   --------------------------------------------------------------------------
   Menggantikan seluruh backend PHP + MySQL dengan penyimpanan localStorage.
   Semua endpoint lama (api/*.php) kini direplikasi sebagai method sinkron
   pada objek global `MatchaAPI`. Nilai kembalian meniru bentuk JSON lama
   ({ ok, ... }) agar logika halaman nyaris tidak berubah.

   Catatan penting:
   - Data disimpan PER-PERANGKAT (per-browser). Admin & pelanggan yang
     berbagi perangkat/berbeda browser tidak saling melihat data.
   - "Sesi login" juga disimpan di localStorage.
   - Admin default: admin / admin123 (diseed otomatis).
   ========================================================================== */

(function (global) {
  'use strict';

  /* ---------- storage helpers (namespace mcdb_) ---------- */
  const DB = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('mcdb_' + key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem('mcdb_' + key, JSON.stringify(val)); } catch (e) {}
    },
  };

  const nowISO = () => new Date().toISOString();

  function cleanStr(s, max) {
    s = String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  }

  function shortId(len) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < (len || 6); i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  /* ==========================================================================
     SEED — jalankan sekali per perangkat
     ========================================================================== */
  function seed() {
    if (DB.get('seeded', false)) return;

    // --- users: admin default ---
    DB.set('users', [
      { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
    ]);
    DB.set('userSeq', 1);

    // --- recipes: menu utama (seperti seeding di recipe.php) ---
    const seedRecipes = [
      { name: 'Coconut Matcha',    author: 'Menu Utama', intensity: 'medium', base: 'evaporated', sweetener: 'normal', ice: 'normal', toppings: [],        flavor: null,         orders: 3 },
      { name: 'Strawberry Matcha', author: 'Menu Utama', intensity: 'light',  base: 'oat',        sweetener: 'normal', ice: 'normal', toppings: ['jelly'], flavor: 'strawberry', orders: 2 },
      { name: 'Matcha Latte',      author: 'Menu Utama', intensity: 'bold',   base: 'oat',        sweetener: 'none',   ice: 'normal', toppings: [],        flavor: null,         orders: 1 },
    ].map(r => ({ id: shortId(6), createdAt: nowISO(), ...r }));
    DB.set('recipes', seedRecipes);

    // --- counters ---
    DB.set('ticketCounter', 0);
    DB.set('guestCounter', 0);

    // --- booth ---
    DB.set('boothStatus', 'offline');
    DB.set('boothCode', '');

    // --- orders / cs ---
    DB.set('orders', []);
    DB.set('csThreads', []);
    DB.set('csSeq', 0);

    DB.set('seeded', true);
  }
  seed();

  /* ---------- session (login) ---------- */
  function getSession() { return DB.get('session', null); }
  function setSession(u) { DB.set('session', u); }

  /* ==========================================================================
     AUTH  (menggantikan api/auth.php)
     ========================================================================== */
  const Auth = {
    whoami() {
      return { ok: true, user: getSession() };
    },
    login(username, password) {
      username = cleanStr(username, 40);
      password = String(password || '');
      if (!username || !password) return { ok: false, error: 'Username dan password wajib diisi' };
      const users = DB.get('users', []);
      const u = users.find(x => x.username === username);
      if (!u || u.password !== password) return { ok: false, error: 'Username atau password salah' };
      const user = { id: u.id, username: u.username, role: u.role };
      setSession(user);
      return { ok: true, user };
    },
    register(username, password) {
      username = cleanStr(username, 40);
      password = String(password || '');
      if (username.length < 3 || password.length < 4) {
        return { ok: false, error: 'Username min 3 & password min 4 karakter' };
      }
      const users = DB.get('users', []);
      if (users.some(x => x.username === username)) return { ok: false, error: 'Username sudah dipakai' };
      const id = DB.get('userSeq', 1) + 1;
      DB.set('userSeq', id);
      users.push({ id, username, password, role: 'user' });
      DB.set('users', users);
      const user = { id, username, role: 'user' };
      setSession(user);
      return { ok: true, user };
    },
    logout() {
      setSession(null);
      return { ok: true };
    },
    isAdmin() {
      const u = getSession();
      return !!(u && u.role === 'admin');
    },
  };

  /* ==========================================================================
     RECIPES  (menggantikan api/recipe.php)
     ========================================================================== */
  const Recipe = {
    popular() {
      const recipes = DB.get('recipes', []).slice()
        .sort((a, b) => (b.orders - a.orders) || (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 3);
      return { ok: true, recipes };
    },
    get(id) {
      id = cleanStr(id, 12);
      const rec = DB.get('recipes', []).find(r => r.id === id);
      if (!rec) return { ok: false, error: 'Resep tidak ditemukan' };
      return { ok: true, recipe: rec };
    },
    share(name, author, config) {
      if (!config || typeof config !== 'object') return { ok: false, error: 'Config tidak valid' };
      const recipes = DB.get('recipes', []);
      let id = shortId(6);
      while (recipes.some(r => r.id === id)) id = shortId(6);
      const recipe = {
        id,
        name: cleanStr(name, 60) || 'Racikan Tanpa Nama',
        author: cleanStr(author, 40) || 'Anonim',
        intensity: cleanStr(config.intensity || 'medium', 20),
        base: cleanStr(config.base || 'oat', 20),
        sweetener: cleanStr(config.sweetener || 'normal', 20),
        ice: cleanStr(config.ice || 'normal', 20),
        toppings: Array.isArray(config.toppings) ? config.toppings.map(t => cleanStr(t, 20)) : [],
        flavor: config.flavor != null ? cleanStr(config.flavor, 20) : null,
        orders: 0,
        createdAt: nowISO(),
      };
      // config siap pakai (bentuk sama seperti recipe_row_to_array)
      recipe.config = {
        intensity: recipe.intensity, base: recipe.base, sweetener: recipe.sweetener,
        ice: recipe.ice, toppings: recipe.toppings, flavor: recipe.flavor,
      };
      recipes.push(recipe);
      DB.set('recipes', recipes);

      const base = location.pathname.replace(/\/[^\/]*$/, '');
      const url = location.origin + base + '/lab.html?r=' + id;
      return { ok: true, id, url, hashtag: '#MatchaID', recipe };
    },
  };

  // Pastikan setiap recipe punya .config (seed records perlu dibentuk ulang)
  function withConfig(r) {
    if (r.config) return r;
    return Object.assign({}, r, {
      config: {
        intensity: r.intensity, base: r.base, sweetener: r.sweetener,
        ice: r.ice, toppings: r.toppings || [], flavor: r.flavor || null,
      },
    });
  }
  const _popular = Recipe.popular;
  Recipe.popular = function () {
    const res = _popular();
    res.recipes = res.recipes.map(withConfig);
    return res;
  };
  const _get = Recipe.get;
  Recipe.get = function (id) {
    const res = _get(id);
    if (res.ok) res.recipe = withConfig(res.recipe);
    return res;
  };

  /* ==========================================================================
     ORDERS  (menggantikan api/order.php)
     ========================================================================== */
  const STATUSES = ['received', 'brewing', 'ready'];

  function findOrder(code) {
    return DB.get('orders', []).find(o => o.code === code) || null;
  }

  const Order = {
    create(input) {
      const cart = input.cart;
      if (!Array.isArray(cart) || cart.length === 0) return { ok: false, error: 'Keranjang kosong' };

      const nick = cleanStr(input.nick || 'Tamu', 40);
      let initial = 'M';
      const m = nick.match(/\p{L}/u);
      if (m) initial = m[0].toUpperCase();

      const num = DB.get('ticketCounter', 0) + 1;
      DB.set('ticketCounter', num);
      const code = initial + '-' + String(num).padStart(3, '0');

      const order = {
        code,
        nick,
        whatsapp: cleanStr(input.whatsapp || '', 20),
        note: cleanStr(input.note || '', 200),
        total: parseInt(input.total, 10) || 0,
        status: 'received',
        createdAt: nowISO(),
        collectedAt: null,
        cart: cart.map(it => ({
          recipeName: cleanStr(it.recipeName || 'Racikan Matcha', 60),
          ingredients: Array.isArray(it.ingredients) ? it.ingredients.map(x => cleanStr(x, 80)) : [],
          price: parseInt(it.price, 10) || 0,
          kcal: parseInt(it.kcal, 10) || 0,
          config: it.config || null,
        })),
      };
      const orders = DB.get('orders', []);
      orders.push(order);
      DB.set('orders', orders);
      return { ok: true, code, order };
    },

    status(code) {
      code = cleanStr(code, 12);
      const o = findOrder(code);
      if (!o) return { ok: false, error: 'Pesanan tidak ditemukan' };
      return { ok: true, order: o };
    },

    history(codes) {
      if (!Array.isArray(codes)) codes = [];
      codes = Array.from(new Set(codes.map(c => cleanStr(c, 12)))).slice(0, 100);
      const orders = codes.map(c => findOrder(c)).filter(Boolean);
      orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { ok: true, orders };
    },

    advance(code) {
      code = cleanStr(code, 12);
      const orders = DB.get('orders', []);
      const o = orders.find(x => x.code === code);
      if (!o) return { ok: false, error: 'Pesanan tidak ditemukan' };
      let cur = STATUSES.indexOf(o.status);
      if (cur < 0) cur = 0;
      o.status = STATUSES[Math.min(cur + 1, STATUSES.length - 1)];
      DB.set('orders', orders);
      return { ok: true, order: o };
    },

    list(filter) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      filter = cleanStr(filter || 'active', 12);
      let orders = DB.get('orders', []).slice();
      const all = ['received', 'brewing', 'ready', 'done'];
      let out;
      if (filter === 'all') {
        out = orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      } else if (all.includes(filter)) {
        out = orders.filter(o => o.status === filter).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      } else { // active
        out = orders.filter(o => o.status === 'received' || o.status === 'brewing')
          .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      }
      const counts = { received: 0, brewing: 0, ready: 0, done: 0, all: 0 };
      orders.forEach(o => { if (counts[o.status] != null) counts[o.status]++; counts.all++; });
      return { ok: true, orders: out, counts };
    },

    collect(code) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      code = cleanStr(code, 12);
      const orders = DB.get('orders', []);
      const o = orders.find(x => x.code === code);
      if (!o) return { ok: false, error: 'Pesanan tidak ditemukan' };
      o.status = 'done';
      if (!o.collectedAt) o.collectedAt = nowISO();
      DB.set('orders', orders);
      return { ok: true, order: o };
    },

    delete(code) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      code = cleanStr(code, 12);
      const orders = DB.get('orders', []);
      const idx = orders.findIndex(o => o.code === code);
      if (idx < 0) return { ok: true, deleted: 0 };
      orders.splice(idx, 1);
      DB.set('orders', orders);
      return { ok: true, deleted: 1 };
    },

    clear() {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      const before = DB.get('orders', []).length;
      DB.set('orders', []);
      return { ok: true, deleted: before };
    },

    resetTicket(force) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      const orders = DB.get('orders', []);
      let maxNum = 0;
      orders.forEach(o => { const m = String(o.code).match(/-(\d+)$/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); });
      const remaining = orders.length;
      if (remaining > 0 && force !== true) {
        return {
          ok: false, needConfirm: true, remaining, maxNum,
          error: 'Masih ada ' + remaining + ' pesanan tersimpan (nomor tertinggi ' + maxNum + '). '
               + 'Reset counter bisa membuat nomor tiket berulang. Hapus pesanan lama dulu, atau paksa reset.',
        };
      }
      DB.set('ticketCounter', 0);
      return { ok: true, message: 'Counter tiket direset. Pesanan berikutnya mulai dari 001.' };
    },
  };

  /* ==========================================================================
     BOOTH  (menggantikan api/booth.php)
     ========================================================================== */
  const BOOTH_VALID = ['offline', 'busy', 'taking', 'free'];
  function boothPayload() {
    const status = DB.get('boothStatus', 'offline') || 'offline';
    const code = DB.get('boothCode', '') || '';
    const labels = {
      offline: { title: 'Booth Belum Aktif', desc: 'Booth belum menerima pesanan saat ini.', tone: 'off' },
      busy:    { title: 'Busy',              desc: 'Booth sedang sibuk, mohon tunggu sebentar.', tone: 'busy' },
      taking:  { title: 'Taking Order',      desc: code ? ('Sedang mengerjakan pesanan #' + code) : 'Sedang memproses pesanan.', tone: 'taking' },
      free:    { title: 'Free for Order',    desc: 'Booth siap menerima pesananmu!', tone: 'free' },
    };
    const info = labels[status] || labels.offline;
    return { status, code, title: info.title, desc: info.desc, tone: info.tone, active: status !== 'offline' };
  }
  const Booth = {
    get() { return { ok: true, booth: boothPayload() }; },
    set(status, code) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      status = cleanStr(status, 20);
      if (!BOOTH_VALID.includes(status)) return { ok: false, error: 'Status tidak valid' };
      DB.set('boothStatus', status);
      DB.set('boothCode', status === 'taking' ? cleanStr(code || '', 12) : '');
      return { ok: true, booth: boothPayload() };
    },
  };

  /* ==========================================================================
     SUPPORT / CS  (menggantikan api/support.php)
     ========================================================================== */
  function csMessages(thread) {
    return (thread.messages || []).map(m => ({ sender: m.sender, body: m.body, createdAt: m.createdAt }));
  }

  const Support = {
    ask(token, question, code) {
      token = cleanStr(token, 40);
      question = cleanStr(question, 200);
      code = cleanStr(code || '', 12);
      if (!token || !question) return { ok: false, error: 'Data tidak lengkap' };
      if (code) question += ' (Order #' + code + ')';

      const threads = DB.get('csThreads', []);
      let thread = threads.find(t => t.token === token);
      if (!thread) {
        const no = DB.get('guestCounter', 0) + 1;
        DB.set('guestCounter', no);
        const seq = DB.get('csSeq', 0) + 1;
        DB.set('csSeq', seq);
        thread = { id: seq, token, guestName: 'Guest-' + no, lastAt: nowISO(), createdAt: nowISO(), messages: [] };
        threads.push(thread);
      }
      thread.messages.push({ sender: 'user', body: question, createdAt: nowISO() });
      thread.lastAt = nowISO();
      DB.set('csThreads', threads);
      return { ok: true, guestName: thread.guestName, messages: csMessages(thread) };
    },

    poll(token) {
      token = cleanStr(token, 40);
      if (!token) return { ok: true, messages: [], guestName: null };
      const thread = DB.get('csThreads', []).find(t => t.token === token);
      if (!thread) return { ok: true, messages: [], guestName: null };
      return { ok: true, guestName: thread.guestName, messages: csMessages(thread) };
    },

    list() {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      const threads = DB.get('csThreads', []).slice()
        .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
        .map(t => {
          const last = t.messages[t.messages.length - 1] || {};
          return {
            id: t.id, guestName: t.guestName, lastAt: t.lastAt,
            lastBody: last.body || '', lastSender: last.sender || '',
            totalMsg: t.messages.length,
          };
        });
      return { ok: true, threads };
    },

    thread(id) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      id = parseInt(id, 10) || 0;
      const t = DB.get('csThreads', []).find(x => x.id === id);
      if (!t) return { ok: false, error: 'Thread tidak ditemukan' };
      return { ok: true, guestName: t.guestName, messages: csMessages(t) };
    },

    reply(id, body) {
      if (!Auth.isAdmin()) return { ok: false, error: 'Akses ditolak. Login sebagai admin.' };
      id = parseInt(id, 10) || 0;
      body = cleanStr(body, 500);
      if (id <= 0 || !body) return { ok: false, error: 'Balasan kosong' };
      const threads = DB.get('csThreads', []);
      const t = threads.find(x => x.id === id);
      if (!t) return { ok: false, error: 'Thread tidak ditemukan' };
      t.messages.push({ sender: 'admin', body, createdAt: nowISO() });
      t.lastAt = nowISO();
      DB.set('csThreads', threads);
      return { ok: true, messages: csMessages(t) };
    },
  };

  /* ---------- expose ---------- */
  global.MatchaAPI = { Auth, Recipe, Order, Booth, Support };
})(window);
