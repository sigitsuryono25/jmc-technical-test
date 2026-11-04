# Penjelasan Kode — Aplikasi Pengelolaan Barang

Dokumen ini isinya dua bagian:

1. **Ringkasan** — cukup dibaca 10 menit sebelum interview/demo.
2. **Penjelasan lengkap** — file per file, kalau perlu detail saat ditanya.

> Catatan: dokumen ini catatan pribadi. Kalau mau repo-nya bersih, hapus file ini sebelum push.

---

# BAGIAN 1 — RINGKASAN

## 1.1 Apa aplikasi ini (30 detik)

Aplikasi pencatatan barang masuk. Ada dua role:

- **Admin** — semua menu: Barang Masuk, Master Data (Kategori & Sub Kategori), Manajemen User.
- **Operator** — hanya Barang Masuk.

Fitur inti: CRUD barang masuk multi-item, validasi total terhadap batas harga sub kategori, filter/sort/search/pagination, export Excel, cetak surat, upload lampiran, lock user.

## 1.2 Stack

| Layer | Teknologi |
| --- | --- |
| Frontend | React 18 + Vite + React Router 6 + Bootstrap 5 |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL (Supabase di production) |
| Auth | JWT + bcrypt |
| Upload | Supabase Storage (lokal: folder `uploads/`) |
| Export | ExcelJS |
| Deploy | Vercel (frontend + serverless API) + Supabase |

## 1.3 Angka penting

| Item | Jumlah |
| --- | --- |
| Tabel database | 5 |
| Endpoint API | ± 22 |
| Halaman frontend | 7 |
| Role | 2 |

## 1.4 Alur satu request

```
Klik tombol di React
  → src/api.js: fetch('/api/...') + Authorization + X-Api-Path
  → Vite proxy (lokal) / rewrite Vercel (produksi)
  → server/app.js → routes/*
  → requireAuth: verifikasi JWT + query ulang user (cek lock)
  → validasi input (server/http.js)
  → query Postgres (server/db.js)
  → JSON balik → state React → UI berubah
```

## 1.5 Struktur folder

```
api/index.js          entry serverless Vercel
server/               backend Express
  routes/             auth, categories, subCategories, users, stockIns, uploads
db/schema.sql         skema database
scripts/db-setup.js   schema + seed (idempotent)
src/
  pages/              Login, StockIns, StockInForm, Categories, SubCategories, Users, PrintLetter
  components/         Layout, Modal, Pagination, icons
  api.js              HTTP client
  auth.jsx            Auth context
  utils.js            formatter rupiah/tanggal
  styles.css          CSS sisa (sidebar, login, surat cetak)
```

## 1.6 Tiga hal yang paling mungkin ditanya

**1. Kenapa user di-query ulang tiap request, bukan cukup dari token?**
Karena status lock harus langsung berlaku. Kalau hanya percaya isi JWT, user yang baru dikunci masih bisa akses sampai token expired (12 jam). Query ulang di `requireAuth` menutup celah itu.

**2. Kenapa sort pakai whitelist (`SORT_COLUMNS`)?**
Nama kolom tidak bisa di-parameterize seperti nilai. Kalau `req.query.sort` langsung dimasukkan ke SQL, itu celah SQL injection. Jadi dipetakan dulu dari nilai tetap: `date → si.created_at`, `origin → si.origin`, `total → si.total_price`.

**3. Kenapa validasi batas harga ada di dua tempat?**
Frontend untuk UX (tombol simpan langsung disabled). Backend untuk keamanan, karena API bisa dipanggil langsung pakai curl/Postman tanpa lewat UI.

## 1.7 Satu kalimat per fitur

| Fitur | Kalimat penjelasan |
| --- | --- |
| Login | Cek username/password dengan bcrypt, tolak kalau `is_locked`, balikin JWT. |
| Hak akses | Menu disembunyikan di UI, route dilindungi `requireRole` di server. |
| Barang masuk | Satu header + banyak item, disimpan dalam satu transaksi DB. |
| Batas harga | Total seluruh item dibandingkan dengan `price_limit` sub kategori. |
| Filter | Kategori → sub kategori dependent, plus tahun, plus search debounce. |
| Sorting | Whitelist kolom, arah asc/desc, dikerjakan di SQL. |
| Pagination | `LIMIT/OFFSET` + total count di query terpisah. |
| Export Excel | Query yang sama dengan filter aktif, disusun ExcelJS, dikirim sebagai buffer. |
| Cetak surat | Halaman A4 dengan `window.print()`, tanpa library PDF. |
| Upload | Multer memory storage → Supabase Storage (atau disk saat lokal). |
| Lock user | Flag di DB, dicek di login **dan** di setiap request. |

## 1.8 Batasan yang jujur (kalau ditanya "kekurangannya apa?")

- Belum ada refresh token; token expired → user harus login ulang.
- Belum ada audit trail (siapa mengubah apa, kapan).
- Lampiran lama tidak dihapus dari storage saat data dihapus/diganti.
- Export Excel memuat semua baris sesuai filter, belum ada batas jumlah — aman untuk data tes, perlu streaming kalau datanya besar.
- Belum ada automated test yang ikut di repo (pengujian dilakukan manual + E2E sementara).

---

# BAGIAN 2 — PENJELASAN LENGKAP

## 2.1 Root & Config

### `package.json`
Daftar dependency dan script.

| Script | Fungsi |
| --- | --- |
| `dev` | API + Vite bareng (`concurrently`) |
| `dev:api` | API saja, `node --watch` |
| `build` | `vite build` → `dist/` |
| `start` | API mode produksi lokal |
| `db:setup` | schema + seed |
| `preview` | preview hasil build |

`"type": "module"` → seluruh project ESM.

### `.env.example`
Template environment. Yang disalin jadi `.env` (dan `.env` tidak ikut commit).

- `DATABASE_URL`, `PGSSLMODE`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `PORT`, `CORS_ORIGIN`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`

### `.gitignore`
`node_modules`, `dist`, `.env`, isi `uploads/` (kecuali `.gitkeep`), `*.log`, `.vercel`, plus `*.pdf` dan file soal tes supaya tidak ikut ter-publish.

### `index.html`
Entry Vite: `<div id="root">` + `/src/main.jsx`.

### `vite.config.js`
Proxy development:

```js
proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' }
```

Frontend selalu fetch ke path relative `/api/...`, Vite yang meneruskan ke Express. Jadi tidak perlu CORS saat lokal.

### `vercel.json`
- Build ke `dist/`.
- `/api/:path*` → `/api/index?__path=:path*`.
- Sisanya → `/index.html` supaya refresh di route React tidak 404.
- Function: 30 detik, 1 GB.

### `public/favicon.svg`
Ikon tab browser.

### `uploads/.gitkeep`
Penjaga agar folder `uploads/` tetap ada di git.

### `README.md`
Dokumentasi untuk penilai: link, stack, akun testing, cara run, cara deploy.

---

## 2.2 Database

### `db/schema.sql`

| Tabel | Kolom penting |
| --- | --- |
| `users` | `role` (CHECK admin/operator), `username` UNIQUE, `password_hash`, `is_locked` |
| `categories` | `code` UNIQUE (10), `name` (100) |
| `sub_categories` | `category_id` FK, `name`, `price_limit NUMERIC(16,2)` |
| `stock_ins` | `operator_id`, `category_id`, `sub_category_id`, `origin`, `recipient`, `unit`, `letter_number`, `attachment_path`, `attachment_name`, `total_price`, `is_verified` |
| `stock_in_items` | `stock_in_id` FK, `code`, `name`, `price`, `quantity`, `unit`, `total`, `expired_date` |

Aturan hapus:

- `stock_in_items.stock_in_id` → `ON DELETE CASCADE` (hapus header, item ikut).
- Sisanya `ON DELETE RESTRICT` (data master tidak bisa dihapus kalau masih dipakai).

Index: `created_at DESC`, `category_id`, `sub_category_id`, `stock_in_id`, `sub_categories.category_id`.

### `scripts/db-setup.js`
Idempotent, aman dijalankan berkali-kali:

1. Jalankan `schema.sql`.
2. Insert 4 user (`ON CONFLICT DO NOTHING`), password bcrypt cost 10.
3. Insert 4 kategori + 8 sub kategori dengan cek duplikat manual.
4. Seed 7 transaksi **hanya kalau `stock_ins` masih kosong**.

Data seed sengaja tersebar di beberapa tahun (2024–2026) supaya filter tahun bisa diuji.

---

## 2.3 Backend

### `server/db.js`
- Satu `Pool` global.
- `max: 3` → disengaja kecil untuk serverless.
- SSL aktif kecuali `PGSSLMODE=disable`.
- `q()` → shortcut query.
- `withTransaction(fn)` → `BEGIN/COMMIT`, `ROLLBACK` saat error, `release()` di `finally`.

### `server/http.js`
Helper validasi + error.

| Fungsi | Kegunaan |
| --- | --- |
| `HttpError` | Error dengan status code |
| `wrap` | Bungkus handler async agar error masuk `next()` |
| `paging` | `page`, `limit` (maks 100), `offset` |
| `text` | Trim, required, min/max |
| `money` | Buang non-angka, bulatkan 2 desimal |
| `integer` | Validasi bilangan bulat |
| `dateOrNull` | Validasi `YYYY-MM-DD` |
| `oneOf` | Enum |

### `server/auth.js`
- `signToken()` → JWT `{ sub, role }`.
- `publicUser()` → buang `password_hash`.
- `requireAuth` → ambil Bearer token, verifikasi, **query ulang user**, tolak kalau `is_locked`.
- `requireRole(...roles)` → cek role.

### `server/app.js`
- `express.json({ limit: '1mb' })`
- CORS dari `CORS_ORIGIN` (kalau kosong, semua boleh).
- `/uploads` statis hanya jika bukan Vercel.
- `/api/health`.
- Router: auth, categories, sub-categories, users, stock-ins, uploads.
- 404 JSON untuk `/api`.
- Error handler:

| Kondisi | Response |
| --- | --- |
| `23505` | 409 duplikat |
| `23503` | 409 masih dipakai |
| `entity.too.large` | 413 |
| `MulterError` | 400 (khusus `LIMIT_FILE_SIZE` → pesan 5 MB) |
| lainnya | 500, di-log hanya kalau ≥ 500 |

### `server/dev.js`
Entry lokal: load `.env`, `app.listen(PORT)`.

### `server/storage.js`
Dua mode penyimpanan:

- Supabase Storage kalau env lengkap.
- Disk lokal (`uploads/`) kalau tidak.

Nama objek: `timestamp-randomhex.ext` (acak, tidak memakai nama asli). Nama asli tetap disimpan di kolom `attachment_name`. Kalau di Vercel tapi Supabase belum diset → error jelas.

### `server/routes/auth.js`
- `POST /login` → cari user case-insensitive, `bcrypt.compare`, tolak kalau lock, balikin token + user.
- `GET /me` → pulihkan sesi saat refresh.

### `server/routes/categories.js`
- `?all=1` → semua data (dropdown).
- Default → paging + search `ILIKE`.
- Create/Update → cek duplikat kode (case-insensitive) lebih dulu.
- Delete → tolak kalau masih punya sub kategori atau sudah dipakai transaksi.

### `server/routes/subCategories.js`
- `SUB_SELECT` join kategori, hasil diserialisasi jadi `{ category: { id, code, name } }`.
- `?category_id=` → filter untuk dropdown dependent.
- Duplikat nama dicek **per kategori**.
- Delete ditolak kalau sudah dipakai transaksi.

### `server/routes/users.js`
Semua admin-only.

| Endpoint | Fungsi |
| --- | --- |
| `GET /options?role=operator` | Operator aktif untuk dropdown form |
| `GET /` | Paging + search + filter role |
| `POST /` | Buat user |
| `PUT /:id` | Update, password opsional |
| `PATCH /:id/lock` | Lock/unlock |

Aturan validasi:

- Username 8–100 karakter.
- Password 8–100, wajib ada huruf besar + kecil + angka.
- Email regex.
- Admin tidak bisa menurunkan role akun sendiri.
- Admin tidak bisa mengunci akun sendiri.

### `server/routes/uploads.js`
- Multer `memoryStorage`.
- Maks 5 MB.
- Hanya `.doc`, `.docx`, `.zip`.
- Balikin `{ path, name, url }`.

### `server/routes/stockIns.js`
Modul terbesar.

**Helper**

- `SORT_COLUMNS` → whitelist sort (anti SQL injection).
- `BASE_SELECT` → join users + categories + sub_categories.
- `buildFilters()` → WHERE dinamis + params array.
- `loadItems(ids)` → satu query `ANY($1)` untuk semua transaksi (hindari N+1).
- `validateItems()` → validasi per baris (termasuk kode barang), hitung total, tolak kalau > `price_limit`.
- `resolveGeneral()` → validasi kategori/sub, **pastikan sub milik kategori yang dipilih**, tentukan operator, validasi lampiran.

**Endpoint**

| Endpoint | Fungsi |
| --- | --- |
| `GET /` | List + filter + sort + paging |
| `GET /years` | Tahun unik untuk dropdown |
| `GET /export` | Excel sesuai filter |
| `GET /:id` | Detail (edit & cetak) |
| `POST /` | Simpan baru |
| `PUT /:id` | Update |
| `PATCH /:id/verify` | Toggle verifikasi |
| `DELETE /:id` | Hapus |

**Urutan route penting:** `/years` dan `/export` didaftarkan **sebelum** `/:id`. Kalau terbalik, `"export"` akan dianggap sebagai `id`.

**Export Excel**
- 11 kolom (sama dengan tabel di layar), header berwarna, baris pertama di-freeze.
- Transaksi multi-item: kolom umum di-`mergeCells` vertikal.
- Angka `numFmt '#,##0'`.
- Dikirim sebagai buffer + header `Content-Disposition`.

**Kenapa transaksi**
Header dan item harus sukses bersama. Kalau insert item gagal di tengah, header tidak boleh tertinggal sendirian.

---

## 2.4 Frontend

### `src/main.jsx`
Urutan import CSS: Bootstrap dulu, `styles.css` terakhir (supaya custom menimpa). Provider: `BrowserRouter` → `AuthProvider` → `App`.

### `src/api.js`
- Token di `localStorage` key `jmc_token`.
- `toQuery()` buang nilai kosong.
- Header `X-Api-Path` → titip path asli untuk Vercel.
- 401 → hapus token + dispatch `jmc:unauthorized`.
- Error JSON → dilempar `ApiError`.
- `downloadFile()` → blob + `<a download>` sementara.

### `src/auth.jsx`
- Saat mount: kalau ada token, panggil `/auth/me`.
- `login()` / `logout()`.
- Dengar event `jmc:unauthorized`.
- Expose `{ user, loading, login, logout, isAdmin }`.

### `src/utils.js`
`rupiah`, `number`, `digitsOnly`, `formatDate`, `formatDateOnly`, `initials`, `roleLabel`.

### `src/App.jsx`
- `/login`
- `/print/:id` (di luar Layout, tetap wajib login)
- Route lain di dalam `Layout` + `Protected`
- `Protected` cek `loading`, `user`, `role`.
- `*` → redirect `/barang-masuk`.

### `src/components/icons.jsx`
Map nama → class Bootstrap Icons. Semua halaman pakai `<Icon name="..." />`.

### `src/components/Layout.jsx`
- Sidebar: Barang Masuk selalu; Master Data + Manajemen User hanya admin.
- Breadcrumb dari regex per path.
- Dropdown user pakai state React, tutup saat klik luar.
- Mobile: off-canvas + overlay.
- Sidebar menutup otomatis saat pindah halaman.

### `src/components/Modal.jsx`
Modal Bootstrap dikendalikan React (tanpa `bootstrap.bundle.js`).

- Render `null` saat tertutup.
- Tutup via X, backdrop, atau `Escape`.
- `modal-open` di body saat terbuka.

### `src/components/Pagination.jsx`
- ≤ 7 halaman → tampilkan semua.
- Lebih dari itu → `1 … n-1 n n+1 … last`.
- Info "Menampilkan 1–10 dari 57 data".
- Prev/next disabled di ujung.

### `src/pages/Login.jsx`
Split-screen. Redirect kalau sudah login (pakai `state.from`). Ada kotak akun demo.

### `src/pages/StockIns.jsx`
- Filter kategori → sub kategori dependent, tahun, search debounce 350 ms.
- Sort tanggal/asal/total.
- Paging 10.
- Kolom: NO, ACTION, TANGGAL, ASAL BARANG, PENERIMA, UNIT, KODE, NAMA BARANG, HARGA, JUMLAH (qty + satuan), TOTAL, STATUS.
- Tabel `rowSpan` untuk transaksi multi-item.
- Aksi: ubah, lampiran, cetak, hapus (modal).
- Toggle verifikasi update state lokal.
- Export Excel mengikuti filter + sort aktif.
- Flash message 4 detik.

### `src/pages/StockInForm.jsx`
- Admin pilih operator, operator terkunci ke dirinya.
- Field umum: operator, kategori, sub kategori, batas harga, asal barang, penerima, unit, nomor surat, lampiran.
- Tabel item: kode barang, nama, harga, jumlah, satuan, total, tgl expired.
- Sub kategori di-reset saat kategori berubah.
- Batas harga readonly dari sub terpilih.
- Grand total real-time; kalau lewat batas → alert + tombol simpan disabled.
- Tambah/hapus baris item (minimal 1).
- Masking ribuan pada harga.
- Upload divalidasi ekstensi + ukuran sebelum kirim.
- Mode edit: prefill item dan lampiran lama.

### `src/pages/Categories.jsx`
CRUD modal. Satu modal untuk tambah/edit (`editing` null = tambah), satu modal konfirmasi hapus. Error API tampil di dalam modal.

### `src/pages/SubCategories.jsx`
Sama, plus dropdown kategori dan input batas harga dengan preview rupiah.

### `src/pages/Users.jsx`
CRUD + lock. Switch hijau = aktif, merah = terkunci. Tombol untuk akun sendiri disabled. Baris diupdate lokal setelah lock/unlock.

### `src/pages/PrintLetter.jsx`
Surat A4, `window.print()`. Nomor surat fallback `BM-0001`. Nama admin tercetak kalau sudah terverifikasi, kalau belum garis titik-titik.

### `src/styles.css`
Hanya yang tidak disediakan Bootstrap: shell/sidebar/topbar, login split, tabel barang, switch, surat cetak, aturan `@media print` + `@page A4`.

---

## 2.5 Alur fitur end-to-end

### Login
1. `Login.jsx` → `auth.jsx` → `api.js` → `POST /api/auth/login`.
2. `routes/auth.js`: cari user → bcrypt → cek lock → `signToken`.
3. Token disimpan, `user` di-set, redirect.

### Tambah barang masuk
1. Form submit → `POST /api/stock-ins`.
2. `requireAuth` cek token + lock.
3. `resolveGeneral`: validasi kategori/sub, sub harus milik kategori.
4. `validateItems`: hitung total, tolak kalau > `price_limit`.
5. `withTransaction`: insert header → insert items → COMMIT.
6. Frontend redirect ke daftar + flash.

### Export Excel
1. Klik tombol → `downloadFile('/stock-ins/export', filterAktif)`.
2. Backend query ulang dengan filter + sort sama.
3. ExcelJS menyusun sheet, merge cell untuk multi-item.
4. Buffer dikirim → browser download.

### Cetak surat
1. `window.open('/print/:id')`.
2. `PrintLetter.jsx` ambil detail.
3. Render A4 → `window.print()`.

### Lock user
1. Admin klik switch → `PATCH /users/:id/lock`.
2. Server tolak kalau id = diri sendiri.
3. Update DB.
4. Request berikutnya dari user itu ditolak `requireAuth` (403).

---

## 2.6 Kalau ditanya "kenapa tidak pakai X?"

| Pertanyaan | Jawaban singkat |
| --- | --- |
| Kenapa tidak ORM (Prisma/Sequelize)? | Requirement sederhana, query-nya jelas, `pg` cukup dan lebih ringan untuk serverless. |
| Kenapa tidak pakai JS Bootstrap? | Komponen yang butuh interaksi cuma modal & dropdown, cukup dikontrol state React; tidak perlu nambah bundle. |
| Kenapa tidak bikin PDF server-side? | Kebutuhan hanya cetak surat; `window.print()` + CSS `@page` lebih sederhana dan hasilnya tetap bisa Save as PDF. |
| Kenapa tidak pakai refresh token? | Di luar scope tes; token 12 jam sudah cukup untuk demo. |
| Kenapa `max` pool cuma 3? | Supabase pooler + serverless: koneksi harus hemat, kalau tidak cepat habis. |
| Kenapa validasi tidak pakai library (zod/joi)? | Helper sendiri lebih kecil dan pesan errornya bisa langsung bahasa Indonesia. |
