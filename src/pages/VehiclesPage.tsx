import { useCallback, useEffect, useState } from 'react';
import { Car, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api, type Vehicle, type VehicleInput } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type VehicleModalProps = {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onSaved: () => void;
};

function VehicleFormModal({ open, onClose, vehicle, onSaved }: VehicleModalProps) {
  const { t } = useLang();
  const [form, setForm] = useState<VehicleInput>({ model: '', registration_plate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        vehicle
          ? { model: vehicle.model, registration_plate: vehicle.registration_plate }
          : { model: '', registration_plate: '' }
      );
      setError(null);
    }
  }, [open, vehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (vehicle) {
        await api.vehicles.update(vehicle.id, form);
      } else {
        await api.vehicles.create(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('vehicles.failSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={vehicle ? t('vehicles.edit') : t('vehicles.add')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('vehicles.model')}</label>
          <input
            className="input"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">{t('vehicles.plate')}</label>
          <input
            className="input"
            value={form.registration_plate}
            onChange={(e) => setForm({ ...form, registration_plate: e.target.value })}
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
            {saving ? t('common.saving') : vehicle ? t('common.save') : t('vehicles.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function VehiclesPage() {
  const { t } = useLang();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.vehicles.list();
      setVehicles(data);
    } catch (error) {
      console.error(t('vehicles.failLoad'), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    return v.model.toLowerCase().includes(q) || v.registration_plate.toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await api.vehicles.delete(toDelete.id);
      fetchVehicles();
    } catch {
      setDeleteError(t('vehicles.delete.fail'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('vehicles.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('vehicles.subtitle')}</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('vehicles.add')}
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={t('vehicles.searchPlaceholder')}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Car className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {search ? t('vehicles.empty.search') : t('vehicles.empty.default')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? t('vehicles.empty.searchDesc') : t('vehicles.empty.defaultDesc')}
          </p>
          {!search && (
            <button
              className="btn-primary mt-4"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('vehicles.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="card group p-5 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                    <Car className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{v.model}</h3>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {v.registration_plate}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditing(v);
                      setModalOpen(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(v)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <VehicleFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vehicle={editing}
        onSaved={fetchVehicles}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={t('vehicles.delete.title')}
        message={t('vehicles.delete.msg', {
          model: toDelete?.model ?? '',
          plate: toDelete?.registration_plate ?? '',
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
