// Supabase OAuth (Google) qaytish sahifasi: code → Supabase sessiya → webpa sessiya cookie
import { $, esc, api, getSupabase } from './common.js';

const params = new URLSearchParams(location.search);

// Faqat o'z saytimizdagi manzillarga qaytamiz (open redirect'dan himoya)
function safeNext(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';
}
const next = safeNext(params.get('next'));

function fail(message) {
  const back = next.startsWith('/admin') ? '/admin/' : '/#/login';
  $('#box').innerHTML = `
    <h1>Kirish amalga oshmadi</h1>
    <p class="muted">${esc(message)}</p>
    <a class="btn btn-primary" href="${back}">Qaytadan urinish</a>`;
}

async function run() {
  const providerError = params.get('error_description') || params.get('error');
  if (providerError) return fail(providerError);

  const code = params.get('code');
  if (!code) return fail('Kirish kodi topilmadi.');

  const { supabase } = await api('/config');
  if (!supabase) return fail('Supabase sozlanmagan.');

  const sb = await getSupabase(supabase);
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data?.session) return fail(error?.message || 'Sessiya olinmadi.');

  try {
    await api('/auth/supabase', { method: 'POST', body: { access_token: data.session.access_token } });
  } finally {
    // webpa o'z cookie sessiyasidan foydalanadi — Supabase sessiyasini brauzerda saqlab o'tirmaymiz
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  }
  location.replace(next);
}

run().catch((err) => fail(err.message || 'Noma\'lum xatolik'));
