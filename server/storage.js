import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

export const ALLOWED_EXTENSIONS = ['.doc', '.docx', '.zip'];

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const BUCKET = process.env.SUPABASE_BUCKET || 'lampiran';
const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

export function validateAttachmentExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new HttpError(400, 'Lampiran harus berformat doc, docx, atau zip');
  }
  return ext;
}

export async function saveAttachment(file) {
  const ext = validateAttachmentExtension(file.originalname);
  const objectName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const safeName = file.originalname.slice(0, 255);

  if (supabase) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new HttpError(500, `Gagal mengunggah lampiran: ${error.message}`);
  } else {
    // Di Vercel filesystem tidak writable, jadi Supabase Storage wajib dikonfigurasi.
    if (process.env.VERCEL) {
      throw new HttpError(
        500,
        'Storage lampiran belum dikonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, objectName), file.buffer);
  }

  return { path: objectName, name: safeName };
}

export function attachmentUrl(objectName) {
  if (!objectName) return null;
  if (supabase) {
    return supabase.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;
  }
  return `/uploads/${objectName}`;
}
