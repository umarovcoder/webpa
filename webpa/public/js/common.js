// Do'kon va admin panel uchun umumiy yordamchi funksiyalar

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const money = (n) => `${String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;

export const fmtDate = (s, withTime = false) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return withTime ? `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'webpa' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Xatolik yuz berdi');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const ORDER_STATUS = {
  new: { label: 'Yangi', cls: 'blue' },
  confirmed: { label: 'Tasdiqlangan', cls: 'violet' },
  shipping: { label: 'Yetkazilmoqda', cls: 'amber' },
  delivered: { label: 'Yetkazildi', cls: 'green' },
  cancelled: { label: 'Bekor qilingan', cls: 'red' },
};
export const PAYMENT = { cash: 'Naqd pul', card: 'Karta orqali (kuryerga)' };

export const statusBadge = (s) => {
  const st = ORDER_STATUS[s] || { label: s, cls: 'gray' };
  return `<span class="badge badge-${st.cls}">${esc(st.label)}</span>`;
};

const svg = (inner, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICON_PATHS = {
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20l-1.5-4h-17z"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  watch: '<circle cx="12" cy="12" r="6"/><path d="M12 9.5V12l1.5 1.5"/><path d="m16 7.5-.7-4A2 2 0 0 0 13.3 2h-2.6a2 2 0 0 0-2 1.5l-.7 4M8 16.5l.7 4a2 2 0 0 0 2 1.5h2.6a2 2 0 0 0 2-1.5l.7-4"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m16 2-4 5-4-5"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  default: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/>',
  // UI ikonalari
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  store: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
};

export const icon = (name, size = 20) => svg(ICON_PATHS[name] || ICON_PATHS.default, size);

/** Mahsulot rasmi bo'lmasa — kategoriya ikonkali chiroyli joy to'ldiruvchi. */
export function productVisual(p, size = 64) {
  if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`;
  const ic = p.category_icon || 'default';
  return `<div class="ph ph-${esc(ic)}">${icon(ic, size)}</div>`;
}

export function stars(rating, size = 14) {
  const r = Math.round(Number(rating) || 0);
  return `<span class="stars" aria-label="${rating || 0} / 5">${[1, 2, 3, 4, 5]
    .map((i) => `<span class="${i <= r ? 'on' : ''}">${icon('star', size)}</span>`).join('')}</span>`;
}

export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('hide'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/** Google Identity Services tugmasini chizadi. Client ID yo'q bo'lsa — izoh ko'rsatadi. */
let gsiPromise;
export async function renderGoogleButton(el, clientId, onCredential) {
  if (!el) return;
  if (!clientId) {
    el.innerHTML = '<p class="muted small center">Google orqali kirish hali sozlanmagan (SUPABASE_URL yoki GOOGLE_CLIENT_ID).</p>';
    return;
  }
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gsiPromise = null; reject(new Error('Google skripti yuklanmadi')); };
    document.head.append(s);
  });
  try {
    await gsiPromise;
  } catch (e) {
    el.innerHTML = `<p class="muted small center">${esc(e.message)}</p>`;
    return;
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp) => onCredential(resp.credential),
    ux_mode: 'popup',
  });
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'uz',
    width: Math.min(el.clientWidth || 360, 400),
  });
}

/* ---------- Supabase Auth (Google provider) ---------- */

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
let supabaseClient;

export async function getSupabase(cfg) {
  if (!supabaseClient) {
    const { createClient } = await import(SUPABASE_JS);
    supabaseClient = createClient(cfg.url, cfg.anonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, storageKey: 'webpa-sb-auth' },
    });
  }
  return supabaseClient;
}

const GOOGLE_LOGO = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

/**
 * "Google bilan davom etish" tugmasi. Supabase sozlangan bo'lsa — Supabase Auth orqali,
 * aks holda GOOGLE_CLIENT_ID bo'lsa — Google Identity Services orqali.
 * next — muvaffaqiyatli kirishdan keyin qaytiladigan manzil (masalan "/#/checkout" yoki "/admin/").
 */
export function renderSocialLogin(el, config, next, onGisCredential) {
  if (!el) return;
  if (!config.supabase) return renderGoogleButton(el, config.googleClientId, onGisCredential);

  el.innerHTML = `<button type="button" class="btn btn-outline btn-block google-btn">${GOOGLE_LOGO}<span>Google bilan davom etish</span></button>`;
  const btn = el.querySelector('button');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const sb = await getSupabase(config.supabase);
      const redirectTo = `${location.origin}/auth/callback.html?next=${encodeURIComponent(next || '/')}`;
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'Google orqali kirib bo\'lmadi', 'err');
    }
  };
}

export function openModal(title, bodyHtml, { wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Yopish">${icon('x')}</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  return { el: wrap.querySelector('.modal'), close };
}
