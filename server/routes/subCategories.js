import { Router } from 'express';
import { q } from '../db.js';
import { HttpError, money, paging, text, wrap } from '../http.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

const SUB_SELECT = `
  SELECT s.id, s.category_id, c.code AS category_code, c.name AS category_name,
         s.name, s.price_limit, s.created_at
  FROM sub_categories s
  JOIN categories c ON c.id = s.category_id`;

function serialize(row) {
  return {
    id: row.id,
    category_id: row.category_id,
    category: { id: row.category_id, code: row.category_code, name: row.category_name },
    name: row.name,
    price_limit: Number(row.price_limit),
    created_at: row.created_at,
  };
}

router.get(
  '/',
  wrap(async (req, res) => {
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;

    if (req.query.all) {
      const { rows } = await q(
        `${SUB_SELECT}
         WHERE ($1::int IS NULL OR s.category_id = $1)
         ORDER BY c.name ASC, s.name ASC`,
        [categoryId]
      );
      return res.json({ data: rows.map(serialize) });
    }

    const { page, limit, offset } = paging(req);
    const search = `%${String(req.query.search || '').trim()}%`;

    const [{ rows }, count] = await Promise.all([
      q(
        `${SUB_SELECT}
         WHERE (c.name ILIKE $1 OR s.name ILIKE $1)
           AND ($2::int IS NULL OR s.category_id = $2)
         ORDER BY c.name ASC, s.name ASC
         LIMIT $3 OFFSET $4`,
        [search, categoryId, limit, offset]
      ),
      q(
        `SELECT COUNT(*)::int AS total
         FROM sub_categories s JOIN categories c ON c.id = s.category_id
         WHERE (c.name ILIKE $1 OR s.name ILIKE $1)
           AND ($2::int IS NULL OR s.category_id = $2)`,
        [search, categoryId]
      ),
    ]);

    const total = count.rows[0].total;
    return res.json({
      data: rows.map(serialize),
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

router.post(
  '/',
  requireRole('admin'),
  wrap(async (req, res) => {
    const categoryId = Number(req.body.category_id);
    const name = text(req.body.name, 'Nama sub kategori', { required: true, max: 100 });
    const priceLimit = money(req.body.price_limit, 'Batas harga', { required: true, min: 1 });

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      throw new HttpError(400, 'Kategori wajib dipilih');
    }
    const category = await q('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (!category.rowCount) throw new HttpError(404, 'Kategori tidak ditemukan');

    const duplicate = await q(
      'SELECT 1 FROM sub_categories WHERE category_id = $1 AND LOWER(name) = LOWER($2)',
      [categoryId, name]
    );
    if (duplicate.rowCount) throw new HttpError(409, 'Nama sub kategori sudah ada pada kategori ini');

    const inserted = await q(
      `INSERT INTO sub_categories (category_id, name, price_limit)
       VALUES ($1, $2, $3) RETURNING id`,
      [categoryId, name, priceLimit]
    );
    const { rows } = await q(`${SUB_SELECT} WHERE s.id = $1`, [inserted.rows[0].id]);
    res.status(201).json({ data: serialize(rows[0]), message: 'Sub kategori berhasil ditambahkan' });
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const categoryId = Number(req.body.category_id);
    const name = text(req.body.name, 'Nama sub kategori', { required: true, max: 100 });
    const priceLimit = money(req.body.price_limit, 'Batas harga', { required: true, min: 1 });

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      throw new HttpError(400, 'Kategori wajib dipilih');
    }

    const duplicate = await q(
      `SELECT 1 FROM sub_categories
       WHERE category_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`,
      [categoryId, name, id]
    );
    if (duplicate.rowCount) throw new HttpError(409, 'Nama sub kategori sudah ada pada kategori ini');

    const updated = await q(
      `UPDATE sub_categories
       SET category_id = $1, name = $2, price_limit = $3, updated_at = NOW()
       WHERE id = $4 RETURNING id`,
      [categoryId, name, priceLimit, id]
    );
    if (!updated.rowCount) throw new HttpError(404, 'Sub kategori tidak ditemukan');

    const { rows } = await q(`${SUB_SELECT} WHERE s.id = $1`, [id]);
    res.json({ data: serialize(rows[0]), message: 'Sub kategori berhasil diperbarui' });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const used = await q('SELECT COUNT(*)::int AS total FROM stock_ins WHERE sub_category_id = $1', [
      id,
    ]);
    if (used.rows[0].total > 0) {
      throw new HttpError(409, 'Sub kategori tidak bisa dihapus karena sudah dipakai data barang masuk');
    }
    const { rows } = await q('DELETE FROM sub_categories WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new HttpError(404, 'Sub kategori tidak ditemukan');
    res.json({ message: 'Sub kategori berhasil dihapus' });
  })
);

export default router;
