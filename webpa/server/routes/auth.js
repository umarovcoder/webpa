import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.js';
import { getUser, setAuthCookie, clearAuthCookie, requireAuth, isAdminEmail } from '../auth.js';
import { HttpError, str } from '../util.js';

const r = Router();
const googleClient = new OAuth2Client();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.post('/register', async (req, res) => {
  const name = str(req.body?.name, 80);
  const email = str(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password ?? '');
  if (name.length < 2) throw new HttpError(400, 'Ismingizni kiriting');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email manzili noto\'g\'ri');
  if (password.length < 6) throw new HttpError(400, 'Parol kamida 6 belgidan iborat bo\'lsin');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'Bu email bilan hisob allaqachon mavjud');
  }
  const hash = await bcrypt.hash(password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, hash);
  setAuthCookie(res, Number(lastInsertRowid));
  res.status(201).json({ user: getUser(Number(lastInsertRowid)) });
});

r.post('/login', async (req, res) => {
  const email = str(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password ?? '');
  const row = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (row && !row.password_hash) {
    throw new HttpError(400, 'Bu hisob Google orqali yaratilgan — "Google bilan kirish" tugmasidan foydalaning');
  }
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new HttpError(401, 'Email yoki parol noto\'g\'ri');
  }
  setAuthCookie(res, row.id);
  res.json({ user: getUser(row.id) });
});

r.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(400, 'Google orqali kirish sozlanmagan (GOOGLE_CLIENT_ID)');
  const credential = String(req.body?.credential ?? '');

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Google tokeni tasdiqlanmadi');
  }
  if (!payload?.email || !payload.email_verified) throw new HttpError(400, 'Google emaili tasdiqlanmagan');

  const userId = upsertOAuthUser({
    email: payload.email, name: payload.name, avatar: payload.picture, googleId: payload.sub,
  });
  setAuthCookie(res, userId);
  res.json({ user: getUser(userId) });
});

/**
 * Supabase Auth (Google provider) orqali kirish.
 * Brauzer Supabase'dan olgan access_token'ni yuboradi, biz uni Supabase'ning o'zida tekshiramiz
 * va o'zimizning sessiya cookie'mizni o'rnatamiz.
 */
r.post('/supabase', async (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new HttpError(400, 'Supabase sozlanmagan (SUPABASE_URL, SUPABASE_ANON_KEY)');
  const token = String(req.body?.access_token ?? '');
  if (!token) throw new HttpError(400, 'Token yuborilmadi');

  let su;
  try {
    const resp = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`Supabase ${resp.status}`);
    su = await resp.json();
  } catch {
    throw new HttpError(401, 'Supabase sessiyasi tasdiqlanmadi');
  }
  if (!su?.id || !su.email) throw new HttpError(400, 'Supabase hisobida email yo\'q');
  if (!su.email_confirmed_at && !su.confirmed_at) throw new HttpError(400, 'Email tasdiqlanmagan');

  const meta = su.user_metadata || {};
  const providers = su.app_metadata?.providers || [su.app_metadata?.provider];
  const userId = upsertOAuthUser({
    email: su.email,
    name: meta.full_name || meta.name,
    avatar: meta.avatar_url || meta.picture,
    googleId: providers.includes('google') ? meta.provider_id || meta.sub || null : null,
    supabaseId: su.id,
  });
  setAuthCookie(res, userId);
  res.json({ user: getUser(userId) });
});

/** Tashqi provayder orqali kelgan foydalanuvchini topadi (yoki yaratadi) va hisoblarni bog'laydi. */
function upsertOAuthUser({ email, name, avatar, googleId = null, supabaseId = null }) {
  email = email.toLowerCase();
  let user = (supabaseId && db.prepare('SELECT id, role FROM users WHERE supabase_id = ?').get(supabaseId))
    || (googleId && db.prepare('SELECT id, role FROM users WHERE google_id = ?').get(googleId))
    || db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);

  if (user) {
    db.prepare(`UPDATE users SET google_id = COALESCE(?, google_id), supabase_id = COALESCE(?, supabase_id),
                avatar = COALESCE(avatar, ?) WHERE id = ?`)
      .run(googleId, supabaseId, avatar ?? null, user.id);
  } else {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, google_id, supabase_id, avatar) VALUES (?, ?, ?, ?, ?)')
      .run(str(name || email.split('@')[0], 80), email, googleId, supabaseId, avatar ?? null);
    user = { id: Number(lastInsertRowid), role: 'user' };
  }
  if (user.role !== 'admin' && isAdminEmail(email)) {
    db.prepare('UPDATE users SET role = \'admin\' WHERE id = ?').run(user.id);
  }
  return user.id;
}

r.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

r.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});

r.put('/me', requireAuth, (req, res) => {
  const name = str(req.body?.name, 80);
  const phone = str(req.body?.phone, 30);
  if (name.length < 2) throw new HttpError(400, 'Ismingizni kiriting');
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone || null, req.user.id);
  res.json({ user: getUser(req.user.id) });
});

export default r;
