import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/icons.jsx';
import { digitsOnly, number, rupiah } from '../utils.js';

const emptyItem = () => ({
  code: '',
  name: '',
  price: '',
  quantity: '',
  unit: '',
  expired_date: '',
});

const emptyForm = {
  operator_id: '',
  category_id: '',
  sub_category_id: '',
  origin: '',
  recipient: '',
  unit: '',
  letter_number: '',
};

const ALLOWED_EXTENSIONS = ['doc', 'docx', 'zip'];

export default function StockInForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [form, setForm] = useState({ ...emptyForm, operator_id: isAdmin ? '' : String(user.id) });
  const [items, setItems] = useState([emptyItem()]);
  const [attachment, setAttachment] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/categories', { params: { all: 1 } })
      .then((data) => setCategories(data.data))
      .catch((err) => setError(err.message));

    if (isAdmin) {
      api('/users/options', { params: { role: 'operator' } })
        .then((data) => setOperators(data.data))
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!form.category_id) {
      setSubCategories([]);
      return;
    }
    api('/sub-categories', { params: { all: 1, category_id: form.category_id } })
      .then((data) => setSubCategories(data.data))
      .catch((err) => setError(err.message));
  }, [form.category_id]);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    api(`/stock-ins/${id}`)
      .then(({ data }) => {
        if (!active) return;
        setForm({
          operator_id: String(data.operator.id),
          category_id: String(data.category.id),
          sub_category_id: String(data.sub_category.id),
          origin: data.origin,
          recipient: data.recipient || '',
          unit: data.unit || '',
          letter_number: data.letter_number || '',
        });
        setItems(
          data.items.map((item) => ({
            code: item.code || '',
            name: item.name,
            price: String(item.price),
            quantity: String(item.quantity),
            unit: item.unit,
            expired_date: item.expired_date ? item.expired_date.slice(0, 10) : '',
          }))
        );
        if (data.attachment_path) {
          setAttachment({
            path: data.attachment_path,
            name: data.attachment_name,
            url: data.attachment_url,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const selectedSub = useMemo(
    () => subCategories.find((sub) => String(sub.id) === String(form.sub_category_id)),
    [subCategories, form.sub_category_id]
  );

  const priceLimit = selectedSub?.price_limit || 0;

  const grandTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
      ),
    [items]
  );

  const overLimit = priceLimit > 0 && grandTotal > priceLimit;

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const changeCategory = (value) => {
    setForm((current) => ({
      ...current,
      category_id: value,
      sub_category_id: '',
    }));
  };

  const changeItem = (index, key, value) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  const addRow = (index) => {
    setItems((current) => {
      const next = [...current];
      next.splice(index + 1, 0, emptyItem());
      return next;
    });
  };

  const removeRow = (index) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const uploadFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Lampiran harus berformat doc, docx, atau zip');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran lampiran maksimal 5 MB');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api('/uploads/attachment', { method: 'POST', formData });
      setAttachment(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.category_id) return setError('Kategori wajib dipilih');
    if (!form.sub_category_id) return setError('Sub kategori wajib dipilih');
    if (!form.origin.trim()) return setError('Asal barang wajib diisi');
    if (overLimit) return setError('Total harga melebihi batas harga sub kategori');

    setSaving(true);
    try {
      const body = {
        ...form,
        operator_id: isAdmin ? form.operator_id : user.id,
        attachment_path: attachment?.path || null,
        attachment_name: attachment?.name || null,
        items: items.map((item) => ({
          code: item.code || null,
          name: item.name,
          price: Number(item.price),
          quantity: Number(item.quantity),
          unit: item.unit,
          expired_date: item.expired_date || null,
        })),
      };

      if (isEdit) {
        await api(`/stock-ins/${id}`, { method: 'PUT', body });
      } else {
        await api('/stock-ins', { method: 'POST', body });
      }

      navigate('/barang-masuk', {
        state: {
          flash: isEdit
            ? 'Data barang masuk berhasil diperbarui'
            : 'Data barang masuk berhasil ditambahkan',
        },
      });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-secondary py-5">
        <span className="spinner-border spinner-border-sm" />
        Memuat data...
      </div>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h4 fw-bold mb-1">{isEdit ? 'Ubah Barang Masuk' : 'Tambah Barang Masuk'}</h1>
          <p className="text-secondary small mb-0">
            Lengkapi informasi umum dan detail barang yang masuk.
          </p>
        </div>
        <Link to="/barang-masuk" className="btn btn-light btn-sm d-flex align-items-center gap-1">
          <Icon name="arrowLeft" size={14} />
          Kembali
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <section className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white py-3">
            <h2 className="h6 fw-bold text-uppercase mb-0">Informasi Umum</h2>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">
                  Operator <span className="text-danger">*</span>
                </label>
                {isAdmin ? (
                  <select
                    className="form-select form-select-sm"
                    value={form.operator_id}
                    onChange={(event) => setField('operator_id', event.target.value)}
                    required
                  >
                    <option value="">Pilih Operator</option>
                    {operators.map((operator) => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={user.name} readOnly className="form-control form-control-sm bg-light" />
                )}
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">
                  Kategori <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  value={form.category_id}
                  onChange={(event) => changeCategory(event.target.value)}
                  required
                >
                  <option value="">Pilih Kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">
                  Sub Kategori <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  value={form.sub_category_id}
                  onChange={(event) => setField('sub_category_id', event.target.value)}
                  required
                  disabled={!form.category_id}
                >
                  <option value="">Pilih Sub Kategori</option>
                  {subCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">Batas Harga</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-light"
                  readOnly
                  value={selectedSub ? number(selectedSub.price_limit) : ''}
                  placeholder="Otomatis sesuai sub kategori"
                />
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">
                  Asal Barang <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.origin}
                  maxLength={200}
                  onChange={(event) => setField('origin', event.target.value)}
                  placeholder="Contoh: PT. Sinar Abadi"
                  required
                />
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">Penerima</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.recipient}
                  maxLength={100}
                  onChange={(event) => setField('recipient', event.target.value)}
                  placeholder="Nama penerima barang"
                />
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">Unit</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.unit}
                  maxLength={100}
                  onChange={(event) => setField('unit', event.target.value)}
                  placeholder="Contoh: Gudang Utama"
                />
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <label className="form-label small fw-semibold">Nomor Surat</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.letter_number}
                  maxLength={100}
                  onChange={(event) => setField('letter_number', event.target.value)}
                  placeholder="Contoh: 001/SI/2026"
                />
              </div>

              <div className="col-12">
                <label className="form-label small fw-semibold">Lampiran</label>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <label className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 mb-0">
                    <Icon name="file" size={14} />
                    {uploading ? 'Mengunggah...' : 'Choose File'}
                    <input
                      type="file"
                      className="d-none"
                      accept=".doc,.docx,.zip"
                      onChange={(event) => uploadFile(event.target.files?.[0])}
                      disabled={uploading}
                    />
                  </label>

                  {attachment ? (
                    <span className="badge text-bg-light border d-inline-flex align-items-center gap-1 py-2">
                      <Icon name="file" size={12} />
                      <a href={attachment.url} target="_blank" rel="noreferrer" className="text-decoration-none">
                        {attachment.name}
                      </a>
                      <button
                        type="button"
                        className="btn-close ms-1"
                        style={{ fontSize: '0.55rem' }}
                        onClick={() => setAttachment(null)}
                        aria-label="Hapus lampiran"
                      />
                    </span>
                  ) : (
                    <small className="text-secondary">
                      Tidak wajib &middot; doc / docx / zip &middot; maks 5 MB
                    </small>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h2 className="h6 fw-bold text-uppercase mb-0">Informasi Barang</h2>
            <small className="text-secondary">
              {selectedSub ? `Batas harga ${rupiah(priceLimit)}` : 'Pilih sub kategori dahulu'}
            </small>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0 table-items">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 48 }}>NO</th>
                  <th style={{ minWidth: 130 }}>KODE</th>
                  <th style={{ minWidth: 190 }}>NAMA BARANG</th>
                  <th style={{ minWidth: 130 }}>HARGA (Rp)</th>
                  <th style={{ minWidth: 90 }}>JUMLAH</th>
                  <th style={{ minWidth: 100 }}>SATUAN</th>
                  <th className="text-end" style={{ minWidth: 120 }}>TOTAL (Rp)</th>
                  <th style={{ minWidth: 150 }}>TGL EXPIRED</th>
                  <th style={{ width: 84 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const total = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                  return (
                    <tr key={index}>
                      <td className="text-center text-secondary">{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={item.code}
                          maxLength={30}
                          onChange={(event) => changeItem(index, 'code', event.target.value)}
                          placeholder="Contoh: ATK0001"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={item.name}
                          maxLength={200}
                          onChange={(event) => changeItem(index, 'name', event.target.value)}
                          placeholder="Nama barang"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm text-end"
                          inputMode="numeric"
                          value={item.price ? Number(item.price).toLocaleString('id-ID') : ''}
                          onChange={(event) =>
                            changeItem(index, 'price', digitsOnly(event.target.value))
                          }
                          placeholder="0"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm text-center"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => changeItem(index, 'quantity', event.target.value)}
                          placeholder="0"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={item.unit}
                          maxLength={40}
                          onChange={(event) => changeItem(index, 'unit', event.target.value)}
                          placeholder="Pcs"
                          required
                        />
                      </td>
                      <td className="text-end fw-semibold text-nowrap">{number(total)}</td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={item.expired_date}
                          onChange={(event) =>
                            changeItem(index, 'expired_date', event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary btn-icon"
                            onClick={() => addRow(index)}
                            title="Tambah baris"
                          >
                            <Icon name="plus" size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger btn-icon"
                            onClick={() => removeRow(index)}
                            disabled={items.length === 1}
                            title="Hapus baris"
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card-footer bg-white d-flex flex-wrap justify-content-end align-items-center gap-4 py-3">
            <div className="text-end">
              <small className="text-secondary d-block">Batas Harga</small>
              <span className="fw-semibold">{priceLimit ? rupiah(priceLimit) : '-'}</span>
            </div>
            <div className="text-end">
              <small className="text-secondary d-block">Total Harga</small>
              <span className={`fw-bold ${overLimit ? 'text-danger' : 'text-dark'}`}>
                {rupiah(grandTotal)}
              </span>
            </div>
          </div>

          {overLimit && (
            <div className="alert alert-danger d-flex align-items-center gap-2 rounded-0 rounded-bottom mb-0 py-2 small">
              <Icon name="alert" size={15} />
              Total harga {rupiah(grandTotal)} melebihi batas harga sub kategori{' '}
              {rupiah(priceLimit)}.
            </div>
          )}
        </section>

        <div className="d-flex justify-content-end gap-2">
          <Link to="/barang-masuk" className="btn btn-light btn-sm">
            Kembali
          </Link>
          <button
            type="submit"
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            disabled={saving || overLimit || uploading}
          >
            <Icon name="save" size={14} />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </>
  );
}
