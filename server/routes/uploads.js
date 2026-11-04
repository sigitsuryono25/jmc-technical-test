import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import { ALLOWED_EXTENSIONS, attachmentUrl, saveAttachment } from '../storage.js';
import { HttpError, wrap } from '../http.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = `.${(file.originalname.split('.').pop() || '').toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new HttpError(400, 'Lampiran harus berformat doc, docx, atau zip'));
    }
    return cb(null, true);
  },
});

router.post(
  '/attachment',
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File lampiran wajib diunggah');
    const saved = await saveAttachment(req.file);
    res.status(201).json({
      data: { path: saved.path, name: saved.name, url: attachmentUrl(saved.path) },
      message: 'Lampiran berhasil diunggah',
    });
  })
);

export default router;
