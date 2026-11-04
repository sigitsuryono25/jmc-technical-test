import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { initials, roleLabel } from '../utils.js';
import Icon from './icons.jsx';

const BREADCRUMBS = [
  { match: /^\/barang-masuk\/tambah/, label: ['Barang Masuk', 'Tambah Data'] },
  { match: /^\/barang-masuk\/\d+\/ubah/, label: ['Barang Masuk', 'Ubah Data'] },
  { match: /^\/barang-masuk/, label: ['Barang Masuk'] },
  { match: /^\/master\/kategori/, label: ['Master Data', 'Kategori'] },
  { match: /^\/master\/sub-kategori/, label: ['Master Data', 'Sub Kategori'] },
  { match: /^\/user/, label: ['Manajemen User'] },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isMaster = location.pathname.startsWith('/master');
  const crumbs = BREADCRUMBS.find((item) => item.match.test(location.pathname))?.label || [
    'Barang Masuk',
  ];

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 42 24" width="32" height="19" aria-hidden="true">
              <path
                d="M2 16c3.2 0 4.6-9 7.8-9s4.6 9 7.8 9 4.6-9 7.8-9 4.6 9 7.8 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="brand-text">
            <strong>Aplikasi Pengelolaan Barang</strong>
            <small>PT. JMC Indonesia</small>
          </span>
        </div>

        <nav className="nav-sidebar">
          <NavLink
            to="/barang-masuk"
            className={({ isActive }) => `nav-item-side ${isActive ? 'active' : ''}`}
          >
            <Icon name="box" />
            <span>Barang Masuk</span>
          </NavLink>

          {isAdmin && (
            <div className={`nav-group ${isMaster ? 'open' : ''}`}>
              <button
                type="button"
                className={`nav-item-side ${isMaster ? 'in-section' : ''}`}
                onClick={() => setMasterOpen((value) => !value)}
              >
                <Icon name="folder" />
                <span>Master Data</span>
                <Icon name="chevronDown" size={12} className="nav-caret" />
              </button>
              {masterOpen && (
                <div className="subnav-side">
                  <NavLink
                    to="/master/kategori"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    Kategori
                  </NavLink>
                  <NavLink
                    to="/master/sub-kategori"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    Sub Kategori
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <NavLink
              to="/user"
              className={({ isActive }) => `nav-item-side ${isActive ? 'active' : ''}`}
            >
              <Icon name="users" />
              <span>Manajemen User</span>
            </NavLink>
          )}
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar d-flex align-items-center justify-content-between px-3 px-lg-4">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-light btn-sm d-lg-none"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Icon name="menu" size={18} />
            </button>
            <nav aria-label="breadcrumb" className="d-none d-sm-block">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item text-secondary">HOME</li>
                {crumbs.map((crumb, index) => (
                  <li
                    key={crumb}
                    className={`breadcrumb-item ${index === crumbs.length - 1 ? 'active' : ''}`}
                  >
                    {crumb}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="d-flex align-items-center gap-2 gap-md-3">
            <button
              type="button"
              className="btn btn-light btn-sm rounded-circle position-relative"
              aria-label="Notifikasi"
            >
              <Icon name="bell" size={16} />
              <span className="bell-dot" />
            </button>

            <div className="dropdown" ref={menuRef}>
              <button
                type="button"
                className="btn btn-light d-flex align-items-center gap-2"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span className="avatar">{initials(user?.name)}</span>
                <span className="d-none d-md-flex flex-column text-start lh-sm">
                  <span className="fw-semibold" style={{ fontSize: '0.8rem' }}>
                    {user?.name}
                  </span>
                  <small className="text-secondary" style={{ fontSize: '0.7rem' }}>
                    {roleLabel(user?.role)}
                  </small>
                </span>
                <Icon name="chevronDown" size={11} />
              </button>

              {menuOpen && (
                <div className="dropdown-menu dropdown-menu-end shadow show mt-2">
                  <div className="px-3 py-2 border-bottom">
                    <div className="fw-semibold">{user?.name}</div>
                    <div className="text-secondary small text-break">{user?.email}</div>
                    <span className="badge text-bg-info mt-1">{roleLabel(user?.role)}</span>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item text-danger d-flex align-items-center gap-2 mt-1"
                    onClick={handleLogout}
                  >
                    <Icon name="logout" size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content p-3 p-lg-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
