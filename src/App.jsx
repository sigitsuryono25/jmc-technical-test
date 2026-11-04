import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import StockIns from './pages/StockIns.jsx';
import StockInForm from './pages/StockInForm.jsx';
import Categories from './pages/Categories.jsx';
import SubCategories from './pages/SubCategories.jsx';
import Users from './pages/Users.jsx';
import PrintLetter from './pages/PrintLetter.jsx';

function FullScreenLoader() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 gap-2 text-secondary">
      <span className="spinner-border spinner-border-sm" />
      <span>Memuat aplikasi...</span>
    </div>
  );
}

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/barang-masuk" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/print/:id"
        element={
          <Protected>
            <PrintLetter />
          </Protected>
        }
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/barang-masuk" replace />} />
        <Route path="/barang-masuk" element={<StockIns />} />
        <Route path="/barang-masuk/tambah" element={<StockInForm />} />
        <Route path="/barang-masuk/:id/ubah" element={<StockInForm />} />
        <Route
          path="/master/kategori"
          element={
            <Protected role="admin">
              <Categories />
            </Protected>
          }
        />
        <Route
          path="/master/sub-kategori"
          element={
            <Protected role="admin">
              <SubCategories />
            </Protected>
          }
        />
        <Route
          path="/user"
          element={
            <Protected role="admin">
              <Users />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/barang-masuk" replace />} />
      </Route>
    </Routes>
  );
}
