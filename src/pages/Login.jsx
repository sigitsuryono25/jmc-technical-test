import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/icons.jsx';

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={location.state?.from || '/barang-masuk'} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || '/barang-masuk', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="row g-0 min-vh-100">
      <div className="col-12 col-lg-5 col-xl-4 bg-white d-flex flex-column p-4 p-lg-5">
        <div className="login-brand d-flex align-items-start gap-2">
          <span className="brand-mark">
            <svg viewBox="0 0 42 24" width="36" height="21" aria-hidden="true">
              <path
                d="M2 16c3.2 0 4.6-9 7.8-9s4.6 9 7.8 9 4.6-9 7.8-9 4.6 9 7.8 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="lh-sm">
            <strong className="d-block">Aplikasi Pengelolaan Barang</strong>
            <small className="text-secondary">PT. JMC Indonesia</small>
          </span>
        </div>

        <div className="login-split flex-grow-1 d-flex flex-column justify-content-center py-4">
          <h1 className="h3 fw-bold mb-1">LOGIN</h1>
          <p className="text-secondary small mb-4">
            Selamat Datang, silahkan masukan username dan password anda!
          </p>

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small">
              <Icon name="alert" size={15} />
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold" htmlFor="username">
                Username
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white text-secondary">
                  <Icon name="user" size={14} />
                </span>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className="form-control"
                  autoComplete="username"
                  placeholder="Masukan username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold" htmlFor="password">
                Password
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white text-secondary">
                  <Icon name="lock" size={14} />
                </span>
                <input
                  id="password"
                  type="password"
                  name="password"
                  className="form-control"
                  autoComplete="current-password"
                  placeholder="Masukan password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={submitting}>
              {submitting ? 'MEMPROSES...' : 'MASUK'}
            </button>
          </form>

          <div className="alert alert-light border small mt-4 mb-0">
            <div className="fw-semibold text-uppercase text-secondary mb-1" style={{ fontSize: '0.68rem' }}>
              Akun demo
            </div>
            <div>admin: administrator / Admin12345</div>
            <div>operator: operator1 / Operator12345</div>
          </div>
        </div>

        <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
          &copy; {new Date().getFullYear()} PT. JMC Indonesia
        </div>
      </div>

      <div className="col-lg-7 col-xl-8 login-hero d-none d-lg-flex">
        <div className="login-hero-content">
          <span className="badge text-bg-info mb-3 text-uppercase">Inventory Management</span>
          <h2 className="fw-bold mb-2">
            Kelola barang masuk dengan cepat, rapi, dan terverifikasi.
          </h2>
          <p className="mb-0">
            Satu aplikasi untuk pencatatan barang masuk, master data kategori, dan manajemen user
            dalam satu alur kerja.
          </p>
        </div>
      </div>
    </div>
  );
}
