import { useEffect, useState } from 'react';
import { FileText, Lock, User, Globe, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPage() {
  const { t, lang, setLang } = useLang();
  const { login } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.auth
      .status()
      .then((res) => {
        if (!active) return;
        setNeedsSetup(res.needsSetup);
      })
      .catch(() => {
        if (!active) return;
        setNeedsSetup(false);
      })
      .finally(() => {
        if (active) setCheckingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (username !== 'admin') {
      setError(t('login.error'));
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.login(username, password);
      login(res.token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t('login.error'));
      } else {
        setError(t('login.genericError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError(t('settings.passwordTooShort'));
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.setup(password);
      login(res.token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNeedsSetup(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(t('login.genericError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4">
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <Globe className="ml-1.5 h-4 w-4 text-slate-400" />
          <button
            onClick={() => setLang('en')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              lang === 'en' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('fr')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              lang === 'fr' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            FR
          </button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
            {needsSetup ? (
              <ShieldCheck className="h-8 w-8 text-white" />
            ) : (
              <FileText className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {needsSetup ? t('login.setupTitle') : t('login.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {needsSetup ? t('login.setupSubtitle') : t('login.subtitle')}
          </p>
        </div>

        {/* Login / Setup card */}
        <div className="card p-8 shadow-xl">
          {checkingStatus ? (
            <div className="space-y-4 py-4">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
            </div>
          ) : needsSetup ? (
            <form onSubmit={handleSetupSubmit} className="space-y-5">
              <div>
                <label className="label">{t('login.username')}</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10 bg-slate-50 text-slate-600" value="admin" disabled />
                </div>
              </div>

              <div>
                <label className="label">{t('settings.newPassword')}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('login.setupConfirmPassword')}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('login.settingUp') : t('login.setupButton')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="label">{t('login.username')}</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('login.password')}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          {needsSetup ? t('login.setupHint') : t('login.hint')}
        </p>
      </div>
    </div>
  );
}
