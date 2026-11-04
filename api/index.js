import 'dotenv/config';
import app from '../server/app.js';

/**
 * Entry point Vercel Function.
 *
 * vercel.json mengarahkan /api/* ke function ini dan menitipkan path asli
 * pada query `__path`, contoh: /api/index?__path=stock-ins/12.
 * Di lokal (dev) function ini juga bisa dijalankan langsung.
 */
export default function handler(req, res) {
  const headerPath =
    typeof req.headers?.['x-api-path'] === 'string' ? req.headers['x-api-path'] : '';
  const rawPath = req.query?.__path;
  const pathParam = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
  const queryIndex = typeof req.url === 'string' ? req.url.indexOf('?') : -1;
  const search = queryIndex >= 0 ? req.url.slice(queryIndex) : '';

  if (headerPath.startsWith('/')) {
    req.url = `/api${headerPath}`;
  } else if (pathParam) {
    req.url = `/api/${String(pathParam).replace(/^\/+/, '')}${search}`;
  } else if (typeof req.url === 'string' && req.url.startsWith('/api/index')) {
    // Fallback jika rewrite tidak menyertakan __path.
    req.url = `/api${req.url.slice('/api/index'.length)}`;
  }

  return app(req, res);
}
