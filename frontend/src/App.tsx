import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { RequireAuth, RoleGuard } from './components/Guards';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { DoctorDetail } from './pages/DoctorDetail';
import { Doctors } from './pages/Doctors';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { PatientDashboard } from './pages/PatientDashboard';
import { Register } from './pages/Register';
import { Triage } from './pages/Triage';

function NotFound() {
  return (
    <div className="container page narrow">
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="muted">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/" className="btn">
          Go home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/doctors/:id" element={<DoctorDetail />} />
            <Route path="/triage" element={<Triage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <RoleGuard roles={['patient']}>
                    <PatientDashboard />
                  </RoleGuard>
                </RequireAuth>
              }
            />
            <Route
              path="/doctor"
              element={
                <RequireAuth>
                  <RoleGuard roles={['doctor']}>
                    <DoctorDashboard />
                  </RoleGuard>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RoleGuard roles={['admin']}>
                    <AdminDashboard />
                  </RoleGuard>
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
