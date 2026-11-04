import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import Icon from '../components/icons.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { formatDate, number } from '../utils.js';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function StockIns() {
  const navigate = useNavigate();
  const location = useLocation();
  const flashTimer = useRef(null);

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [years, setYears] = useState([]);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(location.state?.flash || '');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [year, setYear] = useState('');
  const [sort, setSort] = useState({ sort: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} });
      flashTimer.current = setTimeout(() => setFlash(''), 4000);
    }
    return () => clearTimeout(flashTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api('/categories', { params: { all: 1 } })
      .then((data) => setCategories(data.data))
      .catch(() => {});
    api('/stock-ins/years')
      .then((data) => setYears(data.data))
      .catch(() => {});
  }, []);

  // Sub kategori selalu difilter ulang setiap kategori berubah.
  useEffect(() => {
    api('/sub-categories', { params: { all: 1, category_id: categoryId || undefined } })
      .then((data) => setSubCategories(data.data))
      .catch(() => {});
  }, [categoryId]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, subCategoryId, year, sort.sort, sort.dir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/stock-ins', {
        params: {
          page,
          limit: 10,
          search,
          category_id: categoryId,
          sub_category_id: subCategoryId,
          year,
          sort: sort.sort,
          dir: sort.dir,
        },
      });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, subCategoryId, year, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const changeCategory = (value) => {
    setCategoryId(value);
    setSubCategoryId('');
  };

  const toggleSort = (field) => {
    setSort((current) =>
      current.sort === field
        ? { sort: field, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { sort: field, dir: 'asc' }
    );
  };

  const sortIcon = (field) => (
    <Icon
      name="sort"
      size={11}
      className={sort.sort === field ? `sort-icon active ${sort.dir}` : 'sort-icon'}
    />
  );

  const toggleVerify = async (row) => {
    setBusyId(row.id);
    try {
      const data = await api(`/stock-ins/${row.id}/verify`, {
        method: 'PATCH',
        body: { is_verified: !row.is_verified },
      });
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, is_verified: data.data.is_verified } : item
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/stock-ins/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setFlash('Data barang masuk berhasil dihapus');
      setTimeout(() => setFlash(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
      setDeleting(null);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadFile(
        '/stock-ins/export',
        {
          search,
          category_id: categoryId,
          sub_category_id: subCategoryId,
          year,
          sort: sort.sort,
          dir: sort.dir,
        },
        `barang-masuk-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="mb-3">
        <h1 className="h4 fw-bold mb-1">Barang Masuk</h1>
        <p className="text-secondary small mb-0">
          Kelola data barang masuk beserta detail barang dan status verifikasinya.
        </p>
      </div>

      {flash && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2 small">
          <Icon name="check" size={15} />
          {flash}
        </div>
      )}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}

      <section className="card border-0 shadow-sm">
        <div className="card-body py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <Link to="/barang-masuk/tambah" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
            <Icon name="plus" size={14} />
            Tambah Data
          </Link>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select form-select-sm w-auto"
              value={categoryId}
              onChange={(event) => changeCategory(event.target.value)}
              aria-label="Filter kategori"
            >
              <option value="">Semua Kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className="form-select form-select-sm w-auto"
              value={subCategoryId}
              onChange={(event) => setSubCategoryId(event.target.value)}
              aria-label="Filter sub kategori"
            >
              <option value="">Semua Sub Kategori</option>
              {subCategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>

            <select
              className="form-select form-select-sm w-auto"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-label="Filter tahun"
            >
              <option value="">Semua Tahun</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="input-group input-group-sm" style={{ width: 210 }}>
              <span className="input-group-text bg-white">
                <Icon name="search" size={13} />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Cari data..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Cari asal barang atau sub kategori"
              />
            </div>

            <button
              type="button"
              className="btn btn-success btn-sm d-flex align-items-center gap-1"
              onClick={exportExcel}
              disabled={exporting}
              title="Export data sesuai filter ke Excel"
            >
              <Icon name="download" size={14} />
              {exporting ? 'Menyiapkan...' : 'Excel'}
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-stock">
            <thead>
              <tr>
                <th className="text-center" style={{ width: 48 }}>
                  NO
                </th>
                <th style={{ width: 118 }}>ACTION</th>
                <th>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none text-secondary"
                    onClick={() => toggleSort('date')}
                  >
                    TANGGAL {sortIcon('date')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none text-secondary"
                    onClick={() => toggleSort('origin')}
                  >
                    ASAL BARANG {sortIcon('origin')}
                  </button>
                </th>
                <th>PENERIMA</th>
                <th>UNIT</th>
                <th>KODE</th>
                <th>NAMA BARANG</th>
                <th className="text-end">HARGA (Rp.)</th>
                <th className="text-center">JUMLAH</th>
                <th className="text-end">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none text-secondary"
                    onClick={() => toggleSort('total')}
                  >
                    TOTAL (Rp.) {sortIcon('total')}
                  </button>
                </th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={12} className="text-center text-secondary py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Memuat data...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-secondary">
                    <Icon name="box" size={26} className="d-block mx-auto mb-2" />
                    <div className="fw-semibold text-dark">Belum ada data</div>
                    <small>Tambahkan data barang masuk atau ubah filter pencarian.</small>
                  </td>
                </tr>
              )}

              {/* Satu transaksi bisa berisi banyak item, jadi kolom umum digabung pakai rowSpan. */}
              {!loading &&
                rows.map((row, rowIndex) => {
                  const itemCount = Math.max(1, row.items.length);
                  return row.items.map((item, itemIndex) => (
                    <tr key={`${row.id}-${item.id}`}>
                      {itemIndex === 0 && (
                        <>
                          <td rowSpan={itemCount} className="text-center text-secondary">
                            {(meta?.page - 1) * meta?.limit + rowIndex + 1}
                          </td>
                          <td rowSpan={itemCount}>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-light btn-icon text-primary"
                                title="Ubah data"
                                onClick={() => navigate(`/barang-masuk/${row.id}/ubah`)}
                              >
                                <Icon name="pencil" size={13} />
                              </button>
                              {row.attachment_url && (
                                <a
                                  className="btn btn-sm btn-light btn-icon text-secondary"
                                  href={row.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Lampiran: ${row.attachment_name}`}
                                >
                                  <Icon name="file" size={13} />
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-light btn-icon text-secondary"
                                title="Cetak surat masuk"
                                onClick={() => window.open(`/print/${row.id}`, '_blank')}
                              >
                                <Icon name="printer" size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-light btn-icon text-danger"
                                title="Hapus data"
                                onClick={() => setDeleting(row)}
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            </div>
                          </td>
                          <td rowSpan={itemCount}>
                            <div className="fw-semibold">{formatDate(row.created_at)}</div>
                            <small className="cell-sub">
                              {row.letter_number || 'Tanpa nomor surat'}
                            </small>
                          </td>
                          <td rowSpan={itemCount}>
                            <div className="fw-semibold">{row.origin}</div>
                            <small className="cell-sub">Oleh {row.operator.name}</small>
                          </td>
                          <td rowSpan={itemCount}>{row.recipient || '-'}</td>
                          <td rowSpan={itemCount}>{row.unit || '-'}</td>
                        </>
                      )}
                      <td>{item.code || '-'}</td>
                      <td>{item.name}</td>
                      <td className="text-end">{number(item.price)}</td>
                      <td className="text-center text-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="text-end">{number(item.total)}</td>
                      {itemIndex === 0 && (
                        <td rowSpan={itemCount} className="text-center">
                          <button
                            type="button"
                            className={`switch ${row.is_verified ? 'on' : ''}`}
                            onClick={() => toggleVerify(row)}
                            disabled={busyId === row.id}
                            title={row.is_verified ? 'Sudah diverifikasi' : 'Belum diverifikasi'}
                            aria-label="Toggle verifikasi"
                          >
                            <span className="switch-knob">
                              {row.is_verified && <Icon name="check" size={9} />}
                            </span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ));
                })}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onChange={setPage} />
      </section>

      <Modal
        open={Boolean(deleting)}
        title="Hapus Data Barang Masuk"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleting(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              Hapus
            </button>
          </>
        }
      >
        <p className="mb-0">
          Yakin ingin menghapus data barang masuk dari <strong>{deleting?.origin}</strong>? Tindakan
          ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </>
  );
}
