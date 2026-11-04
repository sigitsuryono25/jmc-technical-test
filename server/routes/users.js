import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { HttpError, oneOf, paging, text, wrap } from '../http.js';
import { publicUser, requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const USER_SELECT =
  'SELECT id, role, username, name, email, is_locked, created_at FROM users';

function validatePassword(password, { required }) {
  if (!password) {
    if (required) throw new HttpError(400, 'Password wajib diisi');
    return null;
  }
  const value = String(password);
  if (value.length < 8 || value.length > 100) {
    throw new HttpError(400, 'Password harus 8 - 100 karakter');
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw new HttpError(400, 'Password harus mengandung huruf besar, huruf kecil, dan angka');
  }
  return value;
}

function validateEmail(value) {
  const email = text(value, 'Email', { required: true, max: 100, min: 8 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Format email tidak valid');
  }
  return email;
}

router.get(
  '/options',
  wrap(async (req, res) => {
    const role = req.query.role || 'operator';
    const { rows } = await q(
      'SELECT id, name, username, role FROM users WHERE role = $1 AND is_locked = FALSE ORDER BY name ASC',
      [role]
    );
    res.json({ data: rows });
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, offset } = paging(req);
    const search = `%${String(req.query.search || '').trim()}%`;
    const role = req.query.role ? String(req.query.role) : null;

    const [{ rows }, count] = await Promise.all([
      q(
        `${USER_SELECT}
         WHERE (username ILIKE $1 OR name ILIKE $1)
           AND ($2::text IS NULL OR role = $2)
         ORDER BY id ASC
         LIMIT $3 OFFSET $4`,
        [search, role, limit, offset]
      ),
      q(
        `SELECT COUNT(*)::int AS total FROM users
         WHERE (username ILIKE $1 OR name ILIKE $1)
           AND ($2::text IS NULL OR role = $2)`,
        [search, role]
      ),
    ]);

    const total = count.rows[0].total;
    res.json({
      data: rows,
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const role = oneOf(req.body.role, 'Role', ['admin', 'operator'], { required: true });
    const username = text(req.body.username, 'Username', { required: true, max: 100, min: 8 });
    const password = validatePassword(req.body.password, { required: true });
    const name = text(req.body.name, 'Nama', { required: true, max: 100, min: 8 });
    const email = validateEmail(req.body.email);

    const duplicate = await q('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (duplicate.rowCount) throw new HttpError(409, 'Username sudah digunakan');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(
      `INSERT INTO users (role, username, password_hash, name, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, username, name, email, is_locked, created_at`,
      [role, username, hash, name, email]
    );
    res.status(201).json({ data: rows[0], message: 'User berhasil ditambahkan' });
  })
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const role = oneOf(req.body.role, 'Role', ['admin', 'operator'], { required: true });
    const username = text(req.body.username, 'Username', { required: true, max: 100, min: 8 });
    const password = validatePassword(req.body.password, { required: false });
    const name = text(req.body.name, 'Nama', { required: true, max: 100, min: 8 });
    const email = validateEmail(req.body.email);

    const existing = await q('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'User tidak ditemukan');

    const duplicate = await q(
      'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2',
      [username, id]
    );
    if (duplicate.rowCount) throw new HttpError(409, 'Username sudah digunakan');

    if (existing.rows[0].id === req.user.id && role !== 'admin') {
      throw new HttpError(400, 'Anda tidak dapat mengubah role akun sendiri');
    }

    const params = [role, username, name, email];
    let passwordSql = '';
    if (password) {
      params.push(await bcrypt.hash(password, 10));
      passwordSql = `, password_hash = $${params.length}`;
    }
    params.push(id);

    const { rows } = await q(
      `UPDATE users
       SET role = $1, username = $2, name = $3, email = $4${passwordSql}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, role, username, name, email, is_locked, created_at`,
      params
    );
    res.json({ data: rows[0], message: 'User berhasil diperbarui' });
  })
);

router.patch(
  '/:id/lock',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const isLocked = req.body.is_locked;

    if (typeof isLocked !== 'boolean') {
      throw new HttpError(400, 'Status lock wajib dikirim (true/false)');
    }
    if (id === req.user.id && isLocked) {
      throw new HttpError(400, 'Anda tidak dapat mengunci akun sendiri');
    }

    const { rows } = await q(
      `UPDATE users SET is_locked = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, role, username, name, email, is_locked, created_at`,
      [isLocked, id]
    );
    if (!rows[0]) throw new HttpError(404, 'User tidak ditemukan');

    res.json({
      data: rows[0],
      message: isLocked ? 'User berhasil dikunci' : 'User berhasil dibuka',
    });
  })
);

export default router;
