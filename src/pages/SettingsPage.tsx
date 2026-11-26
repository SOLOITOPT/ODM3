import { useState, useEffect, useCallback } from 'react';
import { Lock, User, Shield, LogOut, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsPage() {
  const { t, lang } = useLang();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordSetAt, setPasswordSetAt] = useState<string | null>(null);
  const [envOverride, setEnvOverride] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.settings.get();
      setPasswordSetAt(data.admin_password_set_at);
      setEnvOverride(data.envOverride);
    } catch {
      // Handled by auth context if 401
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError(t('settings.passwordTooShort'));
      setSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      setSaving(false);
      return;
    }

    try {
      const res = await api.settings.updatePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSetAt(res.admin_password_set_at);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') {
        setError(t('settings.wrongPassword'));
      } else if (err instanceof ApiError && err.code === 'ENV_MANAGED') {
        setError(t('settings.envManaged'));
      } else {
        setError(t('login.genericError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const formatSetAt = (dateStr: string | null) => {
    if (!dateStr) return t('settings.never');
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>
      </div>

      {/* Admin account info */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <Shield className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">{t('settings.adminUsername')}</h2>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">admin</div>
            <div className="text-xs text-slate-500">{t('settings.usernameFixed')}</div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Lock className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">
            {t('settings.changePassword')}
          </h2>
        </div>
        <p className="mb-5 text-xs text-slate-500">
          {t('settings.passwordSetAt')}: {formatSetAt(passwordSetAt)}
        </p>

        {envOverride && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            {t('settings.envManaged')}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {t('settings.passwordUpdated')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('settings.currentPassword')}</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={envOverride}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t('settings.newPassword')}</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={envOverride}
                required
              />
            </div>
            <div>
              <label className="label">{t('settings.confirmPassword')}</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={envOverride}
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary" disabled={saving || envOverride}>
              {saving ? t('common.saving') : t('settings.updatePassword')}
            </button>
          </div>
        </form>
      </div>

      {/* Logout */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogOut className="h-5 w-5 text-slate-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t('settings.logout')}</h2>
              <p className="text-xs text-slate-500">{t('settings.logoutConfirm')}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t('settings.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
