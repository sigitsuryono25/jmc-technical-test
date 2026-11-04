import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/icons.jsx';
import { formatDateOnly, number, rupiah } from '../utils.js';

export default function PrintLetter() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/stock-ins/${id}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="print-page d-flex flex-column align-items-center justify-content-center gap-3">
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
          <Icon name="alert" size={15} /> {error}
        </div>
        <Link to="/barang-masuk" className="btn btn-light btn-sm">
          Kembali ke Barang Masuk
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="print-page d-flex align-items-center justify-content-center gap-2 text-secondary">
        <span className="spinner-border spinner-border-sm" />
        Menyiapkan surat...
      </div>
    );
  }

  const total = data.items.reduce((sum, item) => sum + Number(item.total), 0);

  return (
    <div className="print-page">
      <div className="print-toolbar d-flex justify-content-between">
        <Link to="/barang-masuk" className="btn btn-light btn-sm d-flex align-items-center gap-1">
          <Icon name="arrowLeft" size={14} /> Kembali
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => window.print()}
        >
          <Icon name="printer" size={14} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="letter">
        <div className="letter-head">
          <div className="letter-brand">
            <span className="letter-logo">
              <svg viewBox="0 0 42 24" width="42" height="24" aria-hidden="true">
                <path
                  d="M2 16c3.2 0 4.6-9 7.8-9s4.6 9 7.8 9 4.6-9 7.8-9 4.6 9 7.8 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <strong>PT. JMC INDONESIA</strong>
              <span>Jl. Raya Industri No. 88, Jakarta Selatan 12345</span>
              <span>Telp. (021) 555-0123 &middot; admin@jmc.co.id</span>
            </div>
          </div>
          <div className="letter-title">
            <h1>SURAT BARANG MASUK</h1>
            <span>No. {data.letter_number || `BM-${String(data.id).padStart(4, '0')}`}</span>
          </div>
        </div>

        <div className="letter-divider" />

        <div className="letter-meta">
          <div>
            <span>Tanggal</span>
            <strong>{formatDateOnly(data.created_at)}</strong>
          </div>
          <div>
            <span>Operator</span>
            <strong>{data.operator.name}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className={data.is_verified ? 'text-success' : ''}>
              {data.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi'}
            </strong>
          </div>
        </div>

        <p className="letter-body">
          Dengan ini menerangkan bahwa telah diterima barang masuk dengan rincian sebagai berikut:
        </p>

        <div className="letter-info">
          <div>
            <span>Asal Barang</span>
            <strong>{data.origin}</strong>
          </div>
          <div>
            <span>Penerima</span>
            <strong>{data.recipient || '-'}</strong>
          </div>
          <div>
            <span>Unit</span>
            <strong>{data.unit || '-'}</strong>
          </div>
          <div>
            <span>Kategori</span>
            <strong>
              {data.category.name} / {data.sub_category.name}
            </strong>
          </div>
          <div>
            <span>Nomor Surat</span>
            <strong>{data.letter_number || '-'}</strong>
          </div>
          <div>
            <span>Lampiran</span>
            <strong>{data.attachment_name || '-'}</strong>
          </div>
        </div>

        <table className="letter-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: 44 }}>NO</th>
              <th style={{ width: 90 }}>KODE</th>
              <th>NAMA BARANG</th>
              <th className="text-end">HARGA (Rp)</th>
              <th className="text-center">JUMLAH</th>
              <th>SATUAN</th>
              <th className="text-end">TOTAL (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.code || '-'}</td>
                <td>
                  {item.name}
                  {item.expired_date ? (
                    <small className="print-expired">
                      Exp: {formatDateOnly(item.expired_date)}
                    </small>
                  ) : null}
                </td>
                <td className="text-end">{number(item.price)}</td>
                <td className="text-center">{item.quantity}</td>
                <td>{item.unit}</td>
                <td className="text-end">{number(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="text-end">
                TOTAL KESELURUHAN
              </td>
              <td className="text-end">{rupiah(total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="letter-signatures">
          <div>
            <span>Diserahkan oleh,</span>
            <div className="signature-space" />
            <strong>{data.operator.name}</strong>
            <small>Operator</small>
          </div>
          <div>
            <span>Diverifikasi oleh,</span>
            <div className="signature-space" />
            <strong>{data.is_verified ? 'Administrator' : '........................'}</strong>
            <small>Admin</small>
          </div>
        </div>

        <div className="letter-foot">
          Dokumen ini digenerate otomatis oleh Aplikasi Pengelolaan Barang PT. JMC Indonesia.
        </div>
      </div>
    </div>
  );
}
