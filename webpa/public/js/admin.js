import {
  $, $$, esc, money, fmtDate, api, icon, productVisual, toast, statusBadge, openModal,
  renderSocialLogin, ORDER_STATUS, PAYMENT,
} from './common.js';

const root = $('#root');
const state = { user: null, config: {}, categories: [] };

/* ================= Kirish ================= */

function renderLogin(message = '') {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand"><span class="logo-mark">w</span><b>webpa</b><span class="badge badge-gray">Admin</span></div>
        <h1>Admin panelga kirish</h1>
        ${message ? `<p class="form-error">${esc(message)}</p>` : ''}
        <form id="loginForm" class="stack">
          <label class="field"><span>Email</span><input class="input" name="email" type="email" required autocomplete="username"></label>
          <label class="field"><span>Parol</span><input class="input" name="password" type="password" required autocomplete="current-password"></label>
          <p class="form-error" id="loginError"></p>
          <button class="btn btn-primary btn-block">Kirish</button>
        </form>
        <div class="divider">yoki</div>
        <div id="gbtn" class="gbtn"></div>
        <a href="/" class="btn btn-block back-link">← Do'konga qaytish</a>
      </div>
    </div>`;

  const done = (user) => {
    if (user.role !== 'admin') {
      renderLogin(`${user.email} hisobida admin huquqi yo'q.`);
      return;
    }
    state.user = user;
    renderShell();
  };

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      done(user);
    } catch (err) { $('#loginError').textContent = err.message; }
  };
  renderSocialLogin($('#gbtn'), state.config, '/admin/', async (credential) => {
    try {
      const { user } = await api('/auth/google', { method: 'POST', body: { credential } });
      done(user);
    } catch (err) { $('#loginError').textContent = err.message; }
  });
}

/* ================= Asosiy qobiq ================= */

const NAV = [
  ['dashboard', 'Boshqaruv paneli', 'chart'],
  ['orders', 'Buyurtmalar', 'receipt'],
  ['products', 'Mahsulotlar', 'box'],
  ['categories', 'Kategoriyalar', 'grid'],
  ['users', 'Foydalanuvchilar', 'users'],
];

function renderShell() {
  const u = state.user;
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <a href="#/dashboard" class="brand"><span class="logo-mark">w</span><b>webpa</b><span class="badge badge-gray">Admin</span></a>
        <nav class="side-nav">
          ${NAV.map(([k, label, ic]) => `<a href="#/${k}" data-nav="${k}">${icon(ic, 19)}<span>${label}</span><b class="nav-count" id="cnt-${k}"></b></a>`).join('')}
        </nav>
        <div class="side-foot">
          <a href="/" target="_blank" rel="noopener">${icon('store', 19)}<span>Do'konni ochish</span></a>
          <button id="logoutBtn">${icon('logout', 19)}<span>Chiqish</span></button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menyu">${icon('menu')}</button>
          <h1 id="pageTitle"></h1>
          <div class="topbar-user">
            ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="ava">${esc(u.name[0] || 'A').toUpperCase()}</span>`}
            <div><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
          </div>
        </header>
        <main id="view" class="view"></main>
      </div>
    </div>`;

  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#logoutBtn').onclick = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    renderLogin();
  };
  if (!routeBound) { window.addEventListener('hashchange', route); routeBound = true; }
  route();
}
let routeBound = false;

async function refreshNewOrdersBadge() {
  try {
    const { orders } = await api('/admin/orders?status=new');
    const el = $('#cnt-orders');
    if (el) el.textContent = orders.length || '';
  } catch { /* ahamiyatsiz */ }
}

const PAGES = { dashboard: pageDashboard, orders: pageOrders, products: pageProducts, categories: pageCategories, users: pageUsers };

async function route() {
  if (!state.user) return;
  const [path, qs] = (location.hash.slice(2) || 'dashboard').split('?');
  const key = PAGES[path] ? path : 'dashboard';
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  $('#sidebar').classList.remove('open');
  $('#pageTitle').textContent = NAV.find((n) => n[0] === key)[1];
  const view = $('#view');
  view.innerHTML = '<div class="loader"></div>';
  try {
    await PAGES[key](view, new URLSearchParams(qs || ''));
  } catch (err) {
    if (err.status === 401 || err.status === 403) { state.user = null; renderLogin(err.message); return; }
    view.innerHTML = `<div class="empty"><h3>Xatolik</h3><p>${esc(err.message)}</p></div>`;
  }
  refreshNewOrdersBadge();
}

/* ================= Boshqaruv paneli ================= */

function revenueChart(daily) {
  const days = [];
  const byDay = new Map(daily.map((d) => [d.day, d]));
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`, revenue: byDay.get(key)?.revenue || 0, orders: byDay.get(key)?.orders || 0 });
  }
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const W = 700, H = 220, pad = 28, bw = (W - pad) / days.length;
  const bars = days.map((d, i) => {
    const h = Math.max((d.revenue / max) * (H - 40), d.revenue ? 4 : 2);
    const x = pad + i * bw + bw * 0.18;
    return `<g><title>${d.label}: ${money(d.revenue)} (${d.orders} ta buyurtma)</title>
      <rect x="${x}" y="${H - 20 - h}" width="${bw * 0.64}" height="${h}" rx="5" class="${d.revenue ? 'bar' : 'bar-empty'}"/>
      <text x="${x + bw * 0.32}" y="${H - 4}" text-anchor="middle" class="axis">${i % 2 ? '' : d.label}</text></g>`;
  }).join('');
  const total = days.reduce((s, d) => s + d.revenue, 0);
  return `<div class="row-between"><h3>So'nggi 14 kunlik savdo</h3><b>${money(total)}</b></div>
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Kunlik savdo diagrammasi">
      <line x1="${pad}" x2="${W}" y1="${H - 20}" y2="${H - 20}" class="grid-line"/>${bars}</svg>`;
}

async function pageDashboard(view) {
  const s = await api('/admin/stats');
  const t = s.totals;
  const statusCount = Object.fromEntries(s.byStatus.map((b) => [b.status, b.count]));
  const card = (label, value, ic, cls, sub = '') => `
    <div class="stat"><div class="stat-ic ${cls}">${icon(ic, 22)}</div>
      <div><span class="muted small">${label}</span><b>${value}</b>${sub ? `<span class="small muted">${sub}</span>` : ''}</div></div>`;

  view.innerHTML = `
    <div class="stats">
      ${card('Umumiy daromad', money(t.revenue), 'chart', 'c-violet', `Shu oy: ${money(t.revenueMonth)}`)}
      ${card('Buyurtmalar', t.orders, 'receipt', 'c-blue', `${t.newOrders} ta yangi`)}
      ${card('Mijozlar', t.users, 'users', 'c-green')}
      ${card('Mahsulotlar', t.products, 'box', 'c-amber')}
    </div>
    <div class="dash-grid">
      <section class="card-box">${revenueChart(s.daily)}</section>
      <section class="card-box">
        <h3>Buyurtma holatlari</h3>
        <div class="status-list">
          ${Object.entries(ORDER_STATUS).map(([k, v]) => `
            <a href="#/orders?status=${k}" class="row-between"><span>${statusBadge(k)}</span><b>${statusCount[k] || 0}</b></a>`).join('')}
        </div>
      </section>
      <section class="card-box">
        <div class="row-between"><h3>So'nggi buyurtmalar</h3><a class="link" href="#/orders">Barchasi</a></div>
        ${s.recentOrders.length ? `<table class="table compact"><tbody>${s.recentOrders.map((o) => `
          <tr class="clickable" data-order="${o.id}"><td><b>#${o.id}</b></td><td>${esc(o.full_name)}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted mt">Hali buyurtmalar yo\'q.</p>'}
      </section>
      <section class="card-box">
        <h3>Eng ko'p sotilganlar</h3>
        ${s.topProducts.length ? `<ol class="top-list">${s.topProducts.map((p) => `
          <li><span>${esc(p.name)}</span><span class="muted small">${p.qty} dona · ${money(p.revenue)}</span></li>`).join('')}</ol>`
          : '<p class="muted mt">Ma\'lumot yo\'q.</p>'}
      </section>
      <section class="card-box">
        <div class="row-between"><h3>Kam qolgan mahsulotlar</h3><a class="link" href="#/products">Ombor</a></div>
        ${s.lowStock.length ? `<div class="status-list">${s.lowStock.map((p) => `
          <div class="row-between"><span>${esc(p.name)}</span><span class="badge ${p.stock ? 'badge-amber' : 'badge-red'}">${p.stock} dona</span></div>`).join('')}</div>`
          : '<p class="muted mt">Hammasi yetarli.</p>'}
      </section>
    </div>`;

  view.querySelectorAll('[data-order]').forEach((tr) => { tr.onclick = () => showOrder(Number(tr.dataset.order)); });
}

/* ================= Buyurtmalar ================= */

async function pageOrders(view, query) {
  const status = query.get('status') || '';
  const q = query.get('q') || '';
  const { orders } = await api(`/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);

  view.innerHTML = `
    <div class="toolbar">
      <div class="tabs">
        <a href="#/orders${q ? '?q=' + encodeURIComponent(q) : ''}" class="${!status ? 'active' : ''}">Barchasi</a>
        ${Object.entries(ORDER_STATUS).map(([k, v]) => `<a href="#/orders?status=${k}${q ? '&q=' + encodeURIComponent(q) : ''}" class="${status === k ? 'active' : ''}">${v.label}</a>`).join('')}
      </div>
      <form id="orderSearch" class="search-inline"><input class="input" name="q" placeholder="№, ism, telefon yoki email" value="${esc(q)}"></form>
    </div>
    <div class="card-box table-wrap">
      ${orders.length ? `<table class="table">
        <thead><tr><th>№</th><th>Mijoz</th><th>Telefon</th><th>Mahsulot</th><th>Summa</th><th>To'lov</th><th>Sana</th><th>Holat</th><th></th></tr></thead>
        <tbody>${orders.map((o) => `
          <tr>
            <td><b>#${o.id}</b></td>
            <td>${esc(o.full_name)}<div class="muted small">${esc(o.user_email || '')}</div></td>
            <td><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></td>
            <td>${o.item_count} dona</td>
            <td><b>${money(o.total)}</b></td>
            <td class="small">${esc(PAYMENT[o.payment_method] || o.payment_method)}</td>
            <td class="small muted">${fmtDate(o.created_at, true)}</td>
            <td>${o.status === 'cancelled' ? statusBadge('cancelled') : `<select class="input status-select" data-status="${o.id}">
              ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>`}</td>
            <td><button class="icon-btn" data-view="${o.id}" aria-label="Ko'rish">${icon('eye', 18)}</button></td>
          </tr>`).join('')}</tbody></table>`
        : '<div class="empty"><h3>Buyurtmalar topilmadi</h3></div>'}
    </div>`;

  $('#orderSearch').onsubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (e.target.q.value.trim()) p.set('q', e.target.q.value.trim());
    location.hash = '#/orders' + (p.toString() ? '?' + p : '');
  };
  view.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => showOrder(Number(b.dataset.view)); });
  view.querySelectorAll('[data-status]').forEach((sel) => {
    const prev = sel.value;
    sel.onchange = async () => {
      if (sel.value === 'cancelled' && !confirm('Buyurtmani bekor qilasizmi? Mahsulotlar omborga qaytariladi.')) { sel.value = prev; return; }
      try {
        await api(`/admin/orders/${sel.dataset.status}/status`, { method: 'PUT', body: { status: sel.value } });
        toast('Holat yangilandi');
        route();
      } catch (err) { toast(err.message, 'err'); sel.value = prev; }
    };
  });
}

async function showOrder(id) {
  let o;
  try { ({ order: o } = await api('/admin/orders/' + id)); } catch (err) { toast(err.message, 'err'); return; }
  openModal(`Buyurtma #${o.id}`, `
    <div class="order-meta">
      <div><span class="muted small">Holat</span>${statusBadge(o.status)}</div>
      <div><span class="muted small">Sana</span><b>${fmtDate(o.created_at, true)}</b></div>
      <div><span class="muted small">Mijoz</span><b>${esc(o.full_name)}</b><span class="small muted">${esc(o.user_email || '')}</span></div>
      <div><span class="muted small">Telefon</span><a class="link" href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
      <div class="span-2"><span class="muted small">Manzil</span><b>${esc(o.city)}, ${esc(o.address)}</b></div>
      <div><span class="muted small">To'lov</span><b>${esc(PAYMENT[o.payment_method] || o.payment_method)}</b></div>
      ${o.note ? `<div class="span-2"><span class="muted small">Izoh</span><span>${esc(o.note)}</span></div>` : ''}
    </div>
    <table class="table compact mt">
      <thead><tr><th>Mahsulot</th><th>Narx</th><th>Soni</th><th>Jami</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${money(i.price)}</td><td>${i.qty}</td><td><b>${money(i.price * i.qty)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3"><b>Umumiy</b></td><td><b>${money(o.total)}</b></td></tr></tfoot>
    </table>`, { wide: true });
}

/* ================= Mahsulotlar ================= */

async function loadCategories() {
  const { categories, icons } = await api('/admin/categories');
  state.categories = categories;
  state.icons = icons;
  return categories;
}

async function pageProducts(view, query) {
  const q = query.get('q') || '';
  const cat = query.get('category') || '';
  const [{ items }] = await Promise.all([
    api(`/admin/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`),
    loadCategories(),
  ]);

  view.innerHTML = `
    <div class="toolbar">
      <form id="prodFilter" class="row wrap">
        <input class="input" name="q" placeholder="Nomi yoki brend…" value="${esc(q)}">
        <select class="input" name="category"><option value="">Barcha kategoriyalar</option>
          ${state.categories.map((c) => `<option value="${c.id}" ${String(c.id) === cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <button class="btn btn-outline">Qidirish</button>
      </form>
      <button class="btn btn-primary" id="newProduct">${icon('plus', 18)} Yangi mahsulot</button>
    </div>
    <div class="card-box table-wrap">
      ${items.length ? `<table class="table">
        <thead><tr><th></th><th>Nomi</th><th>Kategoriya</th><th>Narx</th><th>Ombor</th><th>Holat</th><th></th></tr></thead>
        <tbody>${items.map((p) => `
          <tr>
            <td><div class="thumb">${productVisual(p, 22)}</div></td>
            <td><b>${esc(p.name)}</b><div class="muted small">${esc(p.brand || '')}</div></td>
            <td>${esc(p.category_name || '—')}</td>
            <td><b>${money(p.price)}</b>${p.old_price ? `<div class="muted small"><s>${money(p.old_price)}</s></div>` : ''}</td>
            <td><span class="badge ${p.stock === 0 ? 'badge-red' : p.stock <= 5 ? 'badge-amber' : 'badge-green'}">${p.stock} dona</span></td>
            <td>${p.active ? '<span class="badge badge-green">Faol</span>' : '<span class="badge badge-gray">Yashirin</span>'}
                ${p.featured ? '<span class="badge badge-violet">Tavsiya</span>' : ''}</td>
            <td class="actions">
              ${p.active ? `<a class="icon-btn" href="/#/product/${esc(p.slug)}" target="_blank" rel="noopener" aria-label="Do'konda ko'rish">${icon('eye', 18)}</a>` : ''}
              <button class="icon-btn" data-edit="${p.id}" aria-label="Tahrirlash">${icon('edit', 18)}</button>
              <button class="icon-btn danger" data-del="${p.id}" data-name="${esc(p.name)}" aria-label="O'chirish">${icon('trash', 18)}</button>
            </td>
          </tr>`).join('')}</tbody></table>`
        : '<div class="empty"><h3>Mahsulotlar topilmadi</h3></div>'}
    </div>`;

  $('#prodFilter').onsubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(e.target)) if (v) p.set(k, v);
    location.hash = '#/products' + (p.toString() ? '?' + p : '');
  };
  $('#newProduct').onclick = () => productForm(null);
  view.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = async () => productForm((await api('/admin/products/' + b.dataset.edit)).product);
  });
  view.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm(`"${b.dataset.name}" butunlay o'chirilsinmi? Buni qaytarib bo'lmaydi.\n(Vaqtincha yashirish uchun "Faol" belgisini olib tashlang.)`)) return;
      try {
        await api('/admin/products/' + b.dataset.del, { method: 'DELETE' });
        toast('Mahsulot o\'chirildi');
        route();
      } catch (err) { toast(err.message, 'err'); }
    };
  });
}

function productForm(p) {
  const specs = Object.entries(p?.specs || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  const { el, close } = openModal(p ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot', `
    <form id="pform" class="stack">
      <div class="img-row">
        <div class="img-preview" id="imgPreview"></div>
        <div class="stack grow">
          <label class="field"><span>Rasm</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="imgFile" class="input file-input"></label>
          <label class="field"><span>yoki rasm havolasi (https://…)</span>
            <input class="input" name="image" value="${esc(p?.image || '')}" placeholder="https://…"></label>
        </div>
      </div>
      <label class="field"><span>Nomi *</span><input class="input" name="name" required value="${esc(p?.name || '')}"></label>
      <div class="grid-2">
        <label class="field"><span>Brend</span><input class="input" name="brand" value="${esc(p?.brand || '')}"></label>
        <label class="field"><span>Kategoriya</span><select class="input" name="category_id"><option value="">— tanlanmagan —</option>
          ${state.categories.map((c) => `<option value="${c.id}" ${c.id === p?.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>Narx (so'm) *</span><input class="input" name="price" type="number" min="1" required value="${p?.price ?? ''}"></label>
        <label class="field"><span>Eski narx</span><input class="input" name="old_price" type="number" min="1" value="${p?.old_price ?? ''}"></label>
        <label class="field"><span>Ombordagi soni</span><input class="input" name="stock" type="number" min="0" value="${p?.stock ?? 0}"></label>
      </div>
      <label class="field"><span>Tavsif</span><textarea class="input" name="description" rows="4">${esc(p?.description || '')}</textarea></label>
      <label class="field"><span>Xususiyatlar (har qatorda "Nomi: qiymati")</span>
        <textarea class="input mono" name="specs" rows="5" placeholder="Ekran: 6.7&quot; AMOLED&#10;Xotira: 256 GB">${esc(specs)}</textarea></label>
      <div class="row wrap">
        <label class="check"><input type="checkbox" name="active" ${p?.active === false ? '' : 'checked'}> Faol (do'konda ko'rinadi)</label>
        <label class="check"><input type="checkbox" name="featured" ${p?.featured ? 'checked' : ''}> Tavsiya etilgan</label>
      </div>
      <p class="form-error" id="pformError"></p>
      <div class="row modal-actions">
        <button type="button" class="btn btn-outline" data-close>Bekor qilish</button>
        <button class="btn btn-primary">${p ? 'Saqlash' : 'Qo\'shish'}</button>
      </div>
    </form>`, { wide: true });

  const form = $('#pform', el);
  const preview = () => {
    const url = form.image.value.trim();
    $('#imgPreview', el).innerHTML = productVisual({ image: url, name: '', category_icon: state.categories.find((c) => String(c.id) === form.category_id.value)?.icon }, 40);
  };
  preview();
  form.image.oninput = preview;
  form.category_id.onchange = preview;

  $('#imgFile', el).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { url } = await api('/admin/upload', { method: 'POST', form: fd });
      form.image.value = url;
      preview();
      toast('Rasm yuklandi');
    } catch (err) { toast(err.message, 'err'); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const specsObj = {};
    for (const line of String(f.get('specs')).split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) specsObj[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const body = {
      name: f.get('name'), brand: f.get('brand'), category_id: f.get('category_id') || null,
      price: f.get('price'), old_price: f.get('old_price'), stock: f.get('stock'),
      description: f.get('description'), image: f.get('image'), specs: specsObj,
      active: form.active.checked, featured: form.featured.checked,
    };
    try {
      await api(p ? `/admin/products/${p.id}` : '/admin/products', { method: p ? 'PUT' : 'POST', body });
      toast(p ? 'Saqlandi' : 'Mahsulot qo\'shildi');
      close();
      route();
    } catch (err) { $('#pformError', el).textContent = err.message; }
  };
}

/* ================= Kategoriyalar ================= */

async function pageCategories(view) {
  const categories = await loadCategories();
  view.innerHTML = `
    <div class="toolbar"><span class="muted">${categories.length} ta kategoriya</span>
      <button class="btn btn-primary" id="newCat">${icon('plus', 18)} Yangi kategoriya</button></div>
    <div class="card-box table-wrap">
      <table class="table">
        <thead><tr><th></th><th>Nomi</th><th>Slug</th><th>Tartib</th><th>Mahsulotlar</th><th></th></tr></thead>
        <tbody>${categories.map((c) => `
          <tr>
            <td><div class="cat-ic ph-${esc(c.icon)}">${icon(c.icon, 20)}</div></td>
            <td><b>${esc(c.name)}</b></td>
            <td class="muted small">${esc(c.slug)}</td>
            <td>${c.sort}</td>
            <td><a class="link" href="#/products?category=${c.id}">${c.product_count} ta</a></td>
            <td class="actions">
              <button class="icon-btn" data-edit="${c.id}" aria-label="Tahrirlash">${icon('edit', 18)}</button>
              <button class="icon-btn danger" data-del="${c.id}" aria-label="O'chirish">${icon('trash', 18)}</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;

  $('#newCat').onclick = () => categoryForm(null);
  view.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => categoryForm(categories.find((c) => c.id === Number(b.dataset.edit)));
  });
  view.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const c = categories.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`"${c.name}" kategoriyasi o'chirilsinmi?${c.product_count ? `\n${c.product_count} ta mahsulot kategoriyasiz qoladi.` : ''}`)) return;
      try {
        await api('/admin/categories/' + c.id, { method: 'DELETE' });
        toast('Kategoriya o\'chirildi');
        route();
      } catch (err) { toast(err.message, 'err'); }
    };
  });
}

function categoryForm(c) {
  const { el, close } = openModal(c ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya', `
    <form id="cform" class="stack">
      <label class="field"><span>Nomi</span><input class="input" name="name" required value="${esc(c?.name || '')}"></label>
      <div class="field"><span>Ikonka</span>
        <div class="icon-pick">${state.icons.map((ic) => `
          <label><input type="radio" name="icon" value="${ic}" ${ic === (c?.icon || 'default') ? 'checked' : ''}>
            <span class="cat-ic ph-${ic}">${icon(ic, 20)}</span></label>`).join('')}</div>
      </div>
      <label class="field"><span>Tartib raqami (kichigi oldinda)</span><input class="input" name="sort" type="number" value="${c?.sort ?? 0}"></label>
      <p class="form-error" id="cformError"></p>
      <div class="row modal-actions">
        <button type="button" class="btn btn-outline" data-close>Bekor qilish</button>
        <button class="btn btn-primary">Saqlash</button>
      </div>
    </form>`);
  $('#cform', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(c ? `/admin/categories/${c.id}` : '/admin/categories', { method: c ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(e.target)) });
      toast('Saqlandi');
      close();
      route();
    } catch (err) { $('#cformError', el).textContent = err.message; }
  };
}

/* ================= Foydalanuvchilar ================= */

async function pageUsers(view, query) {
  const q = query.get('q') || '';
  const { users } = await api('/admin/users?q=' + encodeURIComponent(q));
  view.innerHTML = `
    <div class="toolbar">
      <form id="userSearch" class="search-inline"><input class="input" name="q" placeholder="Ism, email yoki telefon" value="${esc(q)}"></form>
      <span class="muted">${users.length} ta foydalanuvchi</span>
    </div>
    <div class="card-box table-wrap">
      <table class="table">
        <thead><tr><th>Foydalanuvchi</th><th>Telefon</th><th>Kirish usuli</th><th>Buyurtmalar</th><th>Xaridlar</th><th>Ro'yxatdan o'tgan</th><th>Rol</th></tr></thead>
        <tbody>${users.map((u) => `
          <tr>
            <td><div class="user-cell">
              ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="ava">${esc(u.name[0] || '?').toUpperCase()}</span>`}
              <div><b>${esc(u.name)}</b><div class="muted small">${esc(u.email)}</div></div></div></td>
            <td>${esc(u.phone || '—')}</td>
            <td>${u.has_google ? '<span class="badge badge-blue">Google</span> ' : ''}${u.has_password ? '<span class="badge badge-gray">Parol</span>' : ''}</td>
            <td>${u.order_count}</td>
            <td><b>${money(u.spent)}</b></td>
            <td class="small muted">${fmtDate(u.created_at)}</td>
            <td>${u.id === state.user.id ? '<span class="badge badge-violet">Admin (siz)</span>'
              : `<select class="input status-select" data-role="${u.id}">
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>Mijoz</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select>`}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;

  $('#userSearch').onsubmit = (e) => {
    e.preventDefault();
    const v = e.target.q.value.trim();
    location.hash = '#/users' + (v ? '?q=' + encodeURIComponent(v) : '');
  };
  view.querySelectorAll('[data-role]').forEach((sel) => {
    const prev = sel.value;
    sel.onchange = async () => {
      if (sel.value === 'admin' && !confirm('Bu foydalanuvchiga admin panelga to\'liq kirish huquqi beriladi. Davom etasizmi?')) { sel.value = prev; return; }
      try {
        await api(`/admin/users/${sel.dataset.role}/role`, { method: 'PUT', body: { role: sel.value } });
        toast('Rol yangilandi');
      } catch (err) { toast(err.message, 'err'); sel.value = prev; }
    };
  });
}

/* ================= Ishga tushirish ================= */

async function boot() {
  try {
    const [config, me] = await Promise.all([api('/config'), api('/auth/me')]);
    state.config = config;
    state.user = me.user;
  } catch {
    root.innerHTML = '<div class="empty"><h3>Server bilan bog\'lanib bo\'lmadi</h3></div>';
    return;
  }
  if (state.user?.role === 'admin') renderShell();
  else renderLogin(state.user ? `${state.user.email} hisobida admin huquqi yo'q.` : '');
}

boot();
