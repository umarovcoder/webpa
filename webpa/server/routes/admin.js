import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, tx, restockOrder, ROOT } from '../db.js';
import { requireAdmin } from '../auth.js';
import { PRODUCT_SELECT } from './catalog.js';
import { orderItems } from './orders.js';
import { HttpError, parseProduct, slugify, uniqueSlug, str, toInt } from '../util.js';

const r = Router();
r.use(requireAdmin);

export const ORDER_STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled'];

/* ---------- Statistika ---------- */

r.get('/stats', (_req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const totals = {
    revenue: one('SELECT COALESCE(SUM(total), 0) AS v FROM orders WHERE status <> \'cancelled\'').v,
    orders: one('SELECT COUNT(*) AS v FROM orders').v,
    newOrders: one('SELECT COUNT(*) AS v FROM orders WHERE status = \'new\'').v,
    users: one('SELECT COUNT(*) AS v FROM users').v,
    products: one('SELECT COUNT(*) AS v FROM products').v,
    revenueMonth: one(`SELECT COALESCE(SUM(total), 0) AS v FROM orders
                       WHERE status <> 'cancelled' AND created_at >= date('now', 'start of month')`).v,
  };
  const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status').all();
  const daily = db.prepare(`
    SELECT date(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders FROM orders
    WHERE status <> 'cancelled' AND created_at >= date('now', '-13 days')
    GROUP BY day ORDER BY day`).all();
  const topProducts = db.prepare(`
    SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY COALESCE(oi.product_id, oi.name) ORDER BY qty DESC LIMIT 5`).all();
  const lowStock = db.prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock LIMIT 8').all();
  const recentOrders = db.prepare('SELECT id, full_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 6').all();
  res.json({ totals, byStatus, daily, topProducts, lowStock, recentOrders });
});

/* ---------- Mahsulotlar ---------- */

function productInput(b) {
  const name = str(b.name, 150);
  const price = toInt(b.price);
  const oldPrice = b.old_price === '' || b.old_price == null ? null : toInt(b.old_price);
  const stock = toInt(b.stock ?? 0);
  const categoryId = b.category_id ? toInt(b.category_id) : null;
  const image = str(b.image, 500) || null;

  if (name.length < 2) throw new HttpError(400, 'Mahsulot nomini kiriting');
  if (!(price > 0)) throw new HttpError(400, 'Narx musbat son bo\'lishi kerak');
  if (oldPrice !== null && !(oldPrice > 0)) throw new HttpError(400, 'Eski narx noto\'g\'ri');
  if (!(stock >= 0)) throw new HttpError(400, 'Ombordagi soni noto\'g\'ri');
  if (categoryId !== null && !db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
    throw new HttpError(400, 'Kategoriya topilmadi');
  }
  if (image && !/^(\/uploads\/|https:\/\/)/.test(image)) throw new HttpError(400, 'Rasm manzili /uploads/ yoki https:// bilan boshlanishi kerak');

  const specs = {};
  if (b.specs && typeof b.specs === 'object') {
    for (const [k, v] of Object.entries(b.specs).slice(0, 40)) {
      const key = str(k, 60);
      if (key) specs[key] = str(v, 200);
    }
  }
  return {
    name,
    brand: str(b.brand, 60) || null,
    description: str(b.description, 5000) || null,
    category_id: categoryId,
    price,
    old_price: oldPrice,
    stock,
    image,
    specs: JSON.stringify(specs),
    featured: b.featured ? 1 : 0,
    active: b.active === false ? 0 : 1,
  };
}

r.get('/products', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(p.name LIKE ? OR p.brand LIKE ?)');
    params.push(`%${str(req.query.q, 100)}%`, `%${str(req.query.q, 100)}%`);
  }
  if (req.query.category) { where.push('p.category_id = ?'); params.push(toInt(req.query.category)); }
  const sql = `${PRODUCT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC LIMIT 1000`;
  res.json({ items: db.prepare(sql).all(...params).map(parseProduct) });
});

r.get('/products/:id', (req, res) => {
  const p = parseProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(toInt(req.params.id)));
  if (!p) throw new HttpError(404, 'Mahsulot topilmadi');
  res.json({ product: p });
});

r.post('/products', (req, res) => {
  const d = productInput(req.body || {});
  const slug = uniqueSlug(db, 'products', slugify(d.name));
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO products (name, slug, brand, description, category_id, price, old_price, stock, image, specs, featured, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.name, slug, d.brand, d.description, d.category_id, d.price, d.old_price, d.stock, d.image, d.specs, d.featured, d.active);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

r.put('/products/:id', (req, res) => {
  const id = toInt(req.params.id);
  const existing = db.prepare('SELECT id, name, slug FROM products WHERE id = ?').get(id);
  if (!existing) throw new HttpError(404, 'Mahsulot topilmadi');
  const d = productInput(req.body || {});
  const slug = d.name === existing.name ? existing.slug : uniqueSlug(db, 'products', slugify(d.name), id);
  db.prepare(`
    UPDATE products SET name = ?, slug = ?, brand = ?, description = ?, category_id = ?, price = ?, old_price = ?,
      stock = ?, image = ?, specs = ?, featured = ?, active = ? WHERE id = ?`)
    .run(d.name, slug, d.brand, d.description, d.category_id, d.price, d.old_price, d.stock, d.image, d.specs, d.featured, d.active, id);
  res.json({ ok: true });
});

r.delete('/products/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM products WHERE id = ?').run(toInt(req.params.id));
  if (!changes) throw new HttpError(404, 'Mahsulot topilmadi');
  res.json({ ok: true });
});

/* ---------- Rasm yuklash ---------- */

const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(IMAGE_TYPES[file.mimetype] ? null : new HttpError(400, 'Faqat JPG, PNG, WEBP yoki GIF rasm yuklang'), !!IMAGE_TYPES[file.mimetype]),
});

r.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'Rasm tanlanmagan');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

/* ---------- Kategoriyalar ---------- */

const ICONS = ['phone', 'laptop', 'tablet', 'headphones', 'watch', 'tv', 'gamepad', 'camera', 'plug', 'default'];

function categoryInput(b) {
  const name = str(b.name, 60);
  if (name.length < 2) throw new HttpError(400, 'Kategoriya nomini kiriting');
  return { name, icon: ICONS.includes(b.icon) ? b.icon : 'default', sort: toInt(b.sort) || 0 };
}

r.get('/categories', (_req, res) => {
  res.json({
    icons: ICONS,
    categories: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
                            FROM categories c ORDER BY c.sort, c.name`).all(),
  });
});

r.post('/categories', (req, res) => {
  const d = categoryInput(req.body || {});
  const slug = uniqueSlug(db, 'categories', slugify(d.name));
  const { lastInsertRowid } = db.prepare('INSERT INTO categories (name, slug, icon, sort) VALUES (?, ?, ?, ?)')
    .run(d.name, slug, d.icon, d.sort);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

r.put('/categories/:id', (req, res) => {
  const d = categoryInput(req.body || {});
  const { changes } = db.prepare('UPDATE categories SET name = ?, icon = ?, sort = ? WHERE id = ?')
    .run(d.name, d.icon, d.sort, toInt(req.params.id));
  if (!changes) throw new HttpError(404, 'Kategoriya topilmadi');
  res.json({ ok: true });
});

r.delete('/categories/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM categories WHERE id = ?').run(toInt(req.params.id));
  if (!changes) throw new HttpError(404, 'Kategoriya topilmadi');
  res.json({ ok: true });
});

/* ---------- Buyurtmalar ---------- */

r.get('/orders', (req, res) => {
  const where = [];
  const params = [];
  if (ORDER_STATUSES.includes(req.query.status)) { where.push('o.status = ?'); params.push(req.query.status); }
  if (req.query.q) {
    const q = str(req.query.q, 60);
    where.push('(o.id = ? OR o.full_name LIKE ? OR o.phone LIKE ? OR u.email LIKE ?)');
    params.push(toInt(q.replace('#', '')) || 0, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db.prepare(`
    SELECT o.*, u.email AS user_email, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS item_count
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 500`).all(...params);
  res.json({ orders: rows });
});

r.get('/orders/:id', (req, res) => {
  const order = db.prepare(`SELECT o.*, u.email AS user_email, u.name AS user_name
                            FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(toInt(req.params.id));
  if (!order) throw new HttpError(404, 'Buyurtma topilmadi');
  res.json({ order: { ...order, items: orderItems(order.id) } });
});

r.put('/orders/:id/status', (req, res) => {
  const status = String(req.body?.status || '');
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Noto\'g\'ri holat');
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(toInt(req.params.id));
  if (!order) throw new HttpError(404, 'Buyurtma topilmadi');
  if (order.status === status) return res.json({ ok: true });
  if (order.status === 'cancelled') throw new HttpError(400, 'Bekor qilingan buyurtma holatini o\'zgartirib bo\'lmaydi');
  tx(() => {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    if (status === 'cancelled') restockOrder(order.id);
  });
  res.json({ ok: true });
});

/* ---------- Foydalanuvchilar ---------- */

r.get('/users', (req, res) => {
  const params = [];
  let where = '';
  if (req.query.q) {
    where = 'WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?';
    const like = `%${str(req.query.q, 60)}%`;
    params.push(like, like, like);
  }
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.avatar, u.role, u.created_at,
      u.google_id IS NOT NULL AS has_google, u.password_hash IS NOT NULL AS has_password,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count,
      (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id AND status <> 'cancelled') AS spent
    FROM users u ${where} ORDER BY u.id DESC LIMIT 1000`).all(...params);
  res.json({ users });
});

r.put('/users/:id/role', (req, res) => {
  const id = toInt(req.params.id);
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  if (id === req.user.id) throw new HttpError(400, 'O\'zingizning rolingizni o\'zgartira olmaysiz');
  const { changes } = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (!changes) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  res.json({ ok: true });
});

export default r;
