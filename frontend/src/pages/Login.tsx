import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, Input, Spinner } from '../components/ui';

export function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={from ?? '/'} replace />;
  }

  function homeFor(role: string): string {
    if (role === 'doctor') return '/doctor';
    if (role === 'admin') return '/admin';
    return '/dashboard';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      navigate(from ?? homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-wrap">
      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to manage your appointments.</p>
        {loading ? (
          <Spinner />
        ) : (
          <form onSubmit={onSubmit} className="form">
            {error && <ErrorBanner message={error} />}
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        )}
        <p className="muted small auth-switch">
          New here? <Link to="/register">Create a patient account</Link>
        </p>
      </div>
    </div>
  );
}
