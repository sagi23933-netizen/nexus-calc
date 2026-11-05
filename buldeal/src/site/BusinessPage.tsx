import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Instagram, MapPin, Navigation, Phone } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { telHref } from '../lib/format';
import { trackDealViewOnce } from '../lib/track';
import type { Deal } from '../lib/types';
import { DealCard } from '../shared/DealCard';
import { Avatar, Empty, PageLoader } from '../shared/ui';
import { DealModal } from './DealModal';

interface PublicBusiness {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  description: string;
  phone: string;
  address: string;
  waze_url: string;
  lat: number | null;
  lng: number | null;
  website: string;
  instagram: string;
  category_name: string | null;
  city_name: string | null;
}

export default function BusinessPage() {
  const { slug } = useParams();
  const [data, setData] = useState<{ business: PublicBusiness; deals: Deal[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Deal | null>(null);

  useEffect(() => {
    api
      .get<{ business: PublicBusiness; deals: Deal[] }>(`/public/businesses/${encodeURIComponent(slug || '')}`)
      .then((r) => {
        setData(r);
        r.deals.forEach((d) => trackDealViewOnce(d.id));
      })
      .catch((e) => setError(errMsg(e)));
  }, [slug]);

  if (error)
    return (
      <div className="py-20">
        <Empty title="העסק לא נמצא" text={error} action={<Link to="/" className="btn btn-lime">לדף הבית</Link>} />
      </div>
    );
  if (!data) return <PageLoader />;
  const b = data.business;
  const waze = b.waze_url || (b.lat && b.lng ? `https://waze.com/ul?ll=${b.lat},${b.lng}&navigate=yes` : b.address ? `https://waze.com/ul?q=${encodeURIComponent(b.address)}&navigate=yes` : '');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="card-3d relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(500px 220px at 100% 0%, rgba(163,213,32,.25), transparent 70%)' }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="rounded-full bg-white p-1.5 shadow-lift ring-4 ring-lime-100">
            <Avatar src={b.logo_url} name={b.name} size={104} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-lime-700">
              {b.category_name} {b.city_name && `· ${b.city_name}`}
            </div>
            <h1 className="font-display text-4xl text-leaf-900">{b.name}</h1>
            {b.description && <p className="mt-2 max-w-2xl text-ink-600">{b.description}</p>}
            {b.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
                <MapPin size={15} /> {b.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {b.phone && (
              <a href={telHref(b.phone)} className="btn btn-lime">
                <Phone size={17} /> {b.phone}
              </a>
            )}
            {waze && (
              <a href={waze} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Navigation size={17} /> ניווט ב-Waze
              </a>
            )}
            {b.website && (
              <a href={b.website} target="_blank" rel="noopener noreferrer" className="btn-icon bg-white shadow-soft" aria-label="אתר">
                <Globe size={18} />
              </a>
            )}
            {b.instagram && (
              <a href={b.instagram.startsWith('http') ? b.instagram : `https://instagram.com/${b.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="btn-icon bg-white shadow-soft" aria-label="אינסטגרם">
                <Instagram size={18} />
              </a>
            )}
          </div>
        </div>
      </div>

      <h2 className="mb-5 mt-10 text-2xl font-black">הדילים הפעילים של {b.name}</h2>
      {data.deals.length === 0 ? (
        <div className="card">
          <Empty title="אין כרגע דילים פעילים" text="העסק מפרסם דילים מדי פעם — שווה לחזור לבדוק." action={<Link to="/" className="btn btn-lime">לדילים אחרים</Link>} />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.deals.map((d) => (
            <DealCard key={d.id} deal={d} onOpen={() => setOpen(d)} />
          ))}
        </div>
      )}
      <DealModal deal={open} onClose={() => setOpen(null)} />
    </div>
  );
}
