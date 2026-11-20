import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';

const COOKIE = 'webpa_token';
let SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET === 'change-me-to-a-long-random-string') {
  console.warn('[webpa] JWT_SECRET o\'rnatilmagan — vaqtinchalik kalit ishlatilmoqda (server qayta ishga tushganda sessiyalar o\'chadi).');
  SECRET = crypto.randomBytes(32).toString('hex');
}

const USER_FIELDS = 'id, name, email, avatar, phone, role, google_id IS NOT NULL AS has_google, created_at';

export function getUser(id) {
  const u = db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(id);
  return u ? { ...u, has_google: !!u.has_google } : null;
}

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE);
}

export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET);
      req.user = getUser(uid);
    } catch { /* yaroqsiz yoki muddati o'tgan token */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu bo\'lim faqat adminlar uchun' });
  next();
}

/** Cookie-ga asoslangan CSRF hujumlaridan himoya: o'zgartiruvchi so'rovlar maxsus sarlavha bilan kelishi shart. */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'webpa') return res.status(403).json({ error: 'Noto\'g\'ri so\'rov' });
  next();
}

export function isAdminEmail(email) {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email).toLowerCase());
}
