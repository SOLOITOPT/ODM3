import { LayoutDashboard, ClipboardList, Users, Car, FolderKanban, FileText, Globe, Settings, LogOut } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import type { Page } from '@/lib/types';

type SidebarProps = {
  current: Page;
  onNavigate: (page: Page) => void;
};

export default function Sidebar({ current, onNavigate }: SidebarProps) {
  const { lang, setLang, t } = useLang();
  const { logout } = useAuth();

  const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'mission-orders', label: t('nav.missionOrders'), icon: ClipboardList },
    { id: 'employees', label: t('nav.employees'), icon: Users },
    { id: 'vehicles', label: t('nav.vehicles'), icon: Car },
    { id: 'projects', label: t('nav.projects'), icon: FolderKanban },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex no-print fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-slate-900">{t('app.title')}</span>
            <span className="text-xs text-slate-500">{t('app.subtitle')}</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}

          {/* Settings nav */}
          <button
            onClick={() => onNavigate('settings')}
            className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              current === 'settings'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings className={`h-5 w-5 ${current === 'settings' ? 'text-blue-600' : 'text-slate-400'}`} />
            {t('nav.settings')}
          </button>
        </nav>

        {/* Language toggle */}
        <div className="border-t border-slate-200 px-3 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1">
            <Globe className="ml-1.5 h-4 w-4 text-slate-400" />
            <button
              onClick={() => setLang('en')}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                lang === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('fr')}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                lang === 'fr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              FR
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-slate-200 px-3 py-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5 text-slate-400" />
            {t('settings.logout')}
          </button>
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-400">{t('app.footer')}</p>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-slate-900">{t('app.title')}</span>
        <div className="ml-auto flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'
                }`}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
          <button
            onClick={() => onNavigate('settings')}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              current === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label={t('nav.settings')}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            className="ml-1 flex h-9 items-center rounded-lg bg-slate-50 px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label={t('settings.logout')}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
