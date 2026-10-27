import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, UserCheck, GraduationCap, School } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Invalid email or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('ChangeMe123!');
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, 'ChangeMe123!');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please verify credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-primary-tint selection:text-primary">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-header-deep p-3 rounded-2xl shadow-md border border-primary/30 flex items-center justify-center">
            <img src="/RSCOELogo.png" alt="RSCOE Logo" className="h-14 w-auto object-contain" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-ink">
          ReSlot Portal
        </h2>
        <p className="mt-1 text-center text-xs text-muted font-medium">
          JSPM's Rajarshi Shahu College of Engineering, Pune
        </p>
        <p className="text-center text-xs text-primary font-semibold">
          Department of Computer Engineering
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow-sm sm:rounded-xl sm:px-8 border border-border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Institutional Email
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rscoe.edu.in"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Authenticating...' : 'Sign In to ReSlot'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Role Logins (Development Mode Only) */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-border">
              <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-3 text-center">
                Authorized Platform Access (Development Only)
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('coordinator@rscoe.edu.in')}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-border bg-canvas/60 hover:bg-canvas hover:border-primary/40 text-ink transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Timetable Coordinator</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono group-hover:text-primary">coordinator@rscoe.edu.in</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@rscoe.edu.in')}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-border bg-canvas/60 hover:bg-canvas hover:border-primary/40 text-ink transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>System Administrator</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono group-hover:text-primary">admin@rscoe.edu.in</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-muted">
          ReSlot Platform · Strict Zero-New-Clashes Guarantee · v2.1
        </div>
      </div>
    </div>
  );
};
