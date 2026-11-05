import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, Flame, MapPin, Percent, Sparkles, Store, Timer, TrendingUp, X, Zap, Wand2, Users, Ticket } from 'lucide-react';
import { api } from '../lib/api';
import { useNow } from '../lib/hooks';
import { trackDealViewOnce } from '../lib/track';
import type { Deal } from '../lib/types';
import { DealCard } from '../shared/DealCard';
import { Skeleton, Tabs, cx } from '../shared/ui';
import { useSite } from './siteContext';
import { DealModal } from './DealModal';

const Hero3D = lazy(() => import('./Hero3D'));

const SORTS = [
  { value: 'hot', label: 'הכי חמים' },
  { value: 'ending', label: 'נגמרים בקרוב' },
  { value: 'discount', label: 'הנחה הכי גבוהה' },
  { value: 'new', label: 'חדשים' },
  { value: 'price', label: 'הכי זולים' },
];

function Hero() {
  const { boot, city, openCityPicker } = useSite();
  const site = boot?.settings.site;
  const live = city ? city.deals ?? 0 : boot?.stats.liveDeals ?? 0;
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(900px 420px at 15% 30%, rgba(163,213,32,.28), transparent 65%), radial-gradient(700px 380px at 100% 0%, rgba(30,92,46,.14), transparent 60%), linear-gradient(180deg,#fbfaf3,#f1f7e4)' }} />
      <div aria-hidden className="absolute -right-24 top-10 h-72 w-72 animate-blob bg-lime-300/25 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl lg:min-h-[470px] lg:grid-cols-2">
        <div className="relative z-10 order-2 px-5 pb-12 pt-2 lg:order-1 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-sm font-bold text-leaf-800 shadow-soft ring-1 ring-lime-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-500 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-500" />
            </span>
            {live} דילים פעילים עכשיו {city ? `ב${city.name}` : 'בכל הארץ'}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.6 }} className="mt-5 font-display text-[42px] leading-[1.02] text-leaf-900 sm:text-6xl lg:text-[68px]">
            {site?.heroTitle ?? 'הדילים הכי חמים בעיר'}
            {city && (
              <span className="mt-1 block bg-gradient-to-l from-lime-600 via-lime-500 to-leaf-600 bg-clip-text text-transparent">ב{city.name}</span>
            )}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.6 }} className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">
            {site?.heroSubtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.6 }} className="mt-7 flex flex-wrap gap-3">
            <a href="#deals" className="btn btn-lime btn-lg">
              <Flame size={20} /> לדילים של עכשיו
            </a>
            <button onClick={openCityPicker} className="btn btn-outline btn-lg">
              <MapPin size={20} /> {city ? 'החלפת עיר' : 'בחירת עיר'}
            </button>
          </motion.div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-ink-600">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft"><Timer size={17} className="text-wood-600" /></span>
              דילים לזמן קצר — עד 48 שעות
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft"><Store size={17} className="text-leaf-600" /></span>
              {boot?.stats.businesses ?? '—'} עסקים מפרסמים
            </span>
          </div>
        </div>
        <div className="relative order-1 h-64 sm:h-80 lg:order-2 lg:h-auto">
          <Suspense fallback={null}>
            <Hero3D className="absolute inset-0" />
          </Suspense>
        </div>
      </div>
      {/* wooden swoosh echoing the logo */}
      <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="relative block h-10 w-full sm:h-14">
        <defs>
          <linearGradient id="wood" x1="0" x2="1">
            <stop offset="0" stopColor="#512002" />
            <stop offset=".5" stopColor="#8c3f18" />
            <stop offset="1" stopColor="#a8592a" />
          </linearGradient>
        </defs>
        <path d="M0 70 C 360 20, 900 100, 1440 10 L1440 40 C 900 120, 360 60, 0 90 Z" fill="url(#wood)" opacity=".9" />
        <path d="M0 90 L0 80 C 360 40, 900 115, 1440 30 L1440 90 Z" fill="#fbfaf3" />
      </svg>
    </section>
  );
}

function EndingSoon({ deals, onOpen }: { deals: Deal[]; onOpen: (d: Deal) => void }) {
  if (deals.length < 2) return null;
  return (
    <section className="mx-auto mt-8 max-w-7xl px-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-red-600 text-white shadow-3d">
          <Timer size={18} />
        </span>
        <h2 className="text-xl font-black">נגמרים ממש עוד מעט</h2>
        <span className="text-sm text-ink-500">· תפסו לפני שנעלמים</span>
      </div>
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 pt-2">
        {deals.map((d) => (
          <div key={d.id} className="w-[290px] shrink-0 snap-start sm:w-[310px]">
            <DealCard deal={d} onOpen={() => onOpen(d)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BusinessBand() {
  const { boot } = useSite();
  const steps = [
    { icon: <Users size={20} />, title: 'נרשמים חינם', text: `${boot?.settings.trial.siteDays ?? 3} ימי ניסיון, בלי כרטיס אשראי ובלי ח.פ` },
    { icon: <Ticket size={20} />, title: 'מעלים דיל', text: 'מחיר, אחוז הנחה וכמה זמן הדיל באוויר — משעה ועד 48 שעות' },
    { icon: <Wand2 size={20} />, title: 'ה-AI מעצב', text: 'כרטיס מעוצב אוטומטית לפי סוג העסק שלכם' },
    { icon: <TrendingUp size={20} />, title: 'לקוחות מגיעים', text: 'חיוג ישיר וניווט ב-Waze בלחיצה אחת' },
  ];
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4">
      <div className="relative overflow-hidden rounded-[36px] bg-leaf-900 px-6 py-12 text-white shadow-deep sm:px-12">
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(600px 300px at 0% 0%, rgba(140,193,10,.35), transparent 70%), radial-gradient(500px 260px at 100% 100%, rgba(140,63,24,.55), transparent 70%)' }} />
        <div aria-hidden className="pat-dots absolute inset-0 text-white opacity-[0.06]" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="chip bg-lime-400 text-leaf-950">
              <Zap size={14} /> לבעלי עסקים
            </span>
            <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">יש לך עסק? תוך דקה הדיל שלך באוויר</h2>
            <p className="mt-3 max-w-lg text-lg text-ink-200">שקט בעסק? מלאי שצריך לזוז? מפרסמים דיל בזק, והלקוחות בעיר רואים אותו מיד.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {steps.map((s, i) => (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">{s.icon}</span>
                  <div>
                    <div className="font-bold">
                      {i + 1}. {s.title}
                    </div>
                    <div className="text-sm text-ink-300">{s.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-lime btn-lg">
                הרשמה חינם <Sparkles size={18} />
              </Link>
              <Link to="/pricing" className="btn btn-lg bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15">
                חבילות ומחירים
              </Link>
            </div>
          </div>
          {/* 3D stack of coupons */}
          <div className="perspective relative mx-auto hidden h-[360px] w-full max-w-[380px] lg:block">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="preserve-3d absolute inset-x-6 top-10 h-60 animate-floaty rounded-[30px] p-6 shadow-deep"
                style={{
                  transform: `rotateX(18deg) rotateY(-22deg) rotateZ(${-6 + i * 6}deg) translateZ(${i * 40}px) translateY(${i * -26}px) translateX(${i * -18}px)`,
                  background: ['linear-gradient(150deg,#8c3f18,#512002)', 'linear-gradient(150deg,#1e5c2e,#3f8f2a)', 'linear-gradient(150deg,#a3d520,#6f9e0b)'][i],
                  animationDelay: `${i * 0.6}s`,
                }}
              >
                {i === 2 && (
                  <div className="flex h-full flex-col justify-between text-leaf-950">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-black">דיל בזק</span>
                      <Percent size={34} strokeWidth={3} />
                    </div>
                    <div>
                      <div className="font-display text-4xl">40% הנחה</div>
                      <div className="mt-1 text-sm font-bold opacity-80">רק היום · עד 23:00</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { boot, city, category, q, sort, setSort, setCity, setCategory, setQ, openCityPicker } = useSite();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Deal | null>(null);
  const [tick, setTick] = useState(0);
  const now = useNow(30_000);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (city) params.set('city', city.slug);
    if (category) params.set('category', category.slug);
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    setError(null);
    api
      .get<{ deals: Deal[] }>(`/public/deals?${params}`, ctrl.signal)
      .then((r) => setDeals(r.deals))
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
  }, [city, category, q, sort, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const live = useMemo(() => (deals ?? []).filter((d) => new Date(d.expires_at).getTime() > now), [deals, now]);
  const endingSoon = useMemo(
    () => (sort === 'ending' ? [] : live.filter((d) => new Date(d.expires_at).getTime() - now < 3 * 3600_000).sort((a, b) => a.expires_at.localeCompare(b.expires_at)).slice(0, 10)),
    [live, now, sort],
  );
  const filtersActive = !!(city || category || q);

  return (
    <>
      <Hero />
      <EndingSoon deals={endingSoon} onOpen={setOpen} />

      <section id="deals" className="mx-auto mt-6 max-w-7xl scroll-mt-40 px-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-leaf-900 sm:text-4xl">
              {category ? category.name : 'כל הדילים'}
              {city && <span className="text-lime-600"> ב{city.name}</span>}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <span>{deals ? `${live.length} דילים פעילים` : 'טוען דילים…'}</span>
              {filtersActive && (
                <>
                  {city && (
                    <button onClick={() => setCity(null)} className="chip bg-white text-ink-700 shadow-soft ring-1 ring-ink-100 hover:ring-red-200">
                      <MapPin size={12} /> {city.name} <X size={12} />
                    </button>
                  )}
                  {category && (
                    <button onClick={() => setCategory(null)} className="chip bg-white text-ink-700 shadow-soft ring-1 ring-ink-100 hover:ring-red-200">
                      {category.name} <X size={12} />
                    </button>
                  )}
                  {q && (
                    <button onClick={() => setQ('')} className="chip bg-white text-ink-700 shadow-soft ring-1 ring-ink-100 hover:ring-red-200">
                      “{q}” <X size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <Tabs value={sort} onChange={setSort} tabs={SORTS} />
        </div>

        {error && <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}

        {!deals && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[470px] rounded-[28px]" />
            ))}
          </div>
        )}

        {deals && live.length === 0 && (
          <div className="card-3d mx-auto flex max-w-2xl flex-col items-center px-6 py-14 text-center">
            <img src="/icon-192.png" alt="" className="h-20 w-20 animate-floaty" />
            <h3 className="mt-4 text-2xl font-black">אין כרגע דילים {city ? `ב${city.name}` : ''}{category ? ` בקטגוריית ${category.name}` : ''}</h3>
            <p className="mt-2 text-ink-500">דילים חדשים עולים כל הזמן — כדאי לבדוק שוב בקרוב או להרחיב את החיפוש.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {filtersActive && (
                <button
                  onClick={() => {
                    setCategory(null);
                    setQ('');
                    setCity(null);
                  }}
                  className="btn btn-lime"
                >
                  לכל הדילים בארץ
                </button>
              )}
              <button onClick={openCityPicker} className="btn btn-outline">
                <MapPin size={17} /> עיר אחרת
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {live.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 30, rotateX: 12 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: (i % 4) * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
              onViewportEnter={() => trackDealViewOnce(d.id)}
              style={{ transformPerspective: 1000 }}
            >
              <DealCard deal={d} onOpen={() => setOpen(d)} />
            </motion.div>
          ))}
        </div>

        {deals && live.length > 0 && (
          <div className="mt-10 flex justify-center">
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={cx('btn btn-ghost text-ink-500')}>
              <ArrowDown size={16} className="rotate-180" /> חזרה למעלה
            </a>
          </div>
        )}
      </section>

      {boot && <BusinessBand />}
      <DealModal deal={open} onClose={() => setOpen(null)} />
    </>
  );
}
