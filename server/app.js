import express from 'express';
import cors from 'cors';
import path from 'node:path';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import subCategoryRoutes from './routes/subCategories.js';
import userRoutes from './routes/users.js';
import stockInRoutes from './routes/stockIns.js';
import uploadRoutes from './routes/uploads.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: false,
  })
);

if (!process.env.VERCEL) {
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'))
  );
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stock-ins', stockInRoutes);
app.use('/api/uploads', uploadRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.code === '23505') {
    return res.status(409).json({ message: 'Data sudah digunakan (duplikat)' });
  }
  if (err?.code === '23503') {
    return res.status(409).json({ message: 'Data masih dipakai oleh data lain' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Ukuran data terlalu besar' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran lampiran maksimal 5 MB'
          : 'Lampiran tidak valid',
    });
  }

  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);
  return res.status(status).json({ message: err.message || 'Terjadi kesalahan pada server' });
});

export default app;
