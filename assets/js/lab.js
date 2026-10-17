/* ==========================================================================
   Matcha Cih — Customization Lab controller
   Handles: interactive cup, taste radar, calorie calc, presets, options,
   real-time total, add-to-cart, and shareable recipe (#MatchaID).
   ========================================================================== */

(function () {
  const D = MATCHA_DATA;
  const params = new URLSearchParams(location.search);

  // ---- state ----
  let cfg = defaultConfig();
  let recipeName = null;
  let prevKcal = null;

  // If arriving from a shared link (?r=id) fetch it; else check localStorage loads.
  const sharedId = params.get('r');

  function init() {
    document.getElementById('cartCount').textContent = Store.get('cart', []).length;

    if (sharedId) {
      fetch('api/recipe.php?action=get&id=' + encodeURIComponent(sharedId))
        .then(r => r.json())
        .then(res => {
          if (res.ok && res.recipe) {
            cfg = normalize(res.recipe.config);
            recipeName = res.recipe.name;
            showToast('Racikan "' + res.recipe.name + '" dimuat 🍵');
          }
          boot();
        })
        .catch(boot);
      return;
    }

    if (params.get('loaded')) {
      cfg = normalize(Store.get('build', defaultConfig()));
      recipeName = Store.get('buildName', null);
    } else if (params.get('menu')) {
      // "Menu Rekomendasi" entry → start from a popular preset
      cfg = normalize(MATCHA_PRESETS[1].config);
      recipeName = MATCHA_PRESETS[1].name;
    }
    boot();
  }

  function normalize(c) {
    const base = defaultConfig();
    return {
      intensity: (c && c.intensity) || base.intensity,
      base: (c && c.base) || base.base,
      sweetener: (c && c.sweetener) || base.sweetener,
      ice: (c && c.ice) || base.ice,
      toppings: (c && Array.isArray(c.toppings)) ? c.toppings.slice() : [],
      flavor: (c && c.flavor) || null,
    };
  }

  function boot() {
    renderPresets();
    renderOptions();
    renderAll();
    wireModal();
    wireAdd();
  }

  // ---------- Presets ----------
  function renderPresets() {
    const wrap = document.getElementById('presetScroll');
    if (!wrap) return; // section Matcha Hack dihapus dari lab.php
    wrap.innerHTML = '';
    MATCHA_PRESETS.forEach(p => {
      const el = document.createElement('button');
      el.className = 'preset';
      el.dataset.key = p.key;
      el.innerHTML = `<div class="p-emoji">${p.emoji}</div>
        <div class="p-name">${p.name}</div>
        <div class="p-desc">${p.desc}</div>`;
      el.onclick = () => {
        cfg = normalize(p.config);
        recipeName = p.name;
        renderOptions();
        renderAll();
        showToast('Preset "' + p.name + '" diterapkan');
      };
      wrap.appendChild(el);
    });
  }

  function markActivePreset() {
    document.querySelectorAll('.preset').forEach(el => {
      const p = MATCHA_PRESETS.find(x => x.key === el.dataset.key);
      const match = p && sameConfig(p.config, cfg);
      el.classList.toggle('active', !!match);
    });
  }

  function sameConfig(a, b) {
    const ta = (a.toppings || []).slice().sort().join(',');
    const tb = (b.toppings || []).slice().sort().join(',');
    return a.intensity === b.intensity && a.base === b.base &&
           a.sweetener === b.sweetener && a.ice === b.ice && ta === tb;
  }

  // ---------- Options (stepper) ----------
  function optHtml(name, price, selected, topping) {
    const priceTxt = price === 0 ? 'Gratis'
                    : (price > 0 ? '+' + IDR(price) : IDR(price));
    return `<div class="o-name">${name}</div><div class="o-price">${priceTxt}</div>`;
  }

  function makeOpt(container, group, key, obj, multi) {
    const el = document.createElement('button');
    el.className = 'opt' + (group === 'toppings' ? ' topping' : '');
    el.dataset.group = group;
    el.dataset.key = key;
    el.innerHTML = optHtml(obj.name, priceFor(group, obj));
    el.onclick = () => {
      if (multi) {
        const arr = cfg.toppings;
        const i = arr.indexOf(key);
        if (i >= 0) arr.splice(i, 1); else arr.push(key);
      } else {
        cfg[group] = key;
      }
      recipeName = recipeName; // keep name; user tweaked it though
      renderAll();
    };
    container.appendChild(el);
  }

  function priceFor(group, obj) {
    // intensity shows absolute price, everything else shows delta
    return group === 'intensity' ? obj.price : obj.price;
  }

  function renderOptions() {
    // Susu/Base, Level Gula & Es yang bisa dipilih di Lab.
    const map = [
      ['optBase', 'base', D.base, false],
      ['optSweet', 'sweetener', D.sweetener, false],
      ['optIce', 'ice', D.ice, false],
    ];
    map.forEach(([id, group, dict, multi]) => {
      const c = document.getElementById(id);
      if (!c) return;   // container yang dihapus dari lab.php diabaikan
      c.innerHTML = '';
      Object.keys(dict).forEach(key => makeOpt(c, group, key, dict[key], multi));
    });
  }

  function markSelected() {
    document.querySelectorAll('.opt').forEach(el => {
      const g = el.dataset.group, k = el.dataset.key;
      let on = false;
      if (g === 'toppings') on = cfg.toppings.includes(k);
      else on = cfg[g] === k;
      el.classList.toggle('selected', on);
    });
  }

  // ---------- Render everything from current cfg ----------
  function renderAll() {
    const b = computeBuild(cfg);
    updateCup(b);
    document.getElementById('footerTotal').textContent = IDR(b.price);
    markSelected();
    markActivePreset();
    Store.set('build', cfg);
  }

  // ---------- Cup ----------
  function updateCup(b) {
    const liquid = document.getElementById('cupLiquid');
    const foam = document.getElementById('cupFoam');
    const jelly = document.getElementById('cupJelly');

    // Deteksi apakah warna berubah -> mainkan animasi aduk + blend.
    const prevColor = liquid.dataset.color || '';
    const changed = prevColor && prevColor !== b.liquidColor;

    liquid.style.background = b.liquidColor;
    liquid.style.height = b.liquidHeight;
    liquid.dataset.color = b.liquidColor;

    if (changed) playStir(b.liquidColor);

    // foam sits on top of liquid surface
    if (b.hasFoam) {
      foam.classList.add('show');
      foam.style.height = '16%';
      foam.style.bottom = b.liquidHeight;
    } else {
      foam.classList.remove('show');
      foam.style.height = '0';
    }

    jelly.classList.toggle('show', b.hasJelly);

    // Es batu: No Ice = 0 kubus, Less Ice = 2 kubus, Normal Ice = 3 kubus.
    updateIce(b.ice.key === 'no' ? 0 : (b.ice.key === 'less' ? 2 : 3));

    document.getElementById('cupName').textContent = recipeName || 'Matcha Cih';
    const iceLabel = b.ice.key === 'no' ? 'No Ice' : (b.ice.key === 'less' ? 'Less Ice' : 'Normal Ice');
    document.getElementById('cupSub').textContent =
      b.base.name + ' · Gula ' + b.sweet.name + ' · ' + iceLabel +
      (b.flavor ? ' · ' + b.flavor.name : '');
  }

  // Tampilkan sejumlah es batu; kubus yang baru muncul diberi animasi jatuh.
  function updateIce(count) {
    const ice = document.getElementById('cupIce');
    if (!ice) return;
    const cubes = ice.querySelectorAll('.cube');
    cubes.forEach((cube, i) => {
      const shouldShow = i < count;
      const wasShown = cube.classList.contains('show');
      if (shouldShow && !wasShown) {
        cube.classList.add('show');
        cube.classList.remove('drop');
        void cube.offsetWidth;     // reflow agar animasi bisa diulang
        cube.classList.add('drop');
      } else if (!shouldShow) {
        cube.classList.remove('show', 'drop');
      }
    });
  }

  // Animasi: matcha diaduk (whisk berputar + swirl) & cairan baru menyatu (blend).
  let _stirTimer = null;
  function playStir(newColor) {
    const cup = document.getElementById('cup');
    const hand = document.getElementById('cupHand');
    const swirl = document.getElementById('cupSwirl');
    const blend = document.getElementById('cupBlend');
    if (!cup) return;

    // "Blend in": tuangkan warna baru dari atas lalu memudar menyatu.
    if (blend) {
      blend.style.background = newColor;
      blend.classList.remove('go');
      void blend.offsetWidth;      // paksa reflow agar animasi bisa diulang
      blend.classList.add('go');
    }
    // Swirl + tangan mengaduk sebentar.
    cup.classList.remove('stir');
    void cup.offsetWidth;
    cup.classList.add('stir');
    if (swirl) { swirl.classList.remove('go'); void swirl.offsetWidth; swirl.classList.add('go'); }
    if (hand)  { hand.classList.remove('go');  void hand.offsetWidth;  hand.classList.add('go'); }

    clearTimeout(_stirTimer);
    _stirTimer = setTimeout(() => {
      cup.classList.remove('stir');
      if (swirl) swirl.classList.remove('go');
      if (hand) hand.classList.remove('go');
      if (blend) blend.classList.remove('go');
    }, 1200);
  }

  // ---------- Add to cart ----------
  function addToCart() {
    const b = computeBuild(cfg);
    const cart = Store.get('cart', []);
    cart.push({
      recipeName: recipeName || 'Matcha Cih Custom',
      config: cfg,
      ingredients: buildIngredientList(cfg).map(x => x.name),
      price: b.price,
      kcal: b.kcal,
    });
    Store.set('cart', cart);
    document.getElementById('cartCount').textContent = cart.length;
    updateCartHint();
    return cart.length;
  }

  // Kembalikan lab ke racikan default supaya bisa meracik pesanan berikutnya.
  function resetLab() {
    cfg = normalize(defaultConfig());
    recipeName = null;
    Store.del('buildName');
    renderOptions();
    renderAll();
  }

  // Tampilkan berapa item sudah di keranjang di dekat total.
  function updateCartHint() {
    const n = Store.get('cart', []).length;
    const hint = document.getElementById('cartHint');
    if (!hint) return;
    if (n > 0) {
      hint.textContent = '· ' + n + ' item di keranjang';
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }

  function wireAdd() {
    updateCartHint();

    // Lanjut ke Pesanan: simpan racikan lalu buka keranjang.
    document.getElementById('btnAdd').onclick = () => {
      addToCart();
      showToast('Ditambahkan ke pesanan ✓');
      setTimeout(() => location.href = 'cart.html', 500);
    };

    // Racik Lagi: simpan racikan lalu langsung ke Menu Rekomendasi.
    document.getElementById('btnAddMore').onclick = () => {
      const n = addToCart();
      showToast('Ditambahkan ✓ (' + n + ' item) — pilih menu lain!');
      setTimeout(() => location.href = 'menu.html', 500);
    };
  }

  // ---------- Share modal ----------
  function wireModal() {
    const modal = document.getElementById('shareModal');
    const open = () => {
      modal.classList.add('show');
      document.getElementById('recipeName').value = recipeName || '';
      document.getElementById('shareResult').classList.add('hidden');
      document.getElementById('shareButtons').classList.remove('hidden');
    };
    const close = () => modal.classList.remove('show');

    document.getElementById('btnName').onclick = open;
    document.getElementById('btnCancelShare').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('btnDoShare').onclick = () => {
      const name = document.getElementById('recipeName').value.trim() || 'Racikan Tanpa Nama';
      const author = document.getElementById('recipeAuthor').value.trim() || 'Anonim';
      recipeName = name;
      Store.set('buildName', name);

      fetch('api/recipe.php?action=share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, author, config: cfg }),
      })
        .then(r => r.json())
        .then(res => {
          if (!res.ok) { showToast('Gagal membuat link'); return; }
          const url = res.url;
          document.getElementById('shareUrl').value = url;
          const msg = encodeURIComponent(`Cobain racikan matcha-ku "${name}" di Matcha Cih ${res.hashtag}: ${url}`);
          document.getElementById('btnWa').href = 'https://wa.me/?text=' + msg;
          document.getElementById('shareResult').classList.remove('hidden');
          document.getElementById('shareButtons').classList.add('hidden');
          showToast('Link resep dibuat! 🎉');
        })
        .catch(() => showToast('Server tidak merespons'));
    };

    document.getElementById('btnCopy').onclick = () => {
      const inp = document.getElementById('shareUrl');
      inp.select();
      navigator.clipboard?.writeText(inp.value).then(
        () => showToast('Link disalin 📋'),
        () => { document.execCommand('copy'); showToast('Link disalin 📋'); }
      );
    };
    document.getElementById('btnCloseShare').onclick = close;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
