import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { HttpError, text, wrap } from '../http.js';
import { publicUser, requireAuth, signToken } from '../auth.js';

const router = Router();

router.post(
  '/login',
  wrap(async (req, res) => {
    const username = text(req.body.username, 'Username', { required: true, max: 100 });
    const password = req.body.password ? String(req.body.password) : '';
    if (!password) throw new HttpError(400, 'Password wajib diisi');

    const { rows } = await q('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Username atau password salah');
    }
    if (user.is_locked) {
      throw new HttpError(403, 'Akun Anda terkunci, silakan hubungi administrator');
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

export default router;
