import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/icons.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { digitsOnly, number, rupiah } from '../utils.js';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SubCategories() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category_id: '', name: '', price_limit: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    api('/categories', { params: { all: 1 } })
      .then((data) => setCategories(data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/sub-categories', { params: { page, limit: 10, search } });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ category_id: '', name: '', price_limit: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      category_id: String(row.category_id),
      name: row.name,
      price_limit: String(row.price_limit),
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const body = {
        category_id: Number(form.category_id),
        name: form.name,
        price_limit: Number(form.price_limit),
      };
      if (editing) {
        await api(`/sub-categories/${editing.id}`, { method: 'PUT', body });
        setFlash('Sub kategori berhasil diperbarui');
      } else {
        await api('/sub-categories', { method: 'POST', body });
        setFlash('Sub kategori berhasil ditambahkan');
      }
      setModalOpen(false);
      setPage(1);
      load();
      setTimeout(() => setFlash(''), 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/sub-categories/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setFlash('Sub kategori berhasil dihapus');
      load();
      setTimeout(() => setFlash(''), 4000);
    } catch (err) {
      setDeleting(null);
      setError(err.message);
    }
  };

  return (
    <>
      <div className="mb-3">
        <h1 className="h4 fw-bold mb-1">Sub Kategori</h1>
        <p className="text-secondary small mb-0">
          Kelola sub kategori beserta batas harga per transaksi.
        </p>
      </div>

      {flash && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2 small">
          <Icon name="check" size={15} /> {flash}
        </div>
      )}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <Icon name="alert" size={15} /> {error}
        </div>
      )}

      <section className="card border-0 shadow-sm">
        <div className="card-body py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={openCreate}
          >
            <Icon name="plus" size={14} /> Tambah Data
          </button>

          <div className="input-group input-group-sm" style={{ width: 260 }}>
            <span className="input-group-text bg-white">
              <Icon name="search" size={13} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Cari kategori atau sub kategori..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th className="text-center" style={{ width: 56 }}>NO</th>
                <th style={{ width: 104 }}>ACTION</th>
                <th>KATEGORI</th>
                <th>SUB KATEGORI</th>
                <th className="text-end">BATAS HARGA (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-secondary">
                    <Icon name="folder" size={26} className="d-block mx-auto mb-2" />
                    <div className="fw-semibold text-dark">Belum ada sub kategori</div>
                    <small>Tambahkan sub kategori dan tentukan batas harganya.</small>
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="text-center text-secondary">
                      {(meta.page - 1) * meta.limit + index + 1}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-light btn-icon text-primary"
                          title="Ubah"
                          onClick={() => openEdit(row)}
                        >
                          <Icon name="pencil" size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light btn-icon text-danger"
                          title="Hapus"
                          onClick={() => setDeleting(row)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                    <td>{row.category.name}</td>
                    <td>{row.name}</td>
                    <td className="text-end">{number(row.price_limit)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onChange={setPage} />
      </section>

      <Modal
        open={modalOpen}
        title="Form Sub Kategori"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setModalOpen(false)}>
              Close
            </button>
            <button
              type="submit"
              form="sub-category-form"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? 'Menyimpan...' : 'Submit'}
            </button>
          </>
        }
      >
        <form id="sub-category-form" onSubmit={submit}>
          {formError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
              <Icon name="alert" size={15} /> {formError}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Kategori <span className="text-danger">*</span>
            </label>
            <select
              className="form-select form-select-sm"
              value={form.category_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, category_id: event.target.value }))
              }
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
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Nama Sub Kategori <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={form.name}
              maxLength={100}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Maksimal 100 karakter"
              required
              autoFocus
            />
          </div>
          <div className="mb-1">
            <label className="form-label small fw-semibold">
              Batas Harga <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm text-end"
              inputMode="numeric"
              value={form.price_limit ? Number(form.price_limit).toLocaleString('id-ID') : ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, price_limit: digitsOnly(event.target.value) }))
              }
              placeholder="Contoh: 5.000.000"
              required
            />
            {form.price_limit ? (
              <div className="form-text">Nilai: {rupiah(form.price_limit)}</div>
            ) : null}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="Hapus Sub Kategori"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setDeleting(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              Hapus
            </button>
          </>
        }
      >
        <p className="mb-0">
          Yakin ingin menghapus sub kategori <strong>{deleting?.name}</strong>?
        </p>
      </Modal>
    </>
  );
}
