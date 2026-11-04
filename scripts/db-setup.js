import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, q } from '../server/db.js';

const data = [
  {
    origin: 'PT. Sinar Abadi',
    letter: '001/SI/2026',
    recipient: 'Liana',
    unit: 'Gudang Utama',
    category: 'PK',
    sub: 'Alat Tulis',
    verified: true,
    createdAt: '2026-10-24T10:00:00+07:00',
    items: [
      { code: 'ATK0001', name: 'Kertas HVS A4 60gr', price: 61000, qty: 4, unit: 'Rim', expired: null },
      { code: 'ATK0002', name: 'Ballpoint Pilot Std', price: 20000, qty: 5, unit: 'Dus', expired: null },
    ],
  },
  {
    origin: 'PT. Sejahtera',
    letter: '002/SI/2026',
    recipient: 'Liana',
    unit: 'Gudang Utama',
    category: 'PK',
    sub: 'Alat Tulis',
    verified: true,
    createdAt: '2026-10-20T11:00:00+07:00',
    items: [
      { code: 'ATK0001', name: 'Kertas HVS A4 60gr', price: 61000, qty: 1, unit: 'Rim', expired: null },
      { code: 'ATK0002', name: 'Ballpoint Pilot Std', price: 20000, qty: 1, unit: 'Dus', expired: null },
    ],
  },
  {
    origin: 'CV. Maju Bersama',
    letter: '003/SI/2026',
    recipient: 'Budi Santoso',
    unit: 'Gudang Cabang',
    category: 'PK',
    sub: 'Perabotan Kantor',
    verified: false,
    createdAt: '2026-09-14T09:30:00+07:00',
    items: [{ code: 'PRB0001', name: 'Meja Kerja 120cm', price: 1250000, qty: 2, unit: 'Unit', expired: null }],
  },
  {
    origin: 'Toko Sumber Rejeki',
    letter: '004/SI/2026',
    recipient: 'Rina Wati',
    unit: 'Gudang Utama',
    category: 'FD',
    sub: 'Makanan Ringan',
    verified: false,
    createdAt: '2026-08-02T13:15:00+07:00',
    items: [
      { code: 'MKN0001', name: 'Biskuit Cokelat', price: 12000, qty: 20, unit: 'Box', expired: '2027-02-28' },
      { code: 'MNM0001', name: 'Kopi Sachet', price: 2500, qty: 40, unit: 'Pcs', expired: '2027-01-31' },
    ],
  },
  {
    origin: 'PT. Sinar Abadi',
    letter: null,
    recipient: 'Andi Pratama',
    unit: 'Gudang Produksi',
    category: 'FD',
    sub: 'Minuman',
    verified: true,
    createdAt: '2025-12-11T08:45:00+07:00',
    items: [{ code: 'MNM0002', name: 'Air Mineral 600ml', price: 3500, qty: 48, unit: 'Botol', expired: '2026-12-31' }],
  },
  {
    origin: 'PT. Andalan Supply',
    letter: '006/SI/2025',
    recipient: 'Budi Santoso',
    unit: 'Gudang Cabang',
    category: 'PK',
    sub: 'Alat Tulis',
    verified: true,
    createdAt: '2025-06-05T14:20:00+07:00',
    items: [{ code: 'ATK0003', name: 'Map Plastik', price: 4500, qty: 30, unit: 'Pcs', expired: null }],
  },
  {
    origin: 'CV. Media Cetak',
    letter: '007/SI/2024',
    recipient: 'Liana',
    unit: 'Gudang Utama',
    category: 'PK',
    sub: 'Perabotan Kantor',
    verified: true,
    createdAt: '2024-11-19T10:10:00+07:00',
    items: [{ code: 'PRB0002', name: 'Kursi Kerja Ergonomis', price: 950000, qty: 3, unit: 'Unit', expired: null }],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL belum di-set. Salin .env.example menjadi .env terlebih dahulu.');
    process.exit(1);
  }

  const schema = await fs.readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await q(schema);
  console.log('Schema siap.');

  const admin = {
    role: 'admin',
    username: 'administrator',
    password: 'Admin12345',
    name: 'Administrator',
    email: 'admin@jmc.co.id',
  };
  const operators = [
    {
      role: 'operator',
      username: 'operator1',
      password: 'Operator12345',
      name: 'Joko Susanto',
      email: 'joko@jmc.co.id',
    },
    {
      role: 'operator',
      username: 'operator2',
      password: 'Operator12345',
      name: 'Siti Aminah',
      email: 'siti@jmc.co.id',
    },
    {
      role: 'operator',
      username: 'operator3',
      password: 'Operator12345',
      name: 'Rudi Hartono',
      email: 'rudi@jmc.co.id',
    },
  ];

  for (const user of [admin, ...operators]) {
    const hash = await bcrypt.hash(user.password, 10);
    await q(
      `INSERT INTO users (role, username, password_hash, name, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      [user.role, user.username, hash, user.name, user.email]
    );
  }
  console.log('Akun seed siap (administrator / operator1 / operator2 / operator3).');

  const categories = [
    ['PK', 'Perlengkapan Kantor'],
    ['FD', 'Makanan & Minuman'],
    ['EL', 'Elektronik'],
    ['KB', 'Kebersihan'],
  ];
  for (const [code, name] of categories) {
    await q(
      'INSERT INTO categories (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [code, name]
    );
  }

  const subCategories = [
    ['PK', 'Alat Tulis', 5000000],
    ['PK', 'Perabotan Kantor', 7500000],
    ['PK', 'Kertas & Cetakan', 3000000],
    ['FD', 'Makanan Ringan', 2000000],
    ['FD', 'Minuman', 1500000],
    ['EL', 'Komputer & Aksesoris', 25000000],
    ['EL', 'Peralatan Listrik', 10000000],
    ['KB', 'Sabun & Pembersih', 1200000],
  ];
  for (const [categoryCode, name, limit] of subCategories) {
    await q(
      `INSERT INTO sub_categories (category_id, name, price_limit)
       SELECT id, $2::varchar, $3::numeric FROM categories WHERE code = $1::varchar
       AND NOT EXISTS (
         SELECT 1 FROM sub_categories s
         JOIN categories c ON c.id = s.category_id
         WHERE c.code = $1::varchar AND LOWER(s.name) = LOWER($2::text)
       )`,
      [categoryCode, name, limit]
    );
  }
  console.log('Master data kategori & sub kategori siap.');

  const stockCount = await q('SELECT COUNT(*)::int AS total FROM stock_ins');
  if (stockCount.rows[0].total === 0) {
    const operator = await q("SELECT id FROM users WHERE username = 'operator1'");
    const operatorId = operator.rows[0].id;

    for (const entry of data) {
      const sub = await q(
        `SELECT s.id, s.category_id FROM sub_categories s
         JOIN categories c ON c.id = s.category_id
         WHERE c.code = $1 AND s.name = $2`,
        [entry.category, entry.sub]
      );
      if (!sub.rowCount) continue;
      const { id: subCategoryId, category_id: categoryId } = sub.rows[0];

      const total = entry.items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const inserted = await q(
        `INSERT INTO stock_ins
           (operator_id, category_id, sub_category_id, origin, recipient, unit,
            letter_number, total_price, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
        [
          operatorId,
          categoryId,
          subCategoryId,
          entry.origin,
          entry.recipient,
          entry.unit,
          entry.letter,
          total,
          entry.verified,
          entry.createdAt,
        ]
      );

      for (const item of entry.items) {
        await q(
          `INSERT INTO stock_in_items
             (stock_in_id, code, name, price, quantity, unit, total, expired_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            inserted.rows[0].id,
            item.code,
            item.name,
            item.price,
            item.qty,
            item.unit,
            item.price * item.qty,
            item.expired,
          ]
        );
      }
    }
    console.log(`Seed ${data.length} transaksi barang masuk selesai.`);
  } else {
    console.log('Data barang masuk sudah ada, seed transaksi dilewati.');
  }

  console.log('\nSelesai. Login dengan: administrator / Admin12345');
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
