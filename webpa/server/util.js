export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

export function uniqueSlug(db, table, base, excludeId = null) {
  let slug = base;
  for (let i = 2; ; i++) {
    const row = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function str(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

export function parseProduct(row) {
  if (!row) return row;
  let specs = {};
  try { specs = JSON.parse(row.specs || '{}'); } catch { /* buzilgan JSON — bo'sh qoldiramiz */ }
  return { ...row, specs, featured: !!row.featured, active: !!row.active };
}
