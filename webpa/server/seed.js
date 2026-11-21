import bcrypt from 'bcryptjs';
import { db, tx } from './db.js';
import { slugify } from './util.js';

const CATEGORIES = [
  ['Smartfonlar', 'phone'],
  ['Noutbuklar', 'laptop'],
  ['Planshetlar', 'tablet'],
  ['Quloqchinlar', 'headphones'],
  ['Aqlli soatlar', 'watch'],
  ['Televizorlar', 'tv'],
  ["O'yin konsollari", 'gamepad'],
  ['Aksessuarlar', 'plug'],
];

// [kategoriya, nomi, brend, narx, eski narx, ombor, tavsiya, tavsif, xususiyatlar]
const PRODUCTS = [
  ['Smartfonlar', 'Apple iPhone 16 Pro 256GB', 'Apple', 16990000, 18490000, 12, 1,
    'A18 Pro protsessori, titan korpus va 48 MP Fusion kamerasi bilan eng kuchli iPhone. Kamera boshqaruvi tugmasi va 4K 120 fps video.',
    { Ekran: '6.3" Super Retina XDR, 120 Hz', Protsessor: 'Apple A18 Pro', Xotira: '256 GB', Kamera: '48 + 48 + 12 MP', Batareya: '3582 mAh', Rang: 'Desert Titanium' }],
  ['Smartfonlar', 'Samsung Galaxy S25 Ultra 12/512GB', 'Samsung', 15490000, null, 9, 1,
    'Galaxy AI imkoniyatlari, S Pen va 200 MP kamera. Snapdragon 8 Elite for Galaxy bilan maksimal unumdorlik.',
    { Ekran: '6.9" Dynamic AMOLED 2X, 120 Hz', Protsessor: 'Snapdragon 8 Elite', 'Operativ xotira': '12 GB', Xotira: '512 GB', Kamera: '200 + 50 + 50 + 10 MP', Batareya: '5000 mAh' }],
  ['Smartfonlar', 'Xiaomi Redmi Note 14 Pro 8/256GB', 'Xiaomi', 3890000, 4290000, 30, 0,
    '200 MP asosiy kamera, 120 Hz AMOLED ekran va IP68 himoya — narx va sifatning ideal muvozanati.',
    { Ekran: '6.67" AMOLED, 120 Hz', Protsessor: 'MediaTek Dimensity 7300 Ultra', 'Operativ xotira': '8 GB', Xotira: '256 GB', Batareya: '5110 mAh, 45 W' }],
  ['Smartfonlar', 'Google Pixel 9 12/128GB', 'Google', 9990000, null, 6, 0,
    'Toza Android, Gemini sun\'iy intellekti va Google\'ning eng yaxshi kompyuter fotografiyasi.',
    { Ekran: '6.3" Actua OLED, 120 Hz', Protsessor: 'Google Tensor G4', 'Operativ xotira': '12 GB', Xotira: '128 GB', Kamera: '50 + 48 MP' }],
  ['Smartfonlar', 'Samsung Galaxy A56 8/256GB', 'Samsung', 4690000, 4990000, 25, 0,
    'Yorqin Super AMOLED ekran, 6 yillik Android yangilanishlari va kuchli batareya.',
    { Ekran: '6.7" Super AMOLED, 120 Hz', Protsessor: 'Exynos 1580', 'Operativ xotira': '8 GB', Xotira: '256 GB', Batareya: '5000 mAh' }],

  ['Noutbuklar', 'Apple MacBook Air 13 M4 16/256GB', 'Apple', 15990000, null, 7, 1,
    'Yupqa va yengil, 18 soatgacha batareya. M4 chipi bilan kundalik ish va ijod uchun mukammal.',
    { Ekran: '13.6" Liquid Retina', Protsessor: 'Apple M4 (10 yadro)', 'Operativ xotira': '16 GB', SSD: '256 GB', Vazn: '1.24 kg' }],
  ['Noutbuklar', 'ASUS ROG Strix G16 i7/RTX 4060', 'ASUS', 21500000, 23900000, 4, 1,
    'O\'yinlar uchun yaratilgan: 165 Hz ekran, RTX 4060 videokarta va samarali sovutish tizimi.',
    { Ekran: '16" FHD+, 165 Hz', Protsessor: 'Intel Core i7-13650HX', Videokarta: 'NVIDIA RTX 4060 8 GB', 'Operativ xotira': '16 GB DDR5', SSD: '1 TB' }],
  ['Noutbuklar', 'Lenovo IdeaPad Slim 5 Ryzen 7', 'Lenovo', 8490000, null, 14, 0,
    'O\'qish va ofis ishlari uchun ishonchli, yengil noutbuk. OLED ekran va tez zaryadlash.',
    { Ekran: '14" WUXGA OLED', Protsessor: 'AMD Ryzen 7 8845HS', 'Operativ xotira': '16 GB', SSD: '512 GB', Vazn: '1.46 kg' }],
  ['Noutbuklar', 'HP Victus 15 Ryzen 5/RTX 3050', 'HP', 10290000, 11200000, 3, 0,
    'Hamyonbop gaming noutbuk: 144 Hz ekran va RTX 3050 videokarta.',
    { Ekran: '15.6" FHD, 144 Hz', Protsessor: 'AMD Ryzen 5 7535HS', Videokarta: 'NVIDIA RTX 3050 6 GB', 'Operativ xotira': '16 GB', SSD: '512 GB' }],

  ['Planshetlar', 'Apple iPad Air 11 M3 128GB Wi-Fi', 'Apple', 9790000, null, 10, 1,
    'M3 chipi, Apple Pencil Pro va Magic Keyboard qo\'llab-quvvatlashi bilan kuchli planshet.',
    { Ekran: '11" Liquid Retina', Protsessor: 'Apple M3', Xotira: '128 GB', Ulanish: 'Wi-Fi 6E' }],
  ['Planshetlar', 'Samsung Galaxy Tab S10 FE 8/128GB', 'Samsung', 6290000, 6790000, 8, 0,
    'S Pen qo\'shilgan, IP68 himoyali va katta ekranli planshet.',
    { Ekran: '10.9" LCD, 90 Hz', Protsessor: 'Exynos 1580', 'Operativ xotira': '8 GB', Xotira: '128 GB', Batareya: '8000 mAh' }],
  ['Planshetlar', 'Xiaomi Pad 7 8/256GB', 'Xiaomi', 4590000, null, 15, 0,
    '3.2K 144 Hz ekran va Snapdragon protsessor — kino va o\'yinlar uchun.',
    { Ekran: '11.2" 3.2K, 144 Hz', Protsessor: 'Snapdragon 7+ Gen 3', 'Operativ xotira': '8 GB', Xotira: '256 GB' }],

  ['Quloqchinlar', 'Apple AirPods Pro 2 (USB-C)', 'Apple', 3190000, 3490000, 20, 1,
    'Faol shovqin pasaytirish, moslashuvchan audio va eshitishni himoya qilish funksiyalari.',
    { Turi: 'TWS, quloq ichiga', 'Shovqin pasaytirish': 'Faol (ANC)', 'Ishlash vaqti': '6 soat (keys bilan 30)', Zaryadlash: 'USB-C, MagSafe' }],
  ['Quloqchinlar', 'Sony WH-1000XM5', 'Sony', 4290000, 4890000, 7, 1,
    'Sohadagi eng yaxshi shovqin pasaytirish va 30 soatlik batareya.',
    { Turi: 'To\'liq o\'lchamli', 'Shovqin pasaytirish': 'Faol (ANC)', 'Ishlash vaqti': '30 soat', Ulanish: 'Bluetooth 5.2, LDAC' }],
  ['Quloqchinlar', 'JBL Tune 770NC', 'JBL', 1190000, null, 18, 0,
    'JBL Pure Bass ovozi, ANC va 70 soatgacha tinglash.',
    { Turi: 'Quloq ustiga', 'Shovqin pasaytirish': 'Moslashuvchan ANC', 'Ishlash vaqti': '70 soat', Ulanish: 'Bluetooth 5.3' }],

  ['Aqlli soatlar', 'Apple Watch Series 10 46mm', 'Apple', 5490000, null, 9, 0,
    'Eng yupqa Apple Watch: katta ekran, uyqu apnoesi monitoringi va tez zaryadlash.',
    { Ekran: '46 mm, Always-On Retina', Korpus: 'Alyuminiy', 'Suvga chidamlilik': '50 m', Batareya: '18 soatgacha' }],
  ['Aqlli soatlar', 'Samsung Galaxy Watch 7 44mm', 'Samsung', 3290000, 3690000, 11, 0,
    'Galaxy AI bilan sog\'liq tahlili, BioActive sensor va Wear OS.',
    { Ekran: '1.5" Super AMOLED', 'Suvga chidamlilik': '5ATM + IP68', Batareya: '40 soatgacha', OS: 'Wear OS' }],
  ['Aqlli soatlar', 'Xiaomi Smart Band 9', 'Xiaomi', 590000, null, 40, 0,
    'Yengil fitnes-bilaguzuk: 150+ sport rejimi va 21 kungacha batareya.',
    { Ekran: '1.62" AMOLED', 'Suvga chidamlilik': '5ATM', Batareya: '21 kungacha' }],

  ['Televizorlar', 'Samsung 55" Crystal UHD 4K DU8000', 'Samsung', 6990000, 7590000, 5, 0,
    'Crystal Processor 4K, HDR10+ va Smart Tizen platformasi.',
    { Diagonal: '55" (139 sm)', 'Ruxsat': '3840×2160 (4K)', HDR: 'HDR10+', 'Smart TV': 'Tizen' }],
  ['Televizorlar', 'LG OLED evo 65" C4', 'LG', 26900000, null, 2, 1,
    'Mukammal qora rang, 144 Hz va Dolby Vision — kino va o\'yinlar uchun eng yaxshi tanlov.',
    { Diagonal: '65" (164 sm)', Matritsa: 'OLED evo', 'Yangilanish chastotasi': '144 Hz', HDR: 'Dolby Vision, HDR10', 'Smart TV': 'webOS' }],

  ["O'yin konsollari", 'Sony PlayStation 5 Slim (disk)', 'Sony', 7890000, 8490000, 6, 1,
    'Ixcham PS5: o\'ta tez SSD, DualSense haptik javobi va 4K o\'yinlar.',
    { Xotira: '1 TB SSD', 'Ruxsat': '4K, 120 fps gacha', Disk: 'Ultra HD Blu-ray', Kompleksda: 'DualSense kontroller' }],
  ["O'yin konsollari", 'Nintendo Switch OLED', 'Nintendo', 4490000, null, 8, 0,
    '7 dyuymli OLED ekran — uyda ham, yo\'lda ham o\'ynang.',
    { Ekran: '7" OLED', Xotira: '64 GB', Rejimlar: 'TV / stol / qo\'lda' }],

  ['Aksessuarlar', 'Anker PowerCore 20000 mAh 30W', 'Anker', 490000, 590000, 50, 0,
    'Smartfonni 4-5 marta to\'ldiradigan kuchli powerbank, USB-C PD.',
    { "Sig'im": '20000 mAh', Quvvat: '30 W PD', Portlar: 'USB-C, USB-A' }],
  ['Aksessuarlar', 'Samsung 45W Super Fast Charger', 'Samsung', 390000, null, 35, 0,
    'Galaxy smartfonlari uchun 45 W o\'ta tez zaryadlovchi (kabel bilan).',
    { Quvvat: '45 W', Port: 'USB-C', Kabel: 'USB-C — USB-C, 1.8 m' }],
  ['Aksessuarlar', 'Logitech MX Master 3S', 'Logitech', 1390000, null, 0, 0,
    'Professional simsiz sichqoncha: jim tugmalar, 8K DPI sensor va MagSpeed g\'ildirak.',
    { Sensor: '8000 DPI', Ulanish: 'Bluetooth, Logi Bolt', Batareya: '70 kungacha' }],
];

export async function seed() {
  let categoriesAdded = 0;
  let productsAdded = 0;
  tx(() => {
    const insCat = db.prepare('INSERT INTO categories (name, slug, icon, sort) VALUES (?, ?, ?, ?)');
    const catIds = {};
    CATEGORIES.forEach(([name, icon], i) => {
      const slug = slugify(name);
      let category = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
      if (!category) {
        category = { id: Number(insCat.run(name, slug, icon, i).lastInsertRowid) };
        categoriesAdded++;
      }
      catIds[name] = category.id;
    });

    const insProd = db.prepare(`
      INSERT INTO products (name, slug, brand, description, category_id, price, old_price, stock, specs, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const [cat, name, brand, price, oldPrice, stock, featured, desc, specs] of PRODUCTS) {
      const slug = slugify(name);
      if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) continue;
      insProd.run(name, slug, brand, desc, catIds[cat], price, oldPrice, stock, JSON.stringify(specs), featured);
      productsAdded++;
    }
  });
  if (categoriesAdded || productsAdded) {
    console.log(`[webpa] Demo ma'lumotlar qo'shildi: ${categoriesAdded} kategoriya, ${productsAdded} mahsulot`);
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password) {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'admin\')')
        .run('Administrator', email, await bcrypt.hash(password, 10));
      console.log(`[webpa] Admin hisobi yaratildi: ${email}`);
    } else if (existing.role !== 'admin') {
      db.prepare('UPDATE users SET role = \'admin\' WHERE id = ?').run(existing.id);
    }
  }
}
