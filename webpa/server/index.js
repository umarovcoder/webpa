import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { ROOT } from './db.js';
import { seed } from './seed.js';
import { loadUser, csrfGuard } from './auth.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

await seed();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Google Sign-In popup'i ishlashi uchun kerak
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  });
  next();
});

app.use('/api', csrfGuard, loadUser);
app.get('/api/config', (_req, res) => {
  res.json({
    storeName: 'webpa',
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    // anon kalit ochiq (public) kalit — brauzerga berish xavfsiz
    supabase: process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
      ? { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY }
      : null,
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', catalogRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));

app.use('/uploads', express.static(path.join(ROOT, 'uploads'), { maxAge: '7d' }));
app.use(express.static(path.join(ROOT, 'public')));

app.use((err, _req, res, _next) => {
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Rasm hajmi 5 MB dan oshmasligi kerak' : 'Faylni yuklab bo\'lmadi';
    return res.status(400).json({ error: msg });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status < 500 && (err.expose ?? true) ? err.message : 'Serverda xatolik yuz berdi' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`[webpa] Do'kon:      http://localhost:${PORT}`);
  console.log(`[webpa] Admin panel: http://localhost:${PORT}/admin/`);
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) console.log('[webpa] Google orqali kirish: Supabase Auth');
  else if (process.env.GOOGLE_CLIENT_ID) console.log('[webpa] Google orqali kirish: Google Identity Services');
  else console.log('[webpa] Eslatma: SUPABASE_URL/SUPABASE_ANON_KEY yoki GOOGLE_CLIENT_ID o\'rnatilmagan — Google orqali kirish o\'chirilgan.');
});
