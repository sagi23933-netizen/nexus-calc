import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, Store } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { trackDealViewOnce } from '../lib/track';
import type { Deal } from '../lib/types';
import { DealCard } from '../shared/DealCard';
import { PageLoader } from '../shared/ui';
import { DealModal } from './DealModal';

export default function DealPage() {
  const { id } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [more, setMore] = useState<Deal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Deal | null>(null);

  useEffect(() => {
    setDeal(null);
    setError(null);
    api
      .get<{ deal: Deal }>(`/public/deals/${id}`)
      .then((r) => {
        setDeal(r.deal);
        trackDealViewOnce(r.deal.id);
        document.title = `${r.deal.title} — ${Math.round(r.deal.discount_percent)}% הנחה | בולדיל`;
        const qs = r.deal.city ? `?city=${r.deal.city.slug}&limit=8` : '?limit=8';
        api.get<{ deals: Deal[] }>(`/public/deals${qs}`).then((m) => setMore(m.deals.filter((d) => d.id !== r.deal.id).slice(0, 4)));
      })
      .catch((e) => setError(errMsg(e)));
    return () => {
      document.title = 'בולדיל — דילים בזק בעיר שלך';
    };
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <img src="/icon-192.png" alt="" className="mx-auto h-24 w-24 opacity-80" />
        <h1 className="mt-4 text-3xl font-black">הדיל הזה כבר נגמר ⏰</h1>
        <p className="mt-2 text-ink-500">דילים בבולדיל מתפרסמים לזמן קצר ונמחקים בסופו. יש הרבה דילים חדשים שמחכים לכם!</p>
        <Link to="/" className="btn btn-lime mt-6">
          לדילים הפעילים
        </Link>
      </div>
    );
  if (!deal) return <PageLoader />;

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[520px]" style={{ background: `radial-gradient(700px 360px at 50% 0%, ${deal.design?.palette?.bg2 ?? '#8cc10a'}55, transparent 70%)` }} />
      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <Link to="/" className="btn btn-ghost btn-sm mb-4">
          <ArrowRight size={16} /> לכל הדילים
        </Link>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="mx-auto w-full max-w-[420px]">
            <DealCard deal={deal} large />
          </div>
          <div className="space-y-6 pt-2">
            <div>
              <Link to={`/b/${deal.business.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-lime-700 hover:underline">
                <Store size={16} /> {deal.business.name}
              </Link>
              <h1 className="mt-2 font-display text-4xl leading-tight text-leaf-900">{deal.title}</h1>
              {deal.description && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink-600">{deal.description}</p>}
            </div>
            <div className="card-3d flex flex-wrap items-center gap-6 p-5">
              <div>
                <div className="text-sm text-ink-500">במקום</div>
                <div className="text-xl font-bold text-ink-400 line-through">{money(deal.original_price)}</div>
              </div>
              <div className="rounded-2xl bg-lime-500 px-4 py-2 font-display text-3xl text-leaf-950 shadow-3d">{Math.round(deal.discount_percent)}%</div>
              <div>
                <div className="text-sm text-ink-500">מחיר דיל</div>
                <div className="font-display text-4xl text-leaf-800">{money(deal.final_price)}</div>
              </div>
            </div>
            <ul className="space-y-2 text-ink-600">
              <li className="flex items-center gap-2">
                <Clock size={18} className="text-lime-600" /> בתוקף עד {dateTime(deal.expires_at)}
              </li>
              {deal.business.address && (
                <li className="flex items-center gap-2">
                  <MapPin size={18} className="text-lime-600" /> {deal.business.address}
                </li>
              )}
            </ul>
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-2xl font-black">עוד דילים {deal.city ? `ב${deal.city.name}` : ''}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {more.map((d) => (
                <DealCard key={d.id} deal={d} onOpen={() => setOpen(d)} />
              ))}
            </div>
          </section>
        )}
      </div>
      <DealModal deal={open} onClose={() => setOpen(null)} />
    </div>
  );
}
