import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, parseProduct, str, toInt } from '../util.js';

const r = Router();

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
    (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = p.id) AS rating,
    (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) AS review_count
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  popular: '(SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE product_id = p.id) DESC, p.featured DESC, p.id DESC',
  rating: 'rating IS NULL, rating DESC, review_count DESC',
  discount: '(CAST(p.old_price - p.price AS REAL) / p.old_price) DESC',
};

r.get('/categories', (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id AND active = 1) AS product_count
    FROM categories c ORDER BY c.sort, c.name`).all();
  res.json({ categories: rows });
});

r.get('/brands', (req, res) => {
  const params = [];
  let sql = `SELECT DISTINCT p.brand FROM products p LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.active = 1 AND p.brand IS NOT NULL AND p.brand <> ''`;
  if (req.query.category) { sql += ' AND c.slug = ?'; params.push(String(req.query.category)); }
  res.json({ brands: db.prepare(sql + ' ORDER BY p.brand').all(...params).map((b) => b.brand) });
});

r.get('/products', (req, res) => {
  const q = req.query;
  const where = ['p.active = 1'];
  const params = [];

  if (q.ids) {
    const ids = String(q.ids).split(',').map(Number).filter(Number.isInteger).slice(0, 100);
    if (!ids.length) return res.json({ items: [], total: 0, page: 1, pages: 1 });
    where.push(`p.id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (q.q) {
    const like = `%${str(q.q, 100)}%`;
    where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)');
    params.push(like, like, like);
  }
  if (q.category) { where.push('c.slug = ?'); params.push(String(q.category)); }
  if (q.brand) {
    const brands = String(q.brand).split(',').filter(Boolean).slice(0, 30);
    if (brands.length) {
      where.push(`p.brand IN (${brands.map(() => '?').join(',')})`);
      params.push(...brands);
    }
  }
  if (q.min) { where.push('p.price >= ?'); params.push(toInt(q.min) || 0); }
  if (q.max) { where.push('p.price <= ?'); params.push(toInt(q.max) || 0); }
  if (q.featured === '1') where.push('p.featured = 1');
  if (q.discount === '1') where.push('p.old_price > p.price');
  if (q.instock === '1') where.push('p.stock > 0');

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const limit = Math.min(Math.max(toInt(q.limit) || 12, 1), 100);
  const page = Math.max(toInt(q.page) || 1, 1);
  const orderBy = SORTS[q.sort] || SORTS.popular;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`)
    .get(...params).n;
  const items = db.prepare(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit)
    .map(parseProduct);

  res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

r.get('/products/:slug', (req, res) => {
  const product = parseProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`).get(req.params.slug));
  if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name, u.avatar AS user_avatar
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 50`).all(product.id);
  const related = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.category_id = ? AND p.id <> ? ORDER BY RANDOM() LIMIT 4`)
    .all(product.category_id, product.id)
    .map(parseProduct);

  res.json({ product, reviews, related });
});

r.post('/products/:id/reviews', requireAuth, (req, res) => {
  const productId = toInt(req.params.id);
  const rating = toInt(req.body?.rating);
  const comment = str(req.body?.comment, 1000);
  if (!db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(productId)) {
    throw new HttpError(404, 'Mahsulot topilmadi');
  }
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Bahoni 1 dan 5 gacha tanlang');
  db.prepare(`
    INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
    ON CONFLICT (product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = CURRENT_TIMESTAMP`)
    .run(productId, req.user.id, rating, comment || null);
  res.status(201).json({ ok: true });
});

export default r;
