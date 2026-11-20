import { Router } from 'express';
import { db, tx, restockOrder } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, str, toInt } from '../util.js';

const r = Router();
export const PAYMENT_METHODS = ['cash', 'card'];

export function orderItems(orderId) {
  return db.prepare(`
    SELECT oi.product_id, oi.name, oi.price, oi.qty, p.slug, p.image, c.icon AS category_icon
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE oi.order_id = ?`).all(orderId);
}

r.use(requireAuth);

r.post('/', (req, res) => {
  const b = req.body || {};
  const fullName = str(b.full_name, 100);
  const phone = str(b.phone, 30);
  const city = str(b.city, 60);
  const address = str(b.address, 300);
  const note = str(b.note, 500);
  const payment = String(b.payment_method || '');

  if (fullName.length < 2) throw new HttpError(400, 'Ism-familiyani kiriting');
  if (!/^\+?[\d\s()-]{9,20}$/.test(phone)) throw new HttpError(400, 'Telefon raqami noto\'g\'ri');
  if (!city) throw new HttpError(400, 'Viloyat/shaharni tanlang');
  if (address.length < 5) throw new HttpError(400, 'Manzilni to\'liq kiriting');
  if (!PAYMENT_METHODS.includes(payment)) throw new HttpError(400, 'To\'lov usulini tanlang');

  // Bir xil mahsulotlarni birlashtiramiz
  const wanted = new Map();
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
    const id = toInt(it?.product_id);
    const qty = toInt(it?.qty);
    if (Number.isInteger(id) && qty >= 1 && qty <= 99) wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  if (!wanted.size) throw new HttpError(400, 'Savat bo\'sh');

  const orderId = tx(() => {
    const lines = [];
    for (const [id, qty] of wanted) {
      const p = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ? AND active = 1').get(id);
      if (!p) throw new HttpError(400, 'Savatdagi mahsulotlardan biri endi mavjud emas');
      if (p.stock < qty) throw new HttpError(400, `"${p.name}" omborda yetarli emas (qoldi: ${p.stock} dona)`);
      lines.push({ ...p, qty });
    }
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO orders (user_id, total, full_name, phone, city, address, payment_method, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.user.id, total, fullName, phone, city, address, payment, note || null);
    const oid = Number(lastInsertRowid);
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)');
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const l of lines) {
      insItem.run(oid, l.id, l.name, l.price, l.qty);
      decStock.run(l.qty, l.id);
    }
    if (!req.user.phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
    return oid;
  });

  res.status(201).json({ order: { id: orderId } });
});

r.get('/my', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id)
    .map((o) => ({ ...o, items: orderItems(o.id) }));
  res.json({ orders });
});

r.post('/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ? AND user_id = ?').get(toInt(req.params.id), req.user.id);
  if (!order) throw new HttpError(404, 'Buyurtma topilmadi');
  if (order.status !== 'new') throw new HttpError(400, 'Faqat yangi buyurtmani bekor qilish mumkin');
  tx(() => {
    db.prepare('UPDATE orders SET status = \'cancelled\' WHERE id = ?').run(order.id);
    restockOrder(order.id);
  });
  res.json({ ok: true });
});

export default r;
