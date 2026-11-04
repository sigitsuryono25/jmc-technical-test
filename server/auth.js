import jwt from 'jsonwebtoken';
import { q } from './db.js';
import { HttpError } from './http.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-jangan-dipakai-di-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    name: user.name,
    email: user.email,
    is_locked: user.is_locked,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Silakan login terlebih dahulu');

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new HttpError(401, 'Sesi Anda berakhir, silakan login kembali');
    }

    // Ambil ulang user dari DB supaya status lock langsung berlaku
    // walau token-nya masih valid.
    const { rows } = await q('SELECT * FROM users WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user) throw new HttpError(401, 'Akun tidak ditemukan');
    if (user.is_locked) throw new HttpError(403, 'Akun Anda terkunci, hubungi administrator');

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Silakan login terlebih dahulu'));
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'Anda tidak memiliki hak akses untuk aksi ini'));
  }
  return next();
};
