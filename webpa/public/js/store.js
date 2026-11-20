import {
  $, $$, esc, money, fmtDate, api, icon, productVisual, stars, toast, statusBadge,
  renderSocialLogin, PAYMENT,
} from './common.js';

const app = $('#app');
const state = { user: null, config: {}, categories: [] };
const productCache = new Map();

/* ================= Savat va sevimlilar (localStorage) ================= */

const store = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* xotira bloklangan */ }
  },
};

const snapshot = (p) => ({
  id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image, stock: p.stock, category_icon: p.category_icon,
});

const cart = {
  items: store.read('webpa_cart', []),
  save() { store.write('webpa_cart', this.items); updateHeader(); },
  count() { return this.items.reduce((s, i) => s + i.qty, 0); },
  total() { return this.items.reduce((s, i) => s + i.qty * i.price, 0); },
  add(p, qty = 1) {
    const it = this.items.find((i) => i.id === p.id);
    const max = Math.max(p.stock, 0);
    if (it) it.qty = Math.min(it.qty + qty, max);
    else this.items.push({ ...snapshot(p), qty: Math.min(qty, max) });
    this.save();
  },
  set(id, qty) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    it.qty = Math.max(1, Math.min(qty, it.stock || 99));
    this.save();
  },
  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.save(); },
  clear() { this.items = []; this.save(); },
};

const wish = {
  ids: store.read('webpa_wish', []),
  has(id) { return this.ids.includes(id); },
  toggle(id) {
    this.ids = this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id];
    store.write('webpa_wish', this.ids);
    updateHeader();
    return this.has(id);
  },
};

/* ================= Umumiy komponentlar ================= */

function remember(list) {
  for (const p of list) productCache.set(p.id, p);
  return list;
}

function discountPct(p) {
  return p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
}

function productCard(p) {
  const d = discountPct(p);
  const out = p.stock <= 0;
  return `
  <article class="card">
    <a href="#/product/${esc(p.slug)}" class="card-media">
      ${productVisual(p, 72)}
      ${d ? `<span class="tag tag-sale">−${d}%</span>` : ''}
      ${out ? '<span class="tag tag-out">Tugagan</span>' : ''}
    </a>
    <button class="wish-btn ${wish.has(p.id) ? 'active' : ''}" data-wish="${p.id}" aria-label="Sevimlilarga">${icon('heart', 18)}</button>
    <div class="card-body">
      <div class="card-brand">${esc(p.brand || p.category_name || '')}</div>
      <a href="#/product/${esc(p.slug)}" class="card-title">${esc(p.name)}</a>
      <div class="card-rating">${p.review_count ? `${stars(p.rating)} <span class="muted small">${p.review_count}</span>` : ''}</div>
      <div class="price-row">
        <span class="price">${money(p.price)}</span>
        ${d ? `<s class="old-price">${money(p.old_price)}</s>` : ''}
      </div>
      <button class="btn btn-primary btn-block btn-sm card-cta" data-add-cart="${p.id}" ${out ? 'disabled' : ''}>
        ${icon('cart', 16)} ${out ? 'Mavjud emas' : 'Savatga'}
      </button>
    </div>
  </article>`;
}

const grid = (items) => `<div class="product-grid">${items.map(productCard).join('')}</div>`;

const emptyState = (ic, title, text, cta = '') => `
  <div class="empty"><div class="empty-ic">${icon(ic, 32)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta}</div>`;

function section(title, link, body) {
  return `<section class="section">
    <div class="section-head"><h2>${esc(title)}</h2>${link ? `<a class="link" href="${link}">Barchasi →</a>` : ''}</div>
    ${body}
  </section>`;
}

function updateHeader() {
  const u = state.user;
  const cc = cart.count();
  const wc = wish.ids.length;
  $('#headerActions').innerHTML = `
    <a href="#/wishlist" class="hdr-act" aria-label="Sevimlilar">${icon('heart', 22)}${wc ? `<b class="count">${wc}</b>` : ''}<span>Sevimlilar</span></a>
    <a href="#/cart" class="hdr-act" aria-label="Savat">${icon('cart', 22)}${cc ? `<b class="count">${cc}</b>` : ''}<span>Savat</span></a>
    ${u
      ? `<a href="#/account" class="hdr-act">${u.avatar ? `<img class="avatar" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : icon('user', 22)}<span>${esc(u.name.split(' ')[0])}</span></a>`
      : `<a href="#/login" class="hdr-act">${icon('user', 22)}<span>Kirish</span></a>`}`;
}

function renderCatNav() {
  $('#catNav').innerHTML = `<a href="#/catalog" class="cat-link">${icon('grid', 16)} Barcha mahsulotlar</a>` +
    state.categories.map((c) => `<a href="#/catalog?category=${esc(c.slug)}" class="cat-link">${esc(c.name)}</a>`).join('') +
    '<a href="#/catalog?discount=1" class="cat-link hot">Chegirmalar</a>';
}

/* ================= Sahifalar ================= */

async function pageHome() {
  const [featured, deals, fresh] = await Promise.all([
    api('/products?featured=1&limit=8'),
    api('/products?discount=1&sort=discount&limit=4'),
    api('/products?sort=newest&limit=8'),
  ]);
  remember([...featured.items, ...deals.items, ...fresh.items]);

  const hero = featured.items[0];
  app.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <span class="hero-kicker">Yangi mavsum • ${new Date().getFullYear()}</span>
        <h1>Eng so'nggi elektronika — <span>webpa</span>'da</h1>
        <p>Smartfonlar, noutbuklar, quloqchinlar va aqlli gadjetlar. Original mahsulotlar, rasmiy kafolat va tez yetkazib berish.</p>
        <div class="row hero-cta">
          <a href="#/catalog" class="btn btn-accent">Xaridni boshlash</a>
          <a href="#/catalog?discount=1" class="btn btn-outline">Chegirmalar</a>
        </div>
      </div>
      ${hero ? `<a class="hero-card" href="#/product/${esc(hero.slug)}">
        <div class="hero-visual">${productVisual(hero, 120)}</div>
        <div class="hero-card-info"><span class="muted small">Tavsiya etamiz</span><b>${esc(hero.name)}</b><span class="price">${money(hero.price)}</span></div>
      </a>` : ''}
    </section>

    <section class="perks">
      <div class="perk">${icon('truck', 26)}<div><b>Tez yetkazish</b><span>Toshkent bo'ylab 1 kunda</span></div></div>
      <div class="perk">${icon('shield', 26)}<div><b>Rasmiy kafolat</b><span>Faqat original mahsulotlar</span></div></div>
      <div class="perk">${icon('card', 26)}<div><b>Qulay to'lov</b><span>Naqd yoki karta orqali</span></div></div>
      <div class="perk">${icon('headset', 26)}<div><b>Qo'llab-quvvatlash</b><span>Har kuni 9:00–21:00</span></div></div>
    </section>

    ${section('Kategoriyalar', '', `<div class="cat-grid">${state.categories.map((c) => `
      <a class="cat-tile" href="#/catalog?category=${esc(c.slug)}">
        <div class="cat-ic ph-${esc(c.icon)}">${icon(c.icon, 30)}</div>
        <b>${esc(c.name)}</b><span class="muted small">${c.product_count} ta mahsulot</span>
      </a>`).join('')}</div>`)}

    ${deals.items.length ? section('🔥 Chegirmalar', '#/catalog?discount=1', grid(deals.items)) : ''}
    ${section('Tavsiya etamiz', '#/catalog?featured=1', grid(featured.items))}
    ${section('Yangi kelganlar', '#/catalog?sort=newest', grid(fresh.items))}`;
}

async function pageCatalog({ query }) {
  const category = query.get('category') || '';
  const q = query.get('q') || '';
  const sort = query.get('sort') || 'popular';
  const page = Number(query.get('page')) || 1;
  const selBrands = (query.get('brand') || '').split(',').filter(Boolean);

  const params = new URLSearchParams(query);
  params.set('limit', '12');
  const [data, { brands }] = await Promise.all([
    api('/products?' + params),
    api('/brands' + (category ? `?category=${encodeURIComponent(category)}` : '')),
  ]);
  remember(data.items);

  const cat = state.categories.find((c) => c.slug === category);
  const title = q ? `"${q}" bo'yicha qidiruv` : cat ? cat.name
    : query.get('discount') ? 'Chegirmalar' : query.get('featured') ? 'Tavsiya etilganlar' : 'Barcha mahsulotlar';

  const link = (changes) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(changes)) (v ? p.set(k, v) : p.delete(k));
    if (!('page' in changes)) p.delete('page');
    const s = p.toString();
    return '#/catalog' + (s ? '?' + s : '');
  };

  app.innerHTML = `
    <nav class="crumbs"><a href="#/">Bosh sahifa</a> / <span>${esc(title)}</span></nav>
    <div class="catalog">
      <aside class="filters" id="filters">
        <div class="filter-block">
          <h4>Kategoriyalar</h4>
          <a class="filter-link ${!category ? 'active' : ''}" href="${link({ category: '', brand: '' })}">Barchasi</a>
          ${state.categories.map((c) => `<a class="filter-link ${c.slug === category ? 'active' : ''}" href="${link({ category: c.slug, brand: '' })}">
            ${esc(c.name)} <span class="muted">${c.product_count}</span></a>`).join('')}
        </div>
        <form id="filterForm">
          ${brands.length ? `<div class="filter-block"><h4>Brend</h4>
            ${brands.map((b) => `<label class="check"><input type="checkbox" name="brand" value="${esc(b)}" ${selBrands.includes(b) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}
          </div>` : ''}
          <div class="filter-block"><h4>Narx (so'm)</h4>
            <div class="price-inputs">
              <input class="input" type="number" name="min" min="0" placeholder="dan" value="${esc(query.get('min') || '')}">
              <input class="input" type="number" name="max" min="0" placeholder="gacha" value="${esc(query.get('max') || '')}">
            </div>
          </div>
          <div class="filter-block">
            <label class="check"><input type="checkbox" name="instock" value="1" ${query.get('instock') ? 'checked' : ''}> Faqat mavjudlari</label>
            <label class="check"><input type="checkbox" name="discount" value="1" ${query.get('discount') ? 'checked' : ''}> Chegirmadagilar</label>
          </div>
          <button class="btn btn-primary btn-block">Qo'llash</button>
          <a class="btn btn-block reset-link" href="#/catalog${category ? '?category=' + esc(category) : ''}">Tozalash</a>
        </form>
      </aside>
      <section class="catalog-main">
        <div class="catalog-top">
          <div><h1>${esc(title)}</h1><span class="muted">${data.total} ta mahsulot</span></div>
          <div class="row">
            <button class="btn btn-outline btn-sm filter-toggle" id="filterToggle">Filtrlar</button>
            <select class="input sort-select" id="sortSelect" aria-label="Saralash">
              ${[['popular', 'Ommabop'], ['newest', 'Yangilari'], ['price_asc', 'Arzonroq'], ['price_desc', 'Qimmatroq'], ['rating', 'Reyting'], ['discount', 'Chegirma']]
                .map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        ${data.items.length ? grid(data.items)
          : emptyState('search', 'Hech narsa topilmadi', "Filtrlarni o'zgartirib ko'ring yoki boshqa so'z bilan qidiring.", '<a class="btn btn-primary" href="#/catalog">Barcha mahsulotlar</a>')}
        ${data.pages > 1 ? `<nav class="pager">${Array.from({ length: data.pages }, (_, i) => i + 1)
          .map((n) => `<a href="${link({ page: n > 1 ? String(n) : '' })}" class="${n === page ? 'active' : ''}">${n}</a>`).join('')}</nav>` : ''}
      </section>
    </div>`;

  $('#sortSelect').onchange = (e) => { location.hash = link({ sort: e.target.value }); };
  $('#filterToggle').onclick = () => $('#filters').classList.toggle('open');
  $('#filterForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    location.hash = link({
      brand: f.getAll('brand').join(','),
      min: f.get('min'), max: f.get('max'),
      instock: f.get('instock') || '', discount: f.get('discount') || '',
    });
  };
}

async function pageProduct({ params: [slug] }) {
  const { product: p, reviews, related } = await api('/products/' + encodeURIComponent(slug));
  remember([p, ...related]);
  const d = discountPct(p);
  const specs = Object.entries(p.specs || {});
  const myReview = state.user && reviews.find((r) => r.user_id === state.user.id);

  app.innerHTML = `
    <nav class="crumbs"><a href="#/">Bosh sahifa</a> / ${p.category_slug ? `<a href="#/catalog?category=${esc(p.category_slug)}">${esc(p.category_name)}</a> / ` : ''}<span>${esc(p.name)}</span></nav>
    <div class="pdp">
      <div class="pdp-media">${productVisual(p, 160)}${d ? `<span class="tag tag-sale">−${d}%</span>` : ''}</div>
      <div class="pdp-info">
        ${p.brand ? `<span class="card-brand">${esc(p.brand)}</span>` : ''}
        <h1>${esc(p.name)}</h1>
        <div class="row small">${stars(p.rating, 16)} <span class="muted">${p.review_count ? `${p.rating} · ${p.review_count} ta sharh` : 'Hali sharh yo\'q'}</span></div>
        <div class="pdp-price">
          <span class="price">${money(p.price)}</span>
          ${d ? `<s class="old-price">${money(p.old_price)}</s><span class="save">Tejash: ${money(p.old_price - p.price)}</span>` : ''}
        </div>
        <div class="stock ${p.stock > 0 ? (p.stock <= 5 ? 'low' : 'ok') : 'out'}">
          ${p.stock > 0 ? (p.stock <= 5 ? `Kam qoldi: ${p.stock} dona` : 'Omborda mavjud') : 'Hozircha mavjud emas'}
        </div>
        ${p.stock > 0 ? `
        <div class="buy-row">
          <div class="qty" id="pdpQty"><button type="button" data-d="-1" aria-label="Kamaytirish">${icon('minus', 16)}</button><input type="number" value="1" min="1" max="${p.stock}" aria-label="Soni"><button type="button" data-d="1" aria-label="Ko'paytirish">${icon('plus', 16)}</button></div>
          <button class="btn btn-primary" id="addBtn">${icon('cart', 18)} Savatga qo'shish</button>
          <button class="btn btn-accent" id="buyBtn">Hoziroq sotib olish</button>
        </div>` : ''}
        <button class="btn btn-outline btn-sm wish-inline ${wish.has(p.id) ? 'active' : ''}" data-wish="${p.id}">${icon('heart', 16)} <span>${wish.has(p.id) ? 'Sevimlilarda' : 'Sevimlilarga qo\'shish'}</span></button>
        <ul class="pdp-perks">
          <li>${icon('truck', 18)} Toshkent bo'ylab yetkazib berish — 1 kun</li>
          <li>${icon('shield', 18)} Rasmiy kafolat — 12 oy</li>
        </ul>
      </div>
    </div>

    <div class="pdp-details">
      <section class="card-box">
        <h2>Tavsif</h2>
        <p class="desc">${esc(p.description || 'Tavsif qo\'shilmagan.')}</p>
        ${specs.length ? `<h2 class="mt">Xususiyatlar</h2><table class="specs">${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
      </section>
      <section class="card-box" id="reviews">
        <h2>Sharhlar <span class="muted">(${reviews.length})</span></h2>
        ${state.user ? `
          <form id="reviewForm" class="review-form">
            <div class="rate-pick" id="ratePick">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-r="${i}" aria-label="${i} yulduz">${icon('star', 24)}</button>`).join('')}</div>
            <textarea class="input" name="comment" maxlength="1000" placeholder="Mahsulot haqida fikringiz…">${esc(myReview?.comment || '')}</textarea>
            <button class="btn btn-primary btn-sm">${myReview ? 'Sharhni yangilash' : 'Sharh qoldirish'}</button>
          </form>`
          : `<p class="muted">Sharh qoldirish uchun <a class="link" href="#/login?next=${encodeURIComponent('/product/' + p.slug)}">tizimga kiring</a>.</p>`}
        <div class="review-list">
          ${reviews.map((r) => `
            <div class="review">
              <div class="row-between"><b>${esc(r.user_name)}</b><span class="muted small">${fmtDate(r.created_at)}</span></div>
              ${stars(r.rating)}
              ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
            </div>`).join('') || '<p class="muted">Birinchi bo\'lib sharh qoldiring.</p>'}
        </div>
      </section>
    </div>
    ${related.length ? section("O'xshash mahsulotlar", `#/catalog?category=${esc(p.category_slug)}`, grid(related)) : ''}`;

  const qtyInput = $('#pdpQty input');
  $('#pdpQty')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) qtyInput.value = Math.max(1, Math.min(p.stock, (Number(qtyInput.value) || 1) + Number(b.dataset.d)));
  });
  const qty = () => Math.max(1, Math.min(p.stock, Number(qtyInput.value) || 1));
  $('#addBtn')?.addEventListener('click', () => { cart.add(p, qty()); toast('Savatga qo\'shildi'); });
  $('#buyBtn')?.addEventListener('click', () => { cart.add(p, qty()); location.hash = '#/cart'; });

  const form = $('#reviewForm');
  if (form) {
    let rating = myReview?.rating || 0;
    const paint = () => $$('#ratePick button').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) <= rating));
    paint();
    $('#ratePick').onclick = (e) => { const b = e.target.closest('button'); if (b) { rating = Number(b.dataset.r); paint(); } };
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!rating) return toast('Iltimos, baho qo\'ying', 'err');
      try {
        await api(`/products/${p.id}/reviews`, { method: 'POST', body: { rating, comment: form.comment.value } });
        toast('Rahmat! Sharhingiz saqlandi');
        await pageProduct({ params: [slug] });
        $('#reviews').scrollIntoView({ behavior: 'smooth' });
      } catch (err) { toast(err.message, 'err'); }
    };
  }
}

async function refreshCart() {
  if (!cart.items.length) return;
  const { items } = await api('/products?limit=100&ids=' + cart.items.map((i) => i.id).join(','));
  const fresh = new Map(items.map((p) => [p.id, p]));
  cart.items = cart.items
    .filter((i) => fresh.has(i.id))
    .map((i) => {
      const p = fresh.get(i.id);
      return { ...snapshot(p), qty: Math.min(i.qty, Math.max(p.stock, 0)) };
    })
    .filter((i) => i.qty > 0);
  cart.save();
}

async function pageCart() {
  await refreshCart().catch(() => {});
  if (!cart.items.length) {
    app.innerHTML = emptyState('cart', 'Savatingiz bo\'sh', 'Katalogdan o\'zingizga yoqqan mahsulotlarni tanlang.', '<a class="btn btn-primary" href="#/catalog">Katalogga o\'tish</a>');
    return;
  }
  app.innerHTML = `
    <h1 class="page-title">Savat <span class="muted">(${cart.count()})</span></h1>
    <div class="cart-layout">
      <div class="card-box cart-list">
        ${cart.items.map((i) => `
          <div class="cart-item" data-id="${i.id}">
            <a href="#/product/${esc(i.slug)}" class="cart-thumb">${productVisual(i, 36)}</a>
            <div class="cart-info">
              <a href="#/product/${esc(i.slug)}" class="cart-name">${esc(i.name)}</a>
              <span class="muted small">${money(i.price)} / dona</span>
            </div>
            <div class="qty qty-sm"><button data-q="-1" aria-label="Kamaytirish">${icon('minus', 14)}</button><input type="number" value="${i.qty}" min="1" max="${i.stock}" aria-label="Soni"><button data-q="1" aria-label="Ko'paytirish">${icon('plus', 14)}</button></div>
            <b class="cart-sum">${money(i.price * i.qty)}</b>
            <button class="icon-btn" data-remove aria-label="O'chirish">${icon('trash', 18)}</button>
          </div>`).join('')}
      </div>
      <aside class="card-box summary">
        <h3>Buyurtma</h3>
        <div class="row-between"><span class="muted">Mahsulotlar (${cart.count()})</span><span>${money(cart.total())}</span></div>
        <div class="row-between"><span class="muted">Yetkazib berish</span><span class="free">Bepul</span></div>
        <div class="row-between total"><span>Jami</span><b>${money(cart.total())}</b></div>
        <a href="#/checkout" class="btn btn-accent btn-block">Rasmiylashtirish</a>
        <a href="#/catalog" class="btn btn-block reset-link">Xaridni davom ettirish</a>
      </aside>
    </div>`;

  $('.cart-list').addEventListener('click', (e) => {
    const row = e.target.closest('.cart-item');
    if (!row) return;
    const id = Number(row.dataset.id);
    const it = cart.items.find((x) => x.id === id);
    if (e.target.closest('[data-remove]')) { cart.remove(id); pageCart(); return; }
    const q = e.target.closest('[data-q]');
    if (q) { cart.set(id, it.qty + Number(q.dataset.q)); pageCart(); }
  });
  $('.cart-list').addEventListener('change', (e) => {
    const row = e.target.closest('.cart-item');
    if (row && e.target.matches('input')) { cart.set(Number(row.dataset.id), Number(e.target.value) || 1); pageCart(); }
  });
}

const REGIONS = ['Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', "Farg'ona", 'Jizzax', 'Namangan', 'Navoiy',
  'Qashqadaryo', "Qoraqalpog'iston", 'Samarqand', 'Sirdaryo', 'Surxondaryo', 'Xorazm'];

async function pageCheckout() {
  if (!state.user) { location.hash = '#/login?next=' + encodeURIComponent('/checkout'); return; }
  await refreshCart().catch(() => {});
  if (!cart.items.length) { location.hash = '#/cart'; return; }
  const u = state.user;

  app.innerHTML = `
    <h1 class="page-title">Buyurtmani rasmiylashtirish</h1>
    <form class="cart-layout" id="checkoutForm">
      <div class="card-box stack">
        <h3>Qabul qiluvchi</h3>
        <div class="grid-2">
          <label class="field"><span>Ism-familiya</span><input class="input" name="full_name" required value="${esc(u.name)}"></label>
          <label class="field"><span>Telefon</span><input class="input" name="phone" required type="tel" placeholder="+998 90 123 45 67" value="${esc(u.phone || '')}"></label>
        </div>
        <h3 class="mt">Yetkazib berish manzili</h3>
        <label class="field"><span>Viloyat / shahar</span>
          <select class="input" name="city" required>${REGIONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label class="field"><span>Manzil</span><input class="input" name="address" required placeholder="Tuman, ko'cha, uy, xonadon"></label>
        <label class="field"><span>Izoh (ixtiyoriy)</span><textarea class="input" name="note" maxlength="500" placeholder="Masalan: qo'ng'iroq qilib keling"></textarea></label>
        <h3 class="mt">To'lov usuli</h3>
        <div class="pay-options">
          ${Object.entries(PAYMENT).map(([v, l], i) => `
            <label class="pay-opt"><input type="radio" name="payment_method" value="${v}" ${i === 0 ? 'checked' : ''}>
              ${icon(v === 'cash' ? 'receipt' : 'card', 22)}<span>${esc(l)}</span></label>`).join('')}
        </div>
      </div>
      <aside class="card-box summary">
        <h3>Buyurtmangiz</h3>
        ${cart.items.map((i) => `<div class="row-between small"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
        <div class="row-between"><span class="muted">Yetkazib berish</span><span class="free">Bepul</span></div>
        <div class="row-between total"><span>Jami</span><b>${money(cart.total())}</b></div>
        <p class="form-error" id="checkoutError"></p>
        <button class="btn btn-accent btn-block" id="placeBtn">Buyurtma berish</button>
      </aside>
    </form>`;

  $('#checkoutForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('#placeBtn');
    btn.disabled = true;
    $('#checkoutError').textContent = '';
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: { ...f, items: cart.items.map((i) => ({ product_id: i.id, qty: i.qty })) },
      });
      cart.clear();
      location.hash = '#/order/' + order.id;
    } catch (err) {
      $('#checkoutError').textContent = err.message;
      btn.disabled = false;
    }
  };
}

function pageOrderDone({ params: [id] }) {
  app.innerHTML = `
    <div class="card-box done">
      <div class="done-ic">${icon('check', 40)}</div>
      <h1>Buyurtmangiz qabul qilindi!</h1>
      <p class="muted">Buyurtma raqami: <b>#${esc(id)}</b>. Operatorimiz tez orada siz bilan bog'lanadi.</p>
      <div class="row hero-cta" style="justify-content:center">
        <a href="#/account" class="btn btn-primary">Buyurtmalarim</a>
        <a href="#/catalog" class="btn btn-outline">Xaridni davom ettirish</a>
      </div>
    </div>`;
}

function afterLogin(user, next) {
  state.user = user;
  updateHeader();
  toast(`Xush kelibsiz, ${user.name.split(' ')[0]}!`);
  location.hash = '#' + (next || '/account');
}

function authPage(mode, query) {
  if (state.user) { location.hash = '#/account'; return; }
  const next = query.get('next') || '';
  const isLogin = mode === 'login';
  const nextQs = next ? '?next=' + encodeURIComponent(next) : '';

  app.innerHTML = `
    <div class="auth">
      <div class="card-box auth-card">
        <h1>${isLogin ? 'Hisobga kirish' : "Ro'yxatdan o'tish"}</h1>
        <p class="muted">${isLogin ? 'Buyurtmalaringizni kuzatish uchun tizimga kiring' : 'Bir daqiqada hisob yarating'}</p>
        <div id="gbtn" class="gbtn"></div>
        <div class="divider">yoki email orqali</div>
        <form id="authForm" class="stack">
          ${isLogin ? '' : '<label class="field"><span>Ism</span><input class="input" name="name" required autocomplete="name"></label>'}
          <label class="field"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
          <label class="field"><span>Parol</span><input class="input" name="password" type="password" required minlength="${isLogin ? 1 : 6}" autocomplete="${isLogin ? 'current-password' : 'new-password'}"></label>
          <p class="form-error" id="authError"></p>
          <button class="btn btn-primary btn-block">${isLogin ? 'Kirish' : "Ro'yxatdan o'tish"}</button>
        </form>
        <p class="center small mt">${isLogin
          ? `Hisobingiz yo'qmi? <a class="link" href="#/register${nextQs}">Ro'yxatdan o'ting</a>`
          : `Hisobingiz bormi? <a class="link" href="#/login${nextQs}">Kirish</a>`}</p>
      </div>
    </div>`;

  renderSocialLogin($('#gbtn'), state.config, '/#' + (next || '/account'), async (credential) => {
    try {
      const { user } = await api('/auth/google', { method: 'POST', body: { credential } });
      afterLogin(user, next);
    } catch (err) { $('#authError').textContent = err.message; }
  });

  $('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const { user } = await api('/auth/' + (isLogin ? 'login' : 'register'), { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      afterLogin(user, next);
    } catch (err) {
      $('#authError').textContent = err.message;
      btn.disabled = false;
    }
  };
}

async function pageAccount({ query }) {
  if (!state.user) { location.hash = '#/login?next=' + encodeURIComponent('/account'); return; }
  const tab = query.get('tab') || 'orders';
  const u = state.user;
  const { orders } = tab === 'orders' ? await api('/orders/my') : { orders: [] };

  app.innerHTML = `
    <div class="account">
      <aside class="card-box account-side">
        <div class="account-user">
          ${u.avatar ? `<img class="avatar-lg" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<div class="avatar-lg">${esc(u.name[0] || '?').toUpperCase()}</div>`}
          <div><b>${esc(u.name)}</b><span class="muted small">${esc(u.email)}</span></div>
        </div>
        <nav class="account-nav">
          <a href="#/account" class="${tab === 'orders' ? 'active' : ''}">${icon('box', 18)} Buyurtmalarim</a>
          <a href="#/account?tab=profile" class="${tab === 'profile' ? 'active' : ''}">${icon('user', 18)} Shaxsiy ma'lumotlar</a>
          <a href="#/wishlist">${icon('heart', 18)} Sevimlilar</a>
          ${u.role === 'admin' ? `<a href="/admin/">${icon('chart', 18)} Admin panel</a>` : ''}
          <button id="logoutBtn">${icon('logout', 18)} Chiqish</button>
        </nav>
      </aside>
      <section class="account-main">
        ${tab === 'profile' ? `
          <div class="card-box">
            <h2>Shaxsiy ma'lumotlar</h2>
            <form id="profileForm" class="stack mt">
              <div class="grid-2">
                <label class="field"><span>Ism</span><input class="input" name="name" required value="${esc(u.name)}"></label>
                <label class="field"><span>Telefon</span><input class="input" name="phone" type="tel" value="${esc(u.phone || '')}"></label>
              </div>
              <label class="field"><span>Email</span><input class="input" value="${esc(u.email)}" disabled></label>
              ${u.has_google ? `<p class="small muted">${icon('check', 14)} Google hisobi ulangan</p>` : ''}
              <button class="btn btn-primary">Saqlash</button>
            </form>
          </div>`
        : `
          <h2 class="page-title">Buyurtmalarim</h2>
          ${orders.length ? orders.map((o) => `
            <article class="card-box order">
              <div class="row-between order-head">
                <div><b>Buyurtma #${o.id}</b><span class="muted small"> · ${fmtDate(o.created_at, true)}</span></div>
                ${statusBadge(o.status)}
              </div>
              <div class="order-items">${o.items.map((i) => `
                <div class="order-item">
                  <div class="cart-thumb sm">${productVisual(i, 22)}</div>
                  <span>${i.slug ? `<a href="#/product/${esc(i.slug)}">${esc(i.name)}</a>` : esc(i.name)} × ${i.qty}</span>
                  <span class="muted">${money(i.price * i.qty)}</span>
                </div>`).join('')}</div>
              <div class="row-between order-foot">
                <span class="muted small">${esc(o.city)}, ${esc(o.address)} · ${esc(PAYMENT[o.payment_method] || o.payment_method)}</span>
                <div class="row"><b>${money(o.total)}</b>
                  ${o.status === 'new' ? `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">Bekor qilish</button>` : ''}</div>
              </div>
            </article>`).join('')
          : emptyState('box', "Hali buyurtma yo'q", 'Birinchi xaridingizni hoziroq qiling!', '<a class="btn btn-primary" href="#/catalog">Katalog</a>')}`}
      </section>
    </div>`;

  $('#logoutBtn').onclick = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    updateHeader();
    location.hash = '#/';
  };
  $('#profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/auth/me', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      state.user = user;
      updateHeader();
      toast('Saqlandi');
    } catch (err) { toast(err.message, 'err'); }
  });
  app.querySelectorAll('[data-cancel]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Buyurtmani bekor qilmoqchimisiz?')) return;
      try {
        await api(`/orders/${b.dataset.cancel}/cancel`, { method: 'POST' });
        toast('Buyurtma bekor qilindi');
        pageAccount({ query });
      } catch (err) { toast(err.message, 'err'); }
    };
  });
}

async function pageWishlist() {
  if (!wish.ids.length) {
    app.innerHTML = emptyState('heart', "Sevimlilar ro'yxati bo'sh", "Mahsulotdagi ♥ belgisini bosib, uni shu yerga saqlang.", '<a class="btn btn-primary" href="#/catalog">Katalog</a>');
    return;
  }
  const { items } = await api('/products?limit=100&ids=' + wish.ids.join(','));
  remember(items);
  app.innerHTML = `<h1 class="page-title">Sevimlilar <span class="muted">(${items.length})</span></h1>${grid(items)}`;
}

/* ================= Router ================= */

const routes = [
  [/^\/$/, pageHome],
  [/^\/catalog$/, pageCatalog],
  [/^\/product\/([^/]+)$/, pageProduct],
  [/^\/cart$/, pageCart],
  [/^\/checkout$/, pageCheckout],
  [/^\/order\/(\d+)$/, pageOrderDone],
  [/^\/login$/, ({ query }) => authPage('login', query)],
  [/^\/register$/, ({ query }) => authPage('register', query)],
  [/^\/account$/, pageAccount],
  [/^\/wishlist$/, pageWishlist],
];

let lastPath = null;
async function router() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const query = new URLSearchParams(qs || '');
  $('#searchForm').q.value = path === '/catalog' ? query.get('q') || '' : '';
  $$('.cat-link').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === location.hash));

  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (path !== lastPath) { app.innerHTML = '<div class="loader"></div>'; window.scrollTo(0, 0); }
    lastPath = path;
    try {
      await fn({ params: m.slice(1).map(decodeURIComponent), query });
    } catch (err) {
      app.innerHTML = emptyState('x', 'Xatolik', err.message, '<a class="btn btn-primary" href="#/">Bosh sahifa</a>');
    }
    return;
  }
  app.innerHTML = emptyState('search', 'Sahifa topilmadi', "Bunday sahifa mavjud emas.", '<a class="btn btn-primary" href="#/">Bosh sahifa</a>');
}

/* ================= Global hodisalar ================= */

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add-cart]');
  if (add) {
    const p = productCache.get(Number(add.dataset.addCart));
    if (p) { cart.add(p); toast('Savatga qo\'shildi'); }
    return;
  }
  const w = e.target.closest('[data-wish]');
  if (w) {
    const on = wish.toggle(Number(w.dataset.wish));
    w.classList.toggle('active', on);
    const label = w.querySelector('span');
    if (label) label.textContent = on ? 'Sevimlilarda' : 'Sevimlilarga qo\'shish';
    toast(on ? 'Sevimlilarga qo\'shildi' : 'Sevimlilardan olib tashlandi');
  }
});

$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  location.hash = '#/catalog' + (q ? '?q=' + encodeURIComponent(q) : '');
});
$('#searchForm .search-btn').innerHTML = icon('search', 20);
$('#year').textContent = new Date().getFullYear();

async function boot() {
  updateHeader();
  try {
    const [config, me, cats] = await Promise.all([api('/config'), api('/auth/me'), api('/categories')]);
    state.config = config;
    state.user = me.user;
    state.categories = cats.categories;
  } catch (err) {
    toast('Server bilan bog\'lanib bo\'lmadi', 'err');
  }
  updateHeader();
  renderCatNav();
  window.addEventListener('hashchange', router);
  router();
}

boot();
