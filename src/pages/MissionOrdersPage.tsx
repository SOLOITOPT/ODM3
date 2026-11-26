import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Eye, Trash2, ClipboardList, MapPin, Calendar } from 'lucide-react';
import {
  api,
  type Employee,
  type Vehicle,
  type Project,
  type MissionOrder,
  type MissionOrderWithRelations,
  type MissionOrderInput,
  type MissionOrderStatus,
  type AuthorizedBy,
} from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import { formatDateShort } from '@/lib/i18n';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import MissionOrderPreview from './MissionOrderPreview';

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  return days;
}

function statusBadgeClass(status: MissionOrderStatus) {
  if (status === 'issued') return 'badge-issued';
  if (status === 'draft') return 'badge-draft';
  return 'badge-archived';
}

function statusLabel(status: MissionOrderStatus, t: (k: string) => string) {
  if (status === 'issued') return t('common.issued');
  if (status === 'draft') return t('common.draft');
  return t('common.archived');
}

type FormModalProps = {
  open: boolean;
  onClose: () => void;
  order: MissionOrder | null;
  employees: Employee[];
  vehicles: Vehicle[];
  projects: Project[];
  onSaved: () => void;
};

function OrderFormModal({ open, onClose, order, employees, vehicles, projects, onSaved }: FormModalProps) {
  const { t } = useLang();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<MissionOrderInput>({
    employee_id: '',
    vehicle_id: '',
    project_id: null,
    destination: '',
    start_date: today,
    end_date: today,
    status: 'issued',
    authorized_by: null,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (order) {
        setForm({
          employee_id: order.employee_id,
          vehicle_id: order.vehicle_id,
          project_id: order.project_id,
          destination: order.destination,
          start_date: order.start_date,
          end_date: order.end_date,
          status: order.status,
          authorized_by: order.authorized_by,
          notes: order.notes ?? '',
        });
      } else {
        setForm({
          employee_id: employees[0]?.id ?? '',
          vehicle_id: vehicles[0]?.id ?? '',
          project_id: projects[0]?.id ?? null,
          destination: '',
          start_date: today,
          end_date: today,
          status: 'issued',
          authorized_by: 'operations',
          notes: '',
        });
      }
      setError(null);
    }
  }, [open, order, employees, vehicles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (form.end_date < form.start_date) {
      setError(t('orders.dateError'));
      setSaving(false);
      return;
    }

    try {
      const payload: MissionOrderInput = {
        employee_id: form.employee_id,
        vehicle_id: form.vehicle_id,
        project_id: form.project_id,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        authorized_by: form.authorized_by,
        notes: form.notes || null,
      };
      if (order) {
        await api.missionOrders.update(order.id, payload);
      } else {
        await api.missionOrders.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.failSave'));
    } finally {
      setSaving(false);
    }
  };

  const noEmployees = employees.length === 0;
  const noVehicles = vehicles.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? t('orders.editTitle') : t('orders.newTitle')}
      size="lg"
    >
      {(noEmployees || noVehicles) && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          {noEmployees && noVehicles
            ? t('orders.warning.both')
            : noEmployees
              ? t('orders.warning.employee')
              : t('orders.warning.vehicle')}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('orders.project')}</label>
            <select
              className="input"
              value={form.project_id ?? ''}
              onChange={(e) =>
                setForm({ ...form, project_id: e.target.value || null })
              }
            >
              <option value="">{t('orders.noProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('common.employee')}</label>
            <select
              className="input"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              required
              disabled={noEmployees}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.position}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('common.vehicle')}</label>
            <select
              className="input"
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              required
              disabled={noVehicles}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.model} ({v.registration_plate})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t('orders.missionDestination')}</label>
          <input
            className="input"
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('orders.startDate')}</label>
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">{t('orders.endDate')}</label>
            <input
              type="date"
              className="input"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('common.status')}</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as MissionOrderStatus })
              }
            >
              <option value="issued">{t('common.issued')}</option>
              <option value="draft">{t('common.draft')}</option>
              <option value="archived">{t('common.archived')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('orders.authorizedBy')}</label>
            <select
              className="input"
              value={form.authorized_by ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  authorized_by: (e.target.value || null) as AuthorizedBy,
                })
              }
            >
              <option value="">{t('orders.authorizedByPlaceholder')}</option>
              <option value="operations">{t('orders.authorizedBy.operations')}</option>
              <option value="administration">{t('orders.authorizedBy.administration')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t('orders.notes')}</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t('orders.notesPlaceholder')}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving || noEmployees || noVehicles}>
            {saving ? t('common.saving') : order ? t('common.save') : t('orders.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function MissionOrdersPage() {
  const { t, lang } = useLang();
  const [orders, setOrders] = useState<MissionOrderWithRelations[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MissionOrder | null>(null);
  const [toDelete, setToDelete] = useState<MissionOrderWithRelations | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<MissionOrderWithRelations | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.missionOrders.list('created_at');
      setOrders(data);
    } catch (error) {
      console.error(t('orders.failLoad'), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchOptions = useCallback(async () => {
    try {
      const [empData, vehData, projData] = await Promise.all([
        api.employees.list(),
        api.vehicles.list(),
        api.projects.list(),
      ]);
      setEmployees(empData);
      setVehicles(vehData);
      setProjects(projData);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchOptions();
  }, [fetchOrders, fetchOptions]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      o.order_number.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      `${o.employee.first_name} ${o.employee.last_name}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await api.missionOrders.delete(toDelete.id);
      fetchOrders();
    } catch {
      setDeleteError(t('orders.delete.fail'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('orders.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('orders.subtitle')}</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('orders.new')}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder={t('orders.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t('common.allStatuses')}</option>
          <option value="issued">{t('common.issued')}</option>
          <option value="draft">{t('common.draft')}</option>
          <option value="archived">{t('common.archived')}</option>
        </select>
      </div>

      {deleteError && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-4 text-xs font-medium underline">
            {t('common.close')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="card divide-y divide-slate-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <ClipboardList className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {search || statusFilter !== 'all' ? t('orders.empty.search') : t('orders.empty.default')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search || statusFilter !== 'all'
              ? t('orders.empty.searchDesc')
              : t('orders.empty.defaultDesc')}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              className="btn-primary mt-4"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('orders.new')}
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('orders.orderNum')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.employee')}
                </th>
                <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.project')}
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.destination')}
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.dates')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.status')}
                </th>
                <th className="w-20 px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o) => {
                const d = daysBetween(o.start_date, o.end_date);
                return (
                  <tr key={o.id} className="group cursor-pointer transition-colors hover:bg-slate-50" onClick={() => setPreviewOrder(o)}>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {o.order_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">
                        {o.employee.first_name} {o.employee.last_name}
                      </div>
                      <div className="text-xs text-slate-500">{o.employee.position}</div>
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4">
                      {o.project ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {o.project.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{t('common.none')}</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {o.destination}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatDateShort(o.start_date, lang)} — {formatDateShort(o.end_date, lang)}
                      </div>
                      <div className="ml-5 text-xs text-slate-400">
                        {d} {d !== 1 ? t('common.days') : t('common.day')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={statusBadgeClass(o.status)}>
                        {statusLabel(o.status, t)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setPreviewOrder(o)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          aria-label={t('common.preview')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(o)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OrderFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        order={editing}
        employees={employees}
        vehicles={vehicles}
        projects={projects}
        onSaved={fetchOrders}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={t('orders.delete.title')}
        message={t('orders.delete.msg', { num: toDelete?.order_number ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
      {previewOrder && (
        <MissionOrderPreview
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
          onEdit={() => {
            setEditing(orders.find((o) => o.id === previewOrder.id) ?? null);
            setPreviewOrder(null);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
