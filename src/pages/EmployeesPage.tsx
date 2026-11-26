import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { api, type Employee, type EmployeeInput } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type EmployeeModalProps = {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSaved: () => void;
};

function EmployeeFormModal({ open, onClose, employee, onSaved }: EmployeeModalProps) {
  const { t } = useLang();
  const [form, setForm] = useState<EmployeeInput>({ first_name: '', last_name: '', position: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        employee
          ? {
              first_name: employee.first_name,
              last_name: employee.last_name,
              position: employee.position,
            }
          : { first_name: '', last_name: '', position: '' }
      );
      setError(null);
    }
  }, [open, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (employee) {
        await api.employees.update(employee.id, form);
      } else {
        await api.employees.create(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('employees.failSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={employee ? t('employees.edit') : t('employees.add')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('employees.firstName')}</label>
          <input
            className="input"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">{t('employees.lastName')}</label>
          <input
            className="input"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">{t('employees.position')}</label>
          <input
            className="input"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            required
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('common.saving') : employee ? t('common.save') : t('employees.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function initials(emp: Employee) {
  return `${emp.first_name[0] ?? ''}${emp.last_name[0] ?? ''}`.toUpperCase();
}

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function EmployeesPage() {
  const { t } = useLang();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [toDelete, setToDelete] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.employees.list();
      setEmployees(data);
    } catch (error) {
      console.error(t('employees.failLoad'), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await api.employees.delete(toDelete.id);
      fetchEmployees();
    } catch {
      setDeleteError(t('employees.delete.fail'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('employees.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('employees.subtitle')}</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4" />
          {t('employees.add')}
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={t('employees.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {search ? t('employees.empty.search') : t('employees.empty.default')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? t('employees.empty.searchDesc') : t('employees.empty.defaultDesc')}
          </p>
          {!search && (
            <button
              className="btn-primary mt-4"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {t('employees.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.employee')}
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('employees.position')}
                </th>
                <th className="w-24 px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="group transition-colors hover:bg-slate-50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFor(
                          emp.first_name + emp.last_name
                        )}`}
                      >
                        {initials(emp)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="text-xs text-slate-500 sm:hidden">{emp.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-3.5">
                    <span className="text-sm text-slate-700">{emp.position}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditing(emp);
                          setModalOpen(true);
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setToDelete(emp)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmployeeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        employee={editing}
        onSaved={fetchEmployees}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={t('employees.delete.title')}
        message={t('employees.delete.msg', {
          name: toDelete ? `${toDelete.first_name} ${toDelete.last_name}` : '',
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
