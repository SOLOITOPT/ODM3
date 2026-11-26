import { useCallback, useEffect, useState } from 'react';
import { Activity, FolderKanban, Users, ClipboardList, Calendar, MapPin, Car } from 'lucide-react';
import { api, type MissionOrderWithRelations, type Project } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import { formatDateShort } from '@/lib/i18n';

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-teal-100 text-teal-700',
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

type StatCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
};

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, lang } = useLang();
  const [orders, setOrders] = useState<MissionOrderWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [orderData, projData, empData] = await Promise.all([
        api.missionOrders.list('start_date'),
        api.projects.list(),
        api.employees.list(),
      ]);

      setOrders(orderData);
      setProjects(projData);
      setEmployeeCount(empData.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toISOString().slice(0, 10);

  const activeOrders = orders.filter(
    (o) => o.status !== 'archived' && o.start_date <= today && o.end_date >= today
  );
  const upcomingOrders = orders
    .filter((o) => o.status !== 'archived' && o.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const ordersByProject = projects.map((project) => ({
    project,
    missions: activeOrders.filter((o) => o.project_id === project.id),
  }));

  const unassignedActive = activeOrders.filter((o) => !o.project_id);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5">
              <div className="h-11 w-11 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-1 h-4 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label={t('dashboard.activeMissions')}
          value={activeOrders.length}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={FolderKanban}
          label={t('dashboard.totalProjects')}
          value={projects.length}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={Users}
          label={t('dashboard.totalEmployees')}
          value={employeeCount}
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={ClipboardList}
          label={t('dashboard.upcomingMissions')}
          value={upcomingOrders.length}
          color="bg-cyan-100 text-cyan-700"
        />
      </div>

      {/* By Project - live tracking */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('dashboard.byProject')}</h2>
        {projects.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FolderKanban className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-3 text-sm text-slate-500 max-w-md">{t('dashboard.noProjects')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ordersByProject.map(({ project, missions }) => (
              <div key={project.id} className="card overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{project.name}</h3>
                    <span className="badge-issued">
                      {missions.length} {missions.length !== 1 ? t('common.days') : t('common.day')}
                    </span>
                  </div>
                  {project.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{project.description}</p>
                  )}
                </div>
                <div className="divide-y divide-slate-50">
                  {missions.length === 0 ? (
                    <div className="px-5 py-6 text-center text-sm text-slate-400">
                      {t('dashboard.noActiveMissions')}
                    </div>
                  ) : (
                    missions.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFor(
                            o.employee.first_name + o.employee.last_name
                          )}`}
                        >
                          {initials(o.employee.first_name, o.employee.last_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {o.employee.first_name} {o.employee.last_name}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {o.destination}
                            </span>
                            <span className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {o.vehicle.model}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {formatDateShort(o.end_date, lang)}
                          </div>
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {t('dashboard.liveNow')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unassigned active missions */}
      {unassignedActive.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('common.noProject')}</h2>
          <div className="card divide-y divide-slate-50">
            {unassignedActive.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFor(
                    o.employee.first_name + o.employee.last_name
                  )}`}
                >
                  {initials(o.employee.first_name, o.employee.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {o.employee.first_name} {o.employee.last_name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {o.destination}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDateShort(o.start_date, lang)} — {formatDateShort(o.end_date, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming missions */}
      {upcomingOrders.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {t('dashboard.upcomingMissions')}
          </h2>
          <div className="card divide-y divide-slate-50">
            {upcomingOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFor(
                    o.employee.first_name + o.employee.last_name
                  )}`}
                >
                  {initials(o.employee.first_name, o.employee.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {o.employee.first_name} {o.employee.last_name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {o.destination}
                    </span>
                    {o.project && (
                      <span className="text-slate-400">{o.project.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="h-3 w-3" />
                    {formatDateShort(o.start_date, lang)}
                  </div>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    {t('dashboard.scheduled')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
