import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, FolderKanban, FileText } from 'lucide-react';
import { api, type Project, type ProjectInput } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

type ProjectModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  onSaved: () => void;
};

function ProjectFormModal({ open, onClose, project, onSaved }: ProjectModalProps) {
  const { t } = useLang();
  const [form, setForm] = useState<ProjectInput>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        project
          ? { name: project.name, description: project.description ?? '' }
          : { name: '', description: '' }
      );
      setError(null);
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (project) {
        await api.projects.update(project.id, form);
      } else {
        await api.projects.create(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.failSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={project ? t('projects.edit') : t('projects.add')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('projects.name')}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">{t('projects.description')}</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('projects.descriptionPlaceholder')}
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
            {saving ? t('common.saving') : project ? t('common.save') : t('projects.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const projectColors = [
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
  return projectColors[Math.abs(hash) % projectColors.length];
}

export default function ProjectsPage() {
  const { t } = useLang();
  const [projects, setProjects] = useState<(Project & { mission_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toDelete, setToDelete] = useState<(Project & { mission_count: number }) | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (error) {
      console.error(t('projects.failLoad'), error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await api.projects.delete(toDelete.id);
      fetchProjects();
    } catch {
      setDeleteError(t('projects.delete.fail'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('projects.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('projects.subtitle')}</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('projects.add')}
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={t('projects.searchPlaceholder')}
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
            <div key={i} className="card p-6">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-4 h-5 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <FolderKanban className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            {search ? t('projects.empty.search') : t('projects.empty.default')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? t('projects.empty.searchDesc') : t('projects.empty.defaultDesc')}
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
              {t('projects.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="card group p-6 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorFor(p.name)}`}>
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setModalOpen(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{p.name}</h3>
              {p.description && (
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{p.description}</p>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                {t('projects.missionCount', { count: String(p.mission_count) })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        project={editing}
        onSaved={fetchProjects}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={t('projects.delete.title')}
        message={t('projects.delete.msg', { name: toDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
