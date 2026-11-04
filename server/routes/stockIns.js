import { Router } from 'express';
import ExcelJS from 'exceljs';
import { q, withTransaction } from '../db.js';
import {
  dateOrNull,
  HttpError,
  integer,
  money,
  paging,
  text,
  wrap,
} from '../http.js';
import { requireAuth } from '../auth.js';
import { attachmentUrl, validateAttachmentExtension } from '../storage.js';

const router = Router();
router.use(requireAuth);

const SORT_COLUMNS = {
  date: 'si.created_at',
  origin: 'si.origin',
  total: 'si.total_price',
};

const BASE_SELECT = `
  SELECT si.id, si.operator_id, si.category_id, si.sub_category_id, si.origin,
         si.recipient, si.unit,
         si.letter_number, si.attachment_path, si.attachment_name, si.total_price,
         si.is_verified, si.created_at,
         u.name AS operator_name,
         c.code AS category_code, c.name AS category_name,
         sc.name AS sub_category_name, sc.price_limit
  FROM stock_ins si
  JOIN users u ON u.id = si.operator_id
  JOIN categories c ON c.id = si.category_id
  JOIN sub_categories sc ON sc.id = si.sub_category_id`;

function buildFilters(query) {
  const conditions = [];
  const params = [];

  const categoryId = Number(query.category_id);
  if (Number.isInteger(categoryId) && categoryId > 0) {
    params.push(categoryId);
    conditions.push(`si.category_id = $${params.length}`);
  }

  const subCategoryId = Number(query.sub_category_id);
  if (Number.isInteger(subCategoryId) && subCategoryId > 0) {
    params.push(subCategoryId);
    conditions.push(`si.sub_category_id = $${params.length}`);
  }

  if (query.year && /^\d{4}$/.test(String(query.year))) {
    params.push(Number(query.year));
    conditions.push(`EXTRACT(YEAR FROM si.created_at) = $${params.length}`);
  }

  const search = String(query.search || '').trim();
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(si.origin ILIKE $${params.length} OR sc.name ILIKE $${params.length})`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function serializeItem(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    price: Number(row.price),
    quantity: row.quantity,
    unit: row.unit,
    total: Number(row.total),
    expired_date: row.expired_date,
  };
}

function serializeStockIn(row, items) {
  return {
    id: row.id,
    created_at: row.created_at,
    origin: row.origin,
    recipient: row.recipient,
    unit: row.unit,
    letter_number: row.letter_number,
    attachment_path: row.attachment_path,
    attachment_name: row.attachment_name,
    attachment_url: attachmentUrl(row.attachment_path),
    total_price: Number(row.total_price),
    is_verified: row.is_verified,
    operator: { id: row.operator_id, name: row.operator_name },
    category: { id: row.category_id, code: row.category_code, name: row.category_name },
    sub_category: {
      id: row.sub_category_id,
      name: row.sub_category_name,
      price_limit: Number(row.price_limit),
    },
    items: items.map(serializeItem),
  };
}

async function loadItems(ids) {
  if (!ids.length) return new Map();
  const { rows } = await q(
    'SELECT * FROM stock_in_items WHERE stock_in_id = ANY($1::int[]) ORDER BY id ASC',
    [ids]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.stock_in_id)) map.set(row.stock_in_id, []);
    map.get(row.stock_in_id).push(row);
  }
  return map;
}

function validateItems(rawItems, priceLimit) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, 'Minimal satu barang harus diisi');
  }
  if (rawItems.length > 100) {
    throw new HttpError(400, 'Maksimal 100 baris barang dalam satu transaksi');
  }

  const items = rawItems.map((raw, index) => {
    const row = index + 1;
    const code = text(raw.code, `Kode barang baris ${row}`, { max: 30 });
    const name = text(raw.name, `Nama barang baris ${row}`, { required: true, max: 200 });
    const price = money(raw.price, `Harga baris ${row}`, { required: true, min: 0.01 });
    const quantity = integer(raw.quantity, `Jumlah barang baris ${row}`, {
      required: true,
      min: 1,
    });
    const unit = text(raw.unit, `Satuan baris ${row}`, { required: true, max: 40 });
    const expiredDate = dateOrNull(raw.expired_date, `Tgl expired baris ${row}`);

    return {
      code,
      name,
      price,
      quantity,
      unit,
      expiredDate,
      total: Math.round(price * quantity * 100) / 100,
    };
  });

  const grandTotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  // Frontend sudah cek, tapi tetap divalidasi di sini supaya tidak bisa dilewati lewat API.
  if (grandTotal > priceLimit) {
    throw new HttpError(
      400,
      `Total harga (Rp ${formatMoney(grandTotal)}) melebihi batas harga sub kategori (Rp ${formatMoney(
        priceLimit
      )})`
    );
  }
  return { items, grandTotal };
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID').format(value);
}

async function resolveGeneral(body, user) {
  const categoryId = Number(body.category_id);
  const subCategoryId = Number(body.sub_category_id);
  const origin = text(body.origin, 'Asal barang', { required: true, max: 200 });
  const recipient = text(body.recipient, 'Penerima', { max: 100 });
  const unit = text(body.unit, 'Unit', { max: 100 });
  const letterNumber = text(body.letter_number, 'Nomor surat', { max: 100 });

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    throw new HttpError(400, 'Kategori wajib dipilih');
  }
  if (!Number.isInteger(subCategoryId) || subCategoryId < 1) {
    throw new HttpError(400, 'Sub kategori wajib dipilih');
  }

  const { rows } = await q(
    `SELECT s.id, s.name, s.price_limit, s.category_id
     FROM sub_categories s WHERE s.id = $1`,
    [subCategoryId]
  );
  const subCategory = rows[0];
  if (!subCategory) throw new HttpError(404, 'Sub kategori tidak ditemukan');
  if (subCategory.category_id !== categoryId) {
    throw new HttpError(400, 'Sub kategori tidak sesuai dengan kategori yang dipilih');
  }

  let operatorId = user.id;
  if (user.role === 'admin' && body.operator_id) {
    operatorId = Number(body.operator_id);
    const operator = await q("SELECT id FROM users WHERE id = $1 AND role = 'operator'", [
      operatorId,
    ]);
    if (!operator.rowCount) throw new HttpError(404, 'Operator tidak ditemukan');
  }

  let attachmentPath = null;
  let attachmentName = null;
  if (body.attachment_path) {
    attachmentPath = String(body.attachment_path).slice(0, 255);
    validateAttachmentExtension(attachmentPath);
    attachmentName = text(body.attachment_name, 'Nama lampiran', { max: 255 }) || attachmentPath;
  }

  return {
    operatorId,
    categoryId,
    subCategoryId,
    origin,
    recipient,
    unit,
    letterNumber,
    attachmentPath,
    attachmentName,
    priceLimit: Number(subCategory.price_limit),
  };
}

async function insertItems(client, stockInId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO stock_in_items
         (stock_in_id, code, name, price, quantity, unit, total, expired_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        stockInId,
        item.code,
        item.name,
        item.price,
        item.quantity,
        item.unit,
        item.total,
        item.expiredDate,
      ]
    );
  }
}

router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, offset } = paging(req);
    const { where, params } = buildFilters(req.query);
    const sortColumn = SORT_COLUMNS[req.query.sort] || SORT_COLUMNS.date;
    const direction = String(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const listParams = [...params, limit, offset];
    const [{ rows }, count] = await Promise.all([
      q(
        `${BASE_SELECT} ${where}
         ORDER BY ${sortColumn} ${direction}, si.id DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      q(`SELECT COUNT(*)::int AS total FROM stock_ins si
         JOIN categories c ON c.id = si.category_id
         JOIN sub_categories sc ON sc.id = si.sub_category_id
         ${where}`, params),
    ]);

    const items = await loadItems(rows.map((row) => row.id));
    const total = count.rows[0].total;

    res.json({
      data: rows.map((row) => serializeStockIn(row, items.get(row.id) || [])),
      meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

router.get(
  '/years',
  wrap(async (req, res) => {
    const { rows } = await q(
      `SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
       FROM stock_ins ORDER BY year DESC`
    );
    res.json({ data: rows.map((row) => row.year) });
  })
);

router.get(
  '/export',
  wrap(async (req, res) => {
    const { where, params } = buildFilters(req.query);
    const sortColumn = SORT_COLUMNS[req.query.sort] || SORT_COLUMNS.date;
    const direction = String(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await q(
      `${BASE_SELECT} ${where} ORDER BY ${sortColumn} ${direction}, si.id DESC`,
      params
    );
    const items = await loadItems(rows.map((row) => row.id));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aplikasi Pengelolaan Barang';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Barang Masuk');

    sheet.columns = [
      { header: 'NO', key: 'no', width: 6 },
      { header: 'TANGGAL', key: 'date', width: 18 },
      { header: 'ASAL BARANG', key: 'origin', width: 30 },
      { header: 'PENERIMA', key: 'recipient', width: 20 },
      { header: 'UNIT', key: 'unit', width: 20 },
      { header: 'KODE', key: 'code', width: 14 },
      { header: 'NAMA BARANG', key: 'name', width: 30 },
      { header: 'HARGA (Rp.)', key: 'price', width: 15 },
      { header: 'JUMLAH', key: 'qty', width: 12 },
      { header: 'TOTAL (Rp.)', key: 'total', width: 16 },
      { header: 'STATUS', key: 'status', width: 14 },
    ];

    const header = sheet.getRow(1);
    header.height = 24;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86AB' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      };
    });

    let cursor = 2;
    rows.forEach((row, index) => {
      const rowItems = items.get(row.id) || [];
      const startRow = cursor;
      const date = new Date(row.created_at);
      const dateLabel = `${String(date.getDate()).padStart(2, '0')}/${String(
        date.getMonth() + 1
      ).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;

      rowItems.forEach((item, itemIndex) => {
        const excelRow = sheet.getRow(startRow + itemIndex);
        excelRow.getCell(1).value = itemIndex === 0 ? index + 1 : null;
        excelRow.getCell(2).value = itemIndex === 0 ? dateLabel : null;
        excelRow.getCell(3).value = itemIndex === 0 ? row.origin : null;
        excelRow.getCell(4).value = itemIndex === 0 ? row.recipient || '-' : null;
        excelRow.getCell(5).value = itemIndex === 0 ? row.unit || '-' : null;
        excelRow.getCell(6).value = item.code || '-';
        excelRow.getCell(7).value = item.name;
        excelRow.getCell(8).value = Number(item.price);
        excelRow.getCell(9).value = `${item.quantity} ${item.unit}`;
        excelRow.getCell(10).value = Number(item.total);
        excelRow.getCell(11).value =
          itemIndex === 0 ? (row.is_verified ? 'Terverifikasi' : 'Belum') : null;

        for (let col = 1; col <= 11; col += 1) {
          const cell = excelRow.getCell(col);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE1E7EC' } },
            left: { style: 'thin', color: { argb: 'FFE1E7EC' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E7EC' } },
            right: { style: 'thin', color: { argb: 'FFE1E7EC' } },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: [8, 10].includes(col) ? 'right' : 'left',
            wrapText: true,
          };
        }
        excelRow.getCell(8).numFmt = '#,##0';
        excelRow.getCell(10).numFmt = '#,##0';
      });

      if (rowItems.length > 1) {
        for (const col of [1, 2, 3, 4, 5, 11]) {
          sheet.mergeCells(startRow, col, startRow + rowItems.length - 1, col);
          sheet.getCell(startRow, col).alignment = {
            vertical: 'middle',
            horizontal: col === 1 ? 'center' : 'left',
            wrapText: true,
          };
        }
      }
      cursor += Math.max(1, rowItems.length);
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `barang-masuk-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'ID tidak valid');

    const { rows } = await q(`${BASE_SELECT} WHERE si.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, 'Data barang masuk tidak ditemukan');
    const items = await loadItems([id]);
    res.json({ data: serializeStockIn(rows[0], items.get(id) || []) });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const general = await resolveGeneral(req.body, req.user);
    const { items, grandTotal } = validateItems(req.body.items, general.priceLimit);

    const id = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO stock_ins
           (operator_id, category_id, sub_category_id, origin, recipient, unit,
            letter_number, attachment_path, attachment_name, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          general.operatorId,
          general.categoryId,
          general.subCategoryId,
          general.origin,
          general.recipient,
          general.unit,
          general.letterNumber,
          general.attachmentPath,
          general.attachmentName,
          grandTotal,
        ]
      );
      const stockInId = inserted.rows[0].id;
      await insertItems(client, stockInId, items);
      return stockInId;
    });

    const { rows } = await q(`${BASE_SELECT} WHERE si.id = $1`, [id]);
    const itemRows = await loadItems([id]);
    res
      .status(201)
      .json({ data: serializeStockIn(rows[0], itemRows.get(id) || []), message: 'Barang masuk berhasil disimpan' });
  })
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await q('SELECT id, operator_id FROM stock_ins WHERE id = $1', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'Data barang masuk tidak ditemukan');

    if (req.user.role === 'operator') {
      req.body.operator_id = req.user.id;
    }

    const general = await resolveGeneral(req.body, req.user);
    const { items, grandTotal } = validateItems(req.body.items, general.priceLimit);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE stock_ins
         SET operator_id = $1, category_id = $2, sub_category_id = $3, origin = $4,
             recipient = $5, unit = $6, letter_number = $7, attachment_path = $8,
             attachment_name = $9, total_price = $10, updated_at = NOW()
         WHERE id = $11`,
        [
          general.operatorId,
          general.categoryId,
          general.subCategoryId,
          general.origin,
          general.recipient,
          general.unit,
          general.letterNumber,
          general.attachmentPath,
          general.attachmentName,
          grandTotal,
          id,
        ]
      );
      await client.query('DELETE FROM stock_in_items WHERE stock_in_id = $1', [id]);
      await insertItems(client, id, items);
    });

    const { rows } = await q(`${BASE_SELECT} WHERE si.id = $1`, [id]);
    const itemRows = await loadItems([id]);
    res.json({
      data: serializeStockIn(rows[0], itemRows.get(id) || []),
      message: 'Barang masuk berhasil diperbarui',
    });
  })
);

router.patch(
  '/:id/verify',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (typeof req.body.is_verified !== 'boolean') {
      throw new HttpError(400, 'Status verifikasi wajib dikirim (true/false)');
    }

    const { rows } = await q(
      `UPDATE stock_ins SET is_verified = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, is_verified`,
      [req.body.is_verified, id]
    );
    if (!rows[0]) throw new HttpError(404, 'Data barang masuk tidak ditemukan');

    res.json({
      data: rows[0],
      message: rows[0].is_verified ? 'Data berhasil diverifikasi' : 'Verifikasi data dibatalkan',
    });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await q('DELETE FROM stock_ins WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new HttpError(404, 'Data barang masuk tidak ditemukan');
    res.json({ message: 'Barang masuk berhasil dihapus' });
  })
);

export default router;
