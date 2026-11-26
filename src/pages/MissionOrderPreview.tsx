import { useEffect } from 'react';
import { X, Printer, Pencil, MapPin, FileDown } from 'lucide-react';
import type { MissionOrderWithRelations, AuthorizedBy } from '@/lib/api';
import { useLang } from '@/lib/LanguageContext';
import { formatDateLocalized } from '@/lib/i18n';

type MissionOrderPreviewProps = {
  order: MissionOrderWithRelations;
  onClose: () => void;
  onEdit: () => void;
};

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function authorizedByLabel(value: AuthorizedBy, t: (k: string) => string): string {
  if (value === 'operations') return t('orders.authorizedBy.operations');
  if (value === 'administration') return t('orders.authorizedBy.administration');
  return '—';
}

export default function MissionOrderPreview({
  order,
  onClose,
  onEdit,
}: MissionOrderPreviewProps) {
  const { t, lang } = useLang();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const duration = daysBetween(order.start_date, order.end_date);
  const createdDate = new Date(order.created_at).toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
      {/* Toolbar - hidden on print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900">{order.order_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.edit')}</span>
          </button>
          <button className="btn-secondary" onClick={handleSavePdf}>
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.savePdf')}</span>
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            {t('common.print')}
          </button>
        </div>
      </div>

      {/* Printable document */}
      <div className="print-area mx-auto my-6 max-w-3xl px-4 sm:px-6">
        <div className="bg-white shadow-lg rounded-lg p-8 sm:p-12">
          {/* Company header */}
          <div className="border-b-2 border-slate-800 pb-6">
            <div className="flex items-center justify-between">
              <img
                src={`${import.meta.env.BASE_URL}LOGO_OPTISERVE_NEW.jpg`}
                alt="OPTISERVE"
                className="h-16 w-auto object-contain"
              />
              <div className="text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-sm font-bold text-slate-900">{t('preview.companyName')}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 sm:justify-end">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">{t('preview.companyAddress')}</span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h1 className="text-xl font-bold text-slate-900">{t('preview.missionOrder')}</h1>
              <p className="text-sm text-slate-500">{t('preview.travelAuth')}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="font-mono text-lg font-bold text-slate-900">
                {order.order_number}
              </div>
              <div className="text-sm text-slate-500">
                {t('preview.issued')}: {createdDate}
              </div>
            </div>
          </div>

          {/* Employee & Vehicle info */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('preview.employeeInfo')}
              </h2>
              <dl className="space-y-2.5">
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.fullName')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {order.employee.first_name} {order.employee.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.jobPosition')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {order.employee.position}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('preview.assignedVehicle')}
              </h2>
              <dl className="space-y-2.5">
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.vehicleModel')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {order.vehicle.model}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    {t('preview.registrationPlate')}
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                    {order.vehicle.registration_plate}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Mission details */}
          <div className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('preview.missionDetails')}
            </h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">{t('preview.destination')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {order.destination}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.duration')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {duration} {duration !== 1 ? t('common.days') : t('common.day')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.startDate')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatDateLocalized(order.start_date, lang)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('preview.endDate')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatDateLocalized(order.end_date, lang)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t('orders.authorizedBy')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {authorizedByLabel(order.authorized_by, t)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">{t('preview.project')}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                    {order.project ? order.project.name : t('common.none')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('preview.additionalNotes')}
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">{order.notes}</p>
            </div>
          )}

          {/* Authorization / signature section */}
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">
                {t('preview.concernedParty')}
              </div>
              <div className="border-b-2 border-dashed border-slate-300 pt-12" />
              <div className="mt-2 text-xs text-slate-400">
                {order.employee.first_name} {order.employee.last_name}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">
                {order.authorized_by
                  ? authorizedByLabel(order.authorized_by, t)
                  : t('preview.authSig')}
              </div>
              <div className="border-b-2 border-dashed border-slate-300 pt-12" />
              <div className="mt-2 text-xs text-slate-400">
                {t('preview.date')}: ____________
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-slate-200 pt-4 text-center">
            <p className="text-xs text-slate-400">{t('preview.footer')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
