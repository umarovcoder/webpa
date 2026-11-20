import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'webpa.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  avatar        TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'default',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  brand       TEXT,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price       INTEGER NOT NULL,
  old_price   INTEGER,
  stock       INTEGER NOT NULL DEFAULT 0,
  image       TEXT,
  specs       TEXT NOT NULL DEFAULT '{}',
  featured    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'new',
  total          INTEGER NOT NULL,
  full_name      TEXT NOT NULL,
  phone          TEXT NOT NULL,
  city           TEXT NOT NULL,
  address        TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL,
  qty        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

// Migratsiya: Supabase foydalanuvchi ID'si
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'supabase_id')) {
  db.exec('ALTER TABLE users ADD COLUMN supabase_id TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase ON users(supabase_id)');

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Bekor qilingan buyurtma mahsulotlarini omborga qaytaradi (tranzaksiya ichida chaqiring). */
export function restockOrder(orderId) {
  const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId);
  const upd = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const it of items) if (it.product_id) upd.run(it.qty, it.product_id);
}
