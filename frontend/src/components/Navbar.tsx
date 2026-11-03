import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const PUBLIC_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/doctors', label: 'Find a doctor' },
  { to: '/triage', label: 'AI symptom check' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const roleLinks = user
    ? user.role === 'patient'
      ? [{ to: '/dashboard', label: 'My appointments' }]
      : user.role === 'doctor'
        ? [{ to: '/doctor', label: 'Doctor panel' }]
        : [{ to: '/admin', label: 'Admin panel' }]
    : [];

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">＋</span>
          <span className="brand-name">
            MediBook <em>AI</em>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '✕' : '☰'}
        </button>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {[...PUBLIC_LINKS, ...roleLinks].map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <div className="nav-user">
              <span className="nav-user-name" title={user.email}>
                {user.name}
              </span>
              <button type="button" className="btn btn-sm btn-outline" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <div className="nav-auth">
              <NavLink to="/login" onClick={() => setOpen(false)} className="nav-link">
                Log in
              </NavLink>
              <NavLink to="/register" onClick={() => setOpen(false)} className="btn btn-sm">
                Sign up
              </NavLink>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
