import { Router } from 'express';
import { q } from '../db.js';
import { HttpError, paging, text, wrap } from '../http.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

const CATEGORY_SELECT = 'SELECT id, code, name, created_at FROM categories';

router.get(
  '/',
  wrap(async (req, res) => {
    if (req.query.all) {
      const { rows } = await q(`${CATEGORY_SELECT} ORDER BY name ASC`);
      return res.json({ data: rows });
    }

    const { page, limit, offset } = paging(req);
    const search = `%${String(req.query.search || '').trim()}%`;

    const [{ rows }, count] = await Promise.all([
      q(
        `${CATEGORY_SELECT}
         WHERE code ILIKE $1 OR name ILIKE $1
         ORDER BY code ASC
         LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      ),
      q('SELECT COUNT(*)::int AS total FROM categories WHERE code ILIKE $1 OR name ILIKE $1', [
        search,
      ]),
    ]);

    const total = count.rows[0].total;
    return res.json({
      data: rows,
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

router.post(
  '/',
  requireRole('admin'),
  wrap(async (req, res) => {
    const code = text(req.body.code, 'Kode kategori', { required: true, max: 10 });
    const name = text(req.body.name, 'Nama kategori', { required: true, max: 100 });

    const duplicate = await q('SELECT 1 FROM categories WHERE LOWER(code) = LOWER($1)', [code]);
    if (duplicate.rowCount) throw new HttpError(409, 'Kode kategori sudah digunakan');

    const { rows } = await q(
      'INSERT INTO categories (code, name) VALUES ($1, $2) RETURNING id, code, name, created_at',
      [code, name]
    );
    res.status(201).json({ data: rows[0], message: 'Kategori berhasil ditambahkan' });
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const code = text(req.body.code, 'Kode kategori', { required: true, max: 10 });
    const name = text(req.body.name, 'Nama kategori', { required: true, max: 100 });

    const duplicate = await q(
      'SELECT 1 FROM categories WHERE LOWER(code) = LOWER($1) AND id <> $2',
      [code, id]
    );
    if (duplicate.rowCount) throw new HttpError(409, 'Kode kategori sudah digunakan');

    const { rows } = await q(
      `UPDATE categories SET code = $1, name = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, code, name, created_at`,
      [code, name, id]
    );
    if (!rows[0]) throw new HttpError(404, 'Kategori tidak ditemukan');
    res.json({ data: rows[0], message: 'Kategori berhasil diperbarui' });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const used = await q(
      `SELECT
         (SELECT COUNT(*)::int FROM sub_categories WHERE category_id = $1) AS sub_categories,
         (SELECT COUNT(*)::int FROM stock_ins WHERE category_id = $1) AS stock_ins`,
      [id]
    );
    if (used.rows[0].sub_categories > 0) {
      throw new HttpError(409, 'Kategori tidak bisa dihapus karena masih memiliki sub kategori');
    }
    if (used.rows[0].stock_ins > 0) {
      throw new HttpError(409, 'Kategori tidak bisa dihapus karena sudah dipakai data barang masuk');
    }

    const { rows } = await q('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new HttpError(404, 'Kategori tidak ditemukan');
    res.json({ message: 'Kategori berhasil dihapus' });
  })
);

export default router;
