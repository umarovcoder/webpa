# webpa — elektronika internet-do'koni

Mijozlar uchun do'kon, admin panel va backend API — bitta Node.js loyihasida.

## Imkoniyatlar

**Do'kon (`/`)**
- Bosh sahifa: banner, kategoriyalar, chegirmalar, tavsiya etilgan va yangi mahsulotlar
- Katalog: qidiruv, kategoriya/brend/narx/mavjudlik bo'yicha filtr, saralash, sahifalash
- Mahsulot sahifasi: narx va chegirma, ombor holati, xususiyatlar, sharh va baholar, o'xshash mahsulotlar
- Savat va sevimlilar (brauzerda saqlanadi), buyurtmani rasmiylashtirish (naqd / karta orqali kuryerga)
- Ro'yxatdan o'tish: **email + parol** yoki **Google orqali (Supabase Auth)**
- Shaxsiy kabinet: buyurtmalar tarixi va holati, yangi buyurtmani bekor qilish, profilni tahrirlash

**Admin panel (`/admin/`)**
- Boshqaruv paneli: daromad, buyurtmalar, mijozlar, 14 kunlik savdo diagrammasi, eng ko'p sotilganlar, kam qolgan mahsulotlar
- Buyurtmalar: holat bo'yicha filtr, qidiruv, holatni o'zgartirish (bekor qilinsa — mahsulot omborga qaytadi), batafsil ko'rish
- Mahsulotlar: qo'shish / tahrirlash / o'chirish, rasm yuklash, xususiyatlar, chegirma narxi, ombor, "tavsiya" va "faol" belgilari
- Kategoriyalar: CRUD, ikonka va tartib
- Foydalanuvchilar: ro'yxat, xaridlar summasi, admin huquqini berish/olish

**Backend**: Express 5 + SQLite (Node.js'ning o'zidagi `node:sqlite`, alohida baza serveri kerak emas), JWT (httpOnly cookie), bcrypt, CSRF himoyasi, buyurtmada narx va ombor serverda tekshiriladi.

## Ishga tushirish

Node.js **22.13+** kerak (tavsiya: 24).

```bash
npm install
```

```bash
cp .env.example .env
```

`.env` faylida `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` qiymatlarini o'zgartiring, keyin:

```bash
npm start
```

- Do'kon: http://localhost:3000
- Admin panel: http://localhost:3000/admin/ — `.env` dagi `ADMIN_EMAIL` / `ADMIN_PASSWORD` bilan kiring

Birinchi ishga tushishda 8 ta kategoriya va 25 ta demo mahsulot qo'shiladi. Baza `data/webpa.db` faylida saqlanadi; uni o'chirsangiz, keyingi ishga tushishda toza baza yaratiladi.

## Google orqali kirish — Supabase (tavsiya etiladi)

Ishlash tartibi: foydalanuvchi "Google bilan davom etish" tugmasini bosadi → Supabase Auth orqali Google'ga o'tadi →
`/auth/callback.html` ga qaytadi → Supabase sessiya tokeni serverga yuboriladi → server tokenni Supabase'ning
o'zida tekshiradi (`/auth/v1/user`) → foydalanuvchini bazada yaratadi yoki mavjud hisobga (email bo'yicha) bog'laydi
va webpa sessiyasini ochadi. Buyurtma, savat va admin huquqlari avvalgidek webpa bazasida qoladi.

1. [supabase.com](https://supabase.com) da loyiha yarating.
2. **Google Cloud Console** → APIs & Services → Credentials → **OAuth client ID** (Web application):
   - Authorized redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard → Authentication → Sign In / Providers → Google**: yoqing, Google'dan olingan
   Client ID va Client Secret'ni kiriting.
4. **Supabase Dashboard → Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (production'da o'z domeningiz)
   - Redirect URLs: `http://localhost:3000/auth/callback.html` va `https://<domeningiz>/auth/callback.html`
5. **Project Settings → API** dan `Project URL` va `anon public` kalitni `.env` ga yozing:
   ```
   SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
6. Serverni qayta ishga tushiring — do'kon va admin paneldagi kirish sahifalarida Google tugmasi paydo bo'ladi.

> `service_role` kalitini hech qachon `.env` ga yoki brauzerga bermang — bu yerda faqat `anon` kalit kerak.

## (Muqobil) Supabase'siz to'g'ridan-to'g'ri Google

Supabase sozlanmagan bo'lsa, `GOOGLE_CLIENT_ID` orqali Google Identity Services ishlatiladi:

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Application type: **Web application**
3. **Authorized JavaScript origins**: `http://localhost:3000` va production domeningiz (masalan `https://webpa.uz`)
4. Olingan Client ID'ni `.env` ga yozing: `GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com`
5. Serverni qayta ishga tushiring — kirish sahifalarida "Google bilan davom etish" tugmasi paydo bo'ladi

Google orqali kirgan foydalanuvchini avtomatik admin qilish uchun emailini `ADMIN_EMAILS` ga qo'shing (vergul bilan).

## Production uchun

- `NODE_ENV=production` qo'ying va HTTPS orqasida (nginx, Caddy va h.k.) ishga tushiring
- `JWT_SECRET` — uzun tasodifiy satr bo'lsin
- `data/` va `uploads/` papkalarini zaxiralang

## Tuzilma

```
server/
  index.js        Express ilovasi
  db.js           SQLite sxemasi
  seed.js         Demo ma'lumotlar va admin hisobi
  auth.js         JWT, rollar, CSRF
  routes/         auth, catalog, orders, admin
public/
  index.html      Do'kon (js/store.js, css/store.css)
  admin/          Admin panel (js/admin.js, css/admin.css)
  auth/callback.html  Supabase OAuth qaytish sahifasi (js/auth-callback.js)
  js/common.js    Umumiy yordamchilar
```

## Keyingi qadamlar (hozircha yo'q)

- Click / Payme orqali onlayn to'lov (merchant shartnomasi kerak)
- Buyurtma haqida Telegram/SMS xabarnoma
- Bir mahsulotga bir nechta rasm
