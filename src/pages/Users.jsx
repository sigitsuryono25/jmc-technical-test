import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/icons.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { formatDate, roleLabel } from '../utils.js';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const emptyForm = {
  role: 'operator',
  username: '',
  password: '',
  name: '',
  email: '',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/users', {
        params: { page, limit: 10, search, role: roleFilter },
      });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      role: row.role,
      username: row.username,
      password: '',
      name: row.name,
      email: row.email,
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;
      if (editing) {
        await api(`/users/${editing.id}`, { method: 'PUT', body });
        setFlash('User berhasil diperbarui');
      } else {
        await api('/users', { method: 'POST', body });
        setFlash('User berhasil ditambahkan');
      }
      setModalOpen(false);
      load();
      setTimeout(() => setFlash(''), 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async (row) => {
    setBusyId(row.id);
    setError('');
    try {
      const data = await api(`/users/${row.id}/lock`, {
        method: 'PATCH',
        body: { is_locked: !row.is_locked },
      });
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, is_locked: data.data.is_locked } : item
        )
      );
      setFlash(data.message);
      setTimeout(() => setFlash(''), 3500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-3">
        <h1 className="h4 fw-bold mb-1">Manajemen User</h1>
        <p className="text-secondary small mb-0">
          Kelola akun admin dan operator yang dapat mengakses aplikasi.
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

          <div className="d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select form-select-sm w-auto"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter role"
            >
              <option value="">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
            </select>

            <div className="input-group input-group-sm" style={{ width: 240 }}>
              <span className="input-group-text bg-white">
                <Icon name="search" size={13} />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Cari username atau nama..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th className="text-center" style={{ width: 56 }}>NO</th>
                <th style={{ width: 84 }}>ACTION</th>
                <th>USERNAME</th>
                <th>NAMA</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th className="text-center">LOCK</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-secondary">
                    <Icon name="users" size={26} className="d-block mx-auto mb-2" />
                    <div className="fw-semibold text-dark">Belum ada user</div>
                    <small>Tambahkan user baru untuk mengelola aplikasi.</small>
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
                      <button
                        type="button"
                        className="btn btn-sm btn-light btn-icon text-primary"
                        title="Ubah"
                        onClick={() => openEdit(row)}
                      >
                        <Icon name="pencil" size={13} />
                      </button>
                    </td>
                    <td>
                      <div className="fw-semibold">{row.username}</div>
                      <small className="cell-sub">Dibuat {formatDate(row.created_at, false)}</small>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>
                      <span className={`badge ${row.role === 'admin' ? 'text-bg-danger' : 'text-bg-primary'}`}>
                        {roleLabel(row.role)}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className={`switch ${row.is_locked ? 'locked' : 'on'}`}
                        onClick={() => toggleLock(row)}
                        disabled={busyId === row.id || row.id === currentUser.id}
                        title={
                          row.id === currentUser.id
                            ? 'Tidak dapat mengunci akun sendiri'
                            : row.is_locked
                              ? 'Buka lock user'
                              : 'Kunci user'
                        }
                        aria-label={row.is_locked ? 'Unlock user' : 'Lock user'}
                      >
                        <span className="switch-knob">
                          <Icon name={row.is_locked ? 'lock' : 'unlock'} size={10} />
                        </span>
                      </button>
                      <div className="cell-sub">{row.is_locked ? 'Terkunci' : 'Aktif'}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onChange={setPage} />
      </section>

      <Modal
        open={modalOpen}
        title="Form User"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setModalOpen(false)}>
              Close
            </button>
            <button type="submit" form="user-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Submit'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit}>
          {formError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
              <Icon name="alert" size={15} /> {formError}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Role <span className="text-danger">*</span>
            </label>
            <select
              className="form-select form-select-sm"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              required
            >
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Username <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={form.username}
              maxLength={100}
              minLength={8}
              onChange={(event) =>
                setForm((current) => ({ ...current, username: event.target.value }))
              }
              placeholder="8 - 100 karakter"
              required
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Password {editing ? '' : <span className="text-danger">*</span>}
            </label>
            <input
              type="password"
              className="form-control form-control-sm"
              value={form.password}
              maxLength={100}
              minLength={8}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder={editing ? 'Kosongkan jika tidak diubah' : '8 - 100 karakter'}
              required={!editing}
            />
            <div className="form-text">Kombinasi huruf besar, huruf kecil, dan angka.</div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Nama <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={form.name}
              maxLength={100}
              minLength={8}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="8 - 100 karakter"
              required
            />
          </div>

          <div className="mb-1">
            <label className="form-label small fw-semibold">
              Email <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              className="form-control form-control-sm"
              value={form.email}
              maxLength={100}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="nama@perusahaan.com"
              required
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
