import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/icons.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Categories() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/categories', { params: { page, limit: 10, search } });
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
    setForm({ code: '', name: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        await api(`/categories/${editing.id}`, { method: 'PUT', body: form });
        setFlash('Kategori berhasil diperbarui');
      } else {
        await api('/categories', { method: 'POST', body: form });
        setFlash('Kategori berhasil ditambahkan');
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
      await api(`/categories/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setFlash('Kategori berhasil dihapus');
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
        <h1 className="h4 fw-bold mb-1">Kategori</h1>
        <p className="text-secondary small mb-0">Kelola master data kategori barang.</p>
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
              placeholder="Cari kode atau nama kategori..."
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
                <th style={{ width: 130 }}>KODE</th>
                <th>NAMA KATEGORI</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-5 text-secondary">
                    <Icon name="folder" size={26} className="d-block mx-auto mb-2" />
                    <div className="fw-semibold text-dark">Belum ada kategori</div>
                    <small>Tambahkan kategori baru untuk mulai mengelola sub kategori.</small>
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
                    <td>
                      <span className="badge text-bg-secondary font-monospace">{row.code}</span>
                    </td>
                    <td>{row.name}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onChange={setPage} />
      </section>

      <Modal
        open={modalOpen}
        title="Form Kategori"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setModalOpen(false)}>
              Close
            </button>
            <button type="submit" form="category-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Submit'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={submit}>
          {formError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
              <Icon name="alert" size={15} /> {formError}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Kode Kategori <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={form.code}
              maxLength={10}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="Maksimal 10 karakter"
              required
              autoFocus
            />
          </div>
          <div className="mb-1">
            <label className="form-label small fw-semibold">
              Nama Kategori <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={form.name}
              maxLength={100}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Maksimal 100 karakter"
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="Hapus Kategori"
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
          Yakin ingin menghapus kategori <strong>{deleting?.name}</strong>?
        </p>
      </Modal>
    </>
  );
}
