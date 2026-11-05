import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Store } from 'lucide-react';
import type { Deal } from '../lib/types';
import { dateTime, durationLabel, money } from '../lib/format';
import { trackDealViewOnce } from '../lib/track';
import { DealCard } from '../shared/DealCard';
import { Modal } from '../shared/ui';

export function DealModal({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  useEffect(() => {
    if (deal) trackDealViewOnce(deal.id);
  }, [deal]);
  return (
    <Modal open={!!deal} onClose={onClose} size="lg" hideClose={false}>
      {deal && (
        <div className="grid gap-6 pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div className="mx-auto w-full max-w-[380px]">
            <DealCard deal={deal} large />
          </div>
          <div className="space-y-5">
            <div>
              <div className="text-sm font-semibold text-lime-700">{deal.category?.name}</div>
              <h2 className="mt-1 text-2xl font-black leading-tight">{deal.title}</h2>
              {deal.description && <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-600">{deal.description}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-ink-50 p-3">
                <div className="text-xs text-ink-500">מחיר מקורי</div>
                <div className="mt-1 font-bold text-ink-500 line-through">{money(deal.original_price)}</div>
              </div>
              <div className="rounded-2xl bg-lime-100 p-3">
                <div className="text-xs text-lime-800">הנחה</div>
                <div className="mt-1 text-lg font-black text-lime-800">{Math.round(deal.discount_percent)}%</div>
              </div>
              <div className="rounded-2xl bg-leaf-700 p-3 text-white shadow-3d">
                <div className="text-xs opacity-80">מחיר דיל</div>
                <div className="mt-1 text-lg font-black">{money(deal.final_price)}</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-ink-600">
              <li className="flex items-center gap-2">
                <Clock size={16} className="text-lime-600" /> בתוקף עד {dateTime(deal.expires_at)} ({durationLabel(deal.duration_hours)} סה״כ)
              </li>
              {deal.business.address && (
                <li className="flex items-center gap-2">
                  <MapPin size={16} className="text-lime-600" /> {deal.business.address}
                </li>
              )}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link to={`/b/${deal.business.slug}`} onClick={onClose} className="btn btn-outline">
                <Store size={17} /> כל הדילים של {deal.business.name}
              </Link>
              <Link to={`/deal/${deal.id}`} onClick={onClose} className="btn btn-ghost">
                לעמוד הדיל <ArrowLeft size={16} />
              </Link>
            </div>
            <p className="text-xs text-ink-400">הצגת המסך בעסק מספיקה למימוש. ההטבה בתוקף עד תום זמן הדיל או גמר המלאי.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
