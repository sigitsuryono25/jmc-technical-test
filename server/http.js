export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function paging(req, defaultLimit = 10) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const rawLimit = Number.parseInt(req.query.limit, 10) || defaultLimit;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function text(value, field, { required = false, max = 255, min = 0 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new HttpError(400, `${field} wajib diisi`);
    return null;
  }
  const result = String(value).trim();
  if (min && result.length < min) throw new HttpError(400, `${field} minimal ${min} karakter`);
  if (max && result.length > max) throw new HttpError(400, `${field} maksimal ${max} karakter`);
  return result;
}

export function money(value, field, { required = false, min = 0 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new HttpError(400, `${field} wajib diisi`);
    return null;
  }
  const normalized = String(value).replace(/[^\d.-]/g, '');
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new HttpError(400, `${field} harus berupa angka`);
  if (number < min) throw new HttpError(400, `${field} tidak boleh kurang dari ${min}`);
  return Math.round(number * 100) / 100;
}

export function integer(value, field, { required = false, min = 1 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new HttpError(400, `${field} wajib diisi`);
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new HttpError(400, `${field} harus berupa bilangan bulat`);
  if (number < min) throw new HttpError(400, `${field} minimal ${min}`);
  return number;
}

export function dateOrNull(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const result = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new HttpError(400, `${field} harus berformat YYYY-MM-DD`);
  }
  const parsed = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${field} tidak valid`);
  return result;
}

export function oneOf(value, field, allowed, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} wajib diisi`);
    return null;
  }
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${field} harus salah satu dari: ${allowed.join(', ')}`);
  }
  return value;
}
