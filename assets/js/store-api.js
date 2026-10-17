/* ==========================================================================
   Matcha Cih — Client-side backend (NO PHP / NO MySQL)
   --------------------------------------------------------------------------
   Versi statis: semua yang dulu dikerjakan oleh api/*.php (MySQL + session)
   kini dijalankan di browser dengan localStorage sebagai "database".

   Caranya: kita pasang shim pada window.fetch sehingga setiap pemanggilan
   fetch('api/xxx.php?action=...') dialihkan ke handler JS di sini. Dengan
   begitu SELURUH kode halaman (index/lab/cart/order/admin/dll) tetap sama
   persis — cara penggunaannya tidak berubah, hanya backend-nya yang pindah
   ke sisi klien. File ini HARUS dimuat SEBELUM data.js.

   Admin default: admin / admin123  (sama seperti versi PHP).
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- storage
  const DB_KEY = 'mc_db_v1';       // seluruh "database" aplikasi
  const SESSION_KEY = 'mc_session'; // pengganti PHP session (per-perangkat)

  function nowIso() {
    // Format "YYYY-MM-DD HH:MM:SS" (lokal) — kompatibel dgn parser tanggal
    // di halaman (yang mengganti spasi jadi 'T').
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function freshDb() {
    return {
      orders: [],       // {code,nick,whatsapp,note,total,status,createdAt,collectedAt,cart:[...]}
      recipes: [],      // {id,name,author,config{...},orders,createdAt}
      users: [],        // {id,username,pass,role}
      counters: { ticket: 0, guest: 0, userId: 0 },
      settings: { booth_status: 'offline', booth_code: '' },
      csThreads: [],    // {id,token,guestName,lastAt,createdAt,messages:[{sender,body,createdAt}]}
      csNextId: 1,
      seededPopular: false,
    };
  }

  function loadDb() {
    let db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      db = raw ? JSON.parse(raw) : null;
    } catch (e) { db = null; }
    if (!db || typeof db !== 'object') db = freshDb();

    // Pastikan field inti ada (kompat bila struktur lama).
    const def = freshDb();
    for (const k of Object.keys(def)) if (!(k in db)) db[k] = def[k];
    db.counters = Object.assign({ ticket: 0, guest: 0, userId: 0 }, db.counters || {});
    db.settings = Object.assign({ booth_status: 'offline', booth_code: '' }, db.settings || {});

    // Seed akun admin default sekali saja.
    if (!db.users.some(u => u.username === 'admin')) {
      db.counters.userId += 1;
      db.users.push({ id: db.counters.userId, username: 'admin', pass: 'admin123', role: 'admin' });
    }
    return db;
  }

  function saveDb(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {}
  }

  // Sesi login (pengganti $_SESSION). Disimpan per-perangkat.
  function getSession() {
    try { const v = localStorage.getItem(SESSION_KEY); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function setSession(user) {
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function currentUser() {
    const s = getSession();
    return s ? { id: s.id, username: s.username, role: s.role } : null;
  }
  function isAdmin() {
    const u = currentUser();
    return !!(u && u.role === 'admin');
  }

  // ----------------------------------------------------------------- helpers
  function clean(s, max) {
    s = String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  }
  function shortId(len) {
    len = len || 6;
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function verifyPassword(plain, stored) {
    // Versi statis menyimpan password apa adanya (plain) — bandingkan langsung.
    return String(plain) === String(stored);
  }

  // Seed menu utama (sama seperti recipe.php action=popular saat kosong).
  function seedPopular(db) {
    if (db.seededPopular && db.recipes.length) return;
    if (db.recipes.length === 0) {
      const seed = [
        { name: 'Coconut Matcha', author: 'Menu Utama', intensity: 'medium', base: 'coconut', sweetener: 'normal', ice: 'normal', toppings: [], flavor: null, orders: 3 },
        { name: 'Strawberry Matcha', author: 'Menu Utama', intensity: 'light', base: 'fresh', sweetener: 'normal', ice: 'normal', toppings: ['jelly'], flavor: 'strawberry', orders: 2 },
        { name: 'Matcha Latte', author: 'Menu Utama', intensity: 'bold', base: 'fresh', sweetener: 'none', ice: 'normal', toppings: [], flavor: null, orders: 1 },
      ];
      seed.forEach(s => {
        db.recipes.push({
          id: shortId(),
          name: s.name,
          author: s.author,
          config: {
            intensity: s.intensity, base: s.base, sweetener: s.sweetener,
            ice: s.ice, toppings: s.toppings, flavor: s.flavor,
          },
          orders: s.orders,
          createdAt: nowIso(),
        });
      });
    }
    db.seededPopular = true;
  }

  // ================================================================= ROUTER
  // Mengembalikan objek respons { status, body } untuk sebuah "request".
  function handle(path, action, query, body, method) {
    const db = loadDb();
    let res;

    if (path === 'auth') res = routeAuth(db, action, body);
    else if (path === 'booth') res = routeBooth(db, action, body);
    else if (path === 'order') res = routeOrder(db, action, query, body);
    else if (path === 'recipe') res = routeRecipe(db, action, query, body);
    else if (path === 'support') res = routeSupport(db, action, query, body);
    else res = { status: 404, body: { ok: false, error: 'Endpoint tidak dikenal' } };

    saveDb(db);
    return res;
  }

  // ----------------------------------------------------------------- AUTH
  function routeAuth(db, action, body) {
    if (action === 'whoami' || !action) {
      return { status: 200, body: { ok: true, user: currentUser() } };
    }
    if (action === 'login') {
      const username = clean(body.username, 40);
      const password = String(body.password || '');
      if (!username || !password)
        return { status: 400, body: { ok: false, error: 'Username dan password wajib diisi' } };
      const u = db.users.find(x => x.username === username);
      if (!u || !verifyPassword(password, u.pass))
        return { status: 401, body: { ok: false, error: 'Username atau password salah' } };
      setSession({ id: u.id, username: u.username, role: u.role });
      return { status: 200, body: { ok: true, user: currentUser() } };
    }
    if (action === 'register') {
      const username = clean(body.username, 40);
      const password = String(body.password || '');
      if (username.length < 3 || password.length < 4)
        return { status: 400, body: { ok: false, error: 'Username min 3 & password min 4 karakter' } };
      if (db.users.some(x => x.username === username))
        return { status: 409, body: { ok: false, error: 'Username sudah dipakai' } };
      db.counters.userId += 1;
      const u = { id: db.counters.userId, username, pass: password, role: 'user' };
      db.users.push(u);
      setSession({ id: u.id, username: u.username, role: u.role });
      return { status: 200, body: { ok: true, user: currentUser() } };
    }
    if (action === 'logout') {
      setSession(null);
      return { status: 200, body: { ok: true } };
    }
    return { status: 400, body: { ok: false, error: 'Aksi tidak dikenal' } };
  }

  // ----------------------------------------------------------------- BOOTH
  function boothPayload(db) {
    const status = db.settings.booth_status || 'offline';
    const code = db.settings.booth_code || '';
    const labels = {
      offline: { title: 'Booth Belum Aktif', desc: 'Booth belum menerima pesanan saat ini.', tone: 'off' },
      busy: { title: 'Busy', desc: 'Booth sedang sibuk, mohon tunggu sebentar.', tone: 'busy' },
      taking: { title: 'Taking Order', desc: (code ? ('Sedang mengerjakan pesanan #' + code) : 'Sedang memproses pesanan.'), tone: 'taking' },
      free: { title: 'Free for Order', desc: 'Booth siap menerima pesananmu!', tone: 'free' },
    };
    const info = labels[status] || labels.offline;
    return { status, code, title: info.title, desc: info.desc, tone: info.tone, active: status !== 'offline' };
  }
  function routeBooth(db, action, body) {
    if (action === 'get' || !action)
      return { status: 200, body: { ok: true, booth: boothPayload(db) } };
    if (action === 'set') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const VALID = ['offline', 'busy', 'taking', 'free'];
      const status = clean(body.status, 20);
      if (VALID.indexOf(status) < 0) return { status: 400, body: { ok: false, error: 'Status tidak valid' } };
      db.settings.booth_status = status;
      db.settings.booth_code = (status === 'taking') ? clean(body.code, 12) : '';
      return { status: 200, body: { ok: true, booth: boothPayload(db) } };
    }
    return { status: 400, body: { ok: false, error: 'Aksi tidak dikenal' } };
  }

  // ----------------------------------------------------------------- ORDER
  const ORDER_STATUSES = ['received', 'brewing', 'ready'];

  function shapeOrder(o) {
    return {
      code: o.code, nick: o.nick, whatsapp: o.whatsapp, note: o.note,
      cart: (o.cart || []).map(it => ({
        recipeName: it.recipeName,
        ingredients: Array.isArray(it.ingredients) ? it.ingredients : [],
        price: Number(it.price) || 0,
        kcal: Number(it.kcal) || 0,
      })),
      total: Number(o.total) || 0,
      status: o.status,
      createdAt: o.createdAt,
      collectedAt: o.collectedAt || null,
    };
  }
  function findOrder(db, code) { return db.orders.find(o => o.code === code) || null; }

  function routeOrder(db, action, query, body) {
    if (action === 'create') {
      const cart = Array.isArray(body.cart) ? body.cart : [];
      if (!cart.length) return { status: 400, body: { ok: false, error: 'Keranjang kosong' } };

      const nick = clean(body.nick || 'Tamu', 40);
      let initial = 'M';
      const m = nick.match(/\p{L}/u);
      if (m) initial = m[0].toUpperCase();

      db.counters.ticket += 1;
      const code = initial + '-' + String(db.counters.ticket).padStart(3, '0');

      const order = {
        code,
        nick,
        whatsapp: clean(body.whatsapp, 20),
        note: clean(body.note, 200),
        total: Number(body.total) || 0,
        status: 'received',
        createdAt: nowIso(),
        collectedAt: null,
        cart: cart.map(it => ({
          recipeName: clean(it.recipeName || 'Racikan Matcha', 60),
          ingredients: (Array.isArray(it.ingredients) ? it.ingredients : []).map(x => clean(x, 80)),
          price: Number(it.price) || 0,
          kcal: Number(it.kcal) || 0,
        })),
      };
      db.orders.push(order);
      return { status: 200, body: { ok: true, code, order: shapeOrder(order) } };
    }

    if (action === 'status') {
      const code = clean(query.code, 12);
      const o = findOrder(db, code);
      if (!o) return { status: 404, body: { ok: false, error: 'Pesanan tidak ditemukan' } };
      return { status: 200, body: { ok: true, order: shapeOrder(o) } };
    }

    if (action === 'history') {
      let codes = Array.isArray(body.codes) ? body.codes : [];
      codes = codes.map(c => clean(c, 12)).filter((c, i, a) => c && a.indexOf(c) === i).slice(0, 100);
      const orders = [];
      codes.forEach(c => { const o = findOrder(db, c); if (o) orders.push(shapeOrder(o)); });
      orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { status: 200, body: { ok: true, orders } };
    }

    if (action === 'advance') {
      const code = clean(query.code || body.code, 12);
      const o = findOrder(db, code);
      if (!o) return { status: 404, body: { ok: false, error: 'Pesanan tidak ditemukan' } };
      let cur = ORDER_STATUSES.indexOf(o.status);
      if (cur < 0) cur = 0;
      o.status = ORDER_STATUSES[Math.min(cur + 1, ORDER_STATUSES.length - 1)];
      return { status: 200, body: { ok: true, order: shapeOrder(o) } };
    }

    if (action === 'list') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const filter = clean(query.filter || 'active', 12);
      const all = ['received', 'brewing', 'ready', 'done'];
      let rows;
      if (filter === 'all') {
        rows = db.orders.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      } else if (all.indexOf(filter) >= 0) {
        rows = db.orders.filter(o => o.status === filter)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      } else { // active
        rows = db.orders.filter(o => o.status === 'received' || o.status === 'brewing')
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      }
      const orders = rows.map(shapeOrder);
      const counts = { received: 0, brewing: 0, ready: 0, done: 0, all: 0 };
      db.orders.forEach(o => { if (counts[o.status] != null) counts[o.status] += 1; counts.all += 1; });
      return { status: 200, body: { ok: true, orders, counts } };
    }

    if (action === 'collect') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const code = clean(query.code || body.code, 12);
      const o = findOrder(db, code);
      if (!o) return { status: 404, body: { ok: false, error: 'Pesanan tidak ditemukan' } };
      o.status = 'done';
      if (!o.collectedAt) o.collectedAt = nowIso();
      return { status: 200, body: { ok: true, order: shapeOrder(o) } };
    }

    if (action === 'delete') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const code = clean(query.code || body.code, 12);
      const before = db.orders.length;
      db.orders = db.orders.filter(o => o.code !== code);
      return { status: 200, body: { ok: true, deleted: before - db.orders.length } };
    }

    if (action === 'clear') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const before = db.orders.length;
      db.orders = [];
      return { status: 200, body: { ok: true, deleted: before } };
    }

    if (action === 'resetTicket') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      let maxNum = 0;
      db.orders.forEach(o => { const m = String(o.code).match(/-(\d+)$/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); });
      const force = (query.force === '1') || (body.force === true);
      const remaining = db.orders.length;
      if (remaining > 0 && !force) {
        return {
          status: 409, body: {
            ok: false, needConfirm: true, remaining, maxNum,
            error: 'Masih ada ' + remaining + ' pesanan tersimpan (nomor tertinggi ' + maxNum + '). ' +
              'Reset counter bisa membuat nomor tiket berulang. Hapus pesanan lama dulu, atau paksa reset.',
          }
        };
      }
      db.counters.ticket = 0;
      return { status: 200, body: { ok: true, message: 'Counter tiket direset. Pesanan berikutnya mulai dari 001.' } };
    }

    return { status: 400, body: { ok: false, error: 'Aksi tidak dikenal' } };
  }

  // ----------------------------------------------------------------- RECIPE
  function shapeRecipe(r) {
    return {
      id: r.id, name: r.name, author: r.author,
      config: {
        intensity: r.config.intensity, base: r.config.base,
        sweetener: r.config.sweetener, ice: r.config.ice,
        toppings: Array.isArray(r.config.toppings) ? r.config.toppings : [],
        flavor: r.config.flavor != null ? r.config.flavor : null,
      },
      orders: Number(r.orders) || 0,
      createdAt: r.createdAt,
    };
  }
  function routeRecipe(db, action, query, body) {
    if (action === 'share') {
      const config = body.config;
      if (!config || typeof config !== 'object')
        return { status: 400, body: { ok: false, error: 'Config tidak valid' } };
      let id = shortId();
      while (db.recipes.some(r => r.id === id)) id = shortId();
      const toppings = (Array.isArray(config.toppings) ? config.toppings : []).map(t => clean(t, 20));
      const flavor = (config.flavor != null && config.flavor !== '') ? clean(config.flavor, 20) : null;
      const rec = {
        id,
        name: clean(body.name || 'Racikan Tanpa Nama', 60),
        author: clean(body.author || 'Anonim', 40),
        config: {
          intensity: clean(config.intensity || 'medium', 20),
          base: clean(config.base || 'fresh', 20),
          sweetener: clean(config.sweetener || 'normal', 20),
          ice: clean(config.ice || 'normal', 20),
          toppings: toppings,
          flavor: flavor,
        },
        orders: 0,
        createdAt: nowIso(),
      };
      db.recipes.push(rec);
      // URL share menunjuk ke lab.html?r=id pada lokasi file saat ini.
      const base = location.href.replace(/[^/]*$/, '');
      const url = base + 'lab.html?r=' + id;
      return { status: 200, body: { ok: true, id, url, hashtag: '#MatchaID', recipe: shapeRecipe(rec) } };
    }
    if (action === 'get') {
      const id = clean(query.id, 12);
      const r = db.recipes.find(x => x.id === id);
      if (!r) return { status: 404, body: { ok: false, error: 'Resep tidak ditemukan' } };
      return { status: 200, body: { ok: true, recipe: shapeRecipe(r) } };
    }
    if (action === 'popular') {
      seedPopular(db);
      const rows = db.recipes.slice().sort((a, b) => {
        const d = (Number(b.orders) || 0) - (Number(a.orders) || 0);
        return d !== 0 ? d : String(b.createdAt).localeCompare(String(a.createdAt));
      }).slice(0, 3);
      return { status: 200, body: { ok: true, recipes: rows.map(shapeRecipe) } };
    }
    return { status: 400, body: { ok: false, error: 'Aksi tidak dikenal' } };
  }

  // ----------------------------------------------------------------- SUPPORT
  function csMessages(thread) {
    return (thread.messages || []).map(m => ({ sender: m.sender, body: m.body, createdAt: m.createdAt }));
  }
  function routeSupport(db, action, query, body) {
    if (action === 'ask') {
      const token = clean(body.token, 40);
      let question = clean(body.question, 200);
      const code = clean(body.code, 12);
      if (!token || !question) return { status: 400, body: { ok: false, error: 'Data tidak lengkap' } };
      if (code) question += ' (Order #' + code + ')';

      let thread = db.csThreads.find(t => t.token === token);
      if (!thread) {
        db.counters.guest += 1;
        thread = {
          id: db.csNextId++,
          token,
          guestName: 'Guest-' + db.counters.guest,
          lastAt: nowIso(),
          createdAt: nowIso(),
          messages: [],
        };
        db.csThreads.push(thread);
      }
      thread.messages.push({ sender: 'user', body: question, createdAt: nowIso() });
      thread.lastAt = nowIso();
      return { status: 200, body: { ok: true, guestName: thread.guestName, messages: csMessages(thread) } };
    }

    if (action === 'poll') {
      const token = clean(query.token, 40);
      if (!token) return { status: 200, body: { ok: true, messages: [], guestName: null } };
      const thread = db.csThreads.find(t => t.token === token);
      if (!thread) return { status: 200, body: { ok: true, messages: [], guestName: null } };
      return { status: 200, body: { ok: true, guestName: thread.guestName, messages: csMessages(thread) } };
    }

    if (action === 'list') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const threads = db.csThreads.slice()
        .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
        .map(t => {
          const last = t.messages.length ? t.messages[t.messages.length - 1] : null;
          return {
            id: t.id, guestName: t.guestName, lastAt: t.lastAt,
            lastBody: last ? last.body : null,
            lastSender: last ? last.sender : null,
            totalMsg: t.messages.length,
          };
        });
      return { status: 200, body: { ok: true, threads } };
    }

    if (action === 'thread') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const id = parseInt(query.id, 10) || 0;
      const t = db.csThreads.find(x => x.id === id);
      if (!t) return { status: 404, body: { ok: false, error: 'Thread tidak ditemukan' } };
      return { status: 200, body: { ok: true, guestName: t.guestName, messages: csMessages(t) } };
    }

    if (action === 'reply') {
      if (!isAdmin()) return { status: 403, body: { ok: false, error: 'Akses ditolak. Login sebagai admin.' } };
      const id = parseInt(body.id, 10) || 0;
      const text = clean(body.body, 500);
      if (id <= 0 || !text) return { status: 400, body: { ok: false, error: 'Balasan kosong' } };
      const t = db.csThreads.find(x => x.id === id);
      if (!t) return { status: 404, body: { ok: false, error: 'Thread tidak ditemukan' } };
      t.messages.push({ sender: 'admin', body: text, createdAt: nowIso() });
      t.lastAt = nowIso();
      return { status: 200, body: { ok: true, messages: csMessages(t) } };
    }

    return { status: 400, body: { ok: false, error: 'Aksi tidak dikenal' } };
  }

  // ======================================================= FETCH INTERCEPTOR
  // Cocokkan URL seperti "api/order.php", "./api/order.php", "/api/order.php".
  const API_RE = /(?:^|\/)api\/(auth|booth|order|recipe|support)\.php(?:\?|$)/i;

  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    let url = (typeof input === 'string') ? input : (input && input.url) || '';
    const m = url.match(API_RE);
    if (!m) {
      // Bukan panggilan API aplikasi — teruskan ke fetch asli bila ada.
      if (nativeFetch) return nativeFetch(input, init);
      return Promise.reject(new Error('fetch tidak tersedia untuk: ' + url));
    }

    const path = m[1].toLowerCase();
    init = init || {};
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();

    // Parse query string.
    const query = {};
    const qi = url.indexOf('?');
    if (qi >= 0) {
      const sp = new URLSearchParams(url.slice(qi + 1));
      sp.forEach((v, k) => { query[k] = v; });
    }
    const action = query.action || '';

    // Parse body (JSON) bila ada.
    let body = {};
    let rawBody = init.body;
    if (rawBody == null && typeof input === 'object' && input.body != null) rawBody = input.body;
    if (typeof rawBody === 'string' && rawBody.length) {
      try { const j = JSON.parse(rawBody); if (j && typeof j === 'object') body = j; }
      catch (e) { /* abaikan body non-JSON */ }
    }

    let result;
    try {
      result = handle(path, action, query, body, method);
    } catch (e) {
      result = { status: 500, body: { ok: false, error: 'Kesalahan internal: ' + (e && e.message || e) } };
    }

    // Bungkus sebagai Response-like agar `.json()` di kode halaman tetap jalan.
    const payload = JSON.stringify(result.body);
    const resp = {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: () => Promise.resolve(JSON.parse(payload)),
      text: () => Promise.resolve(payload),
    };
    // Sedikit delay 0ms agar perilaku async konsisten dengan fetch nyata.
    return new Promise(resolve => setTimeout(() => resolve(resp), 0));
  };

  // Ekspor kecil untuk debugging opsional.
  window.MatchaStatic = {
    reset() { try { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {} },
    dump() { return loadDb(); },
  };
})();
