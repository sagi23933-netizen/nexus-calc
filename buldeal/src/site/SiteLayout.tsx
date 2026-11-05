import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, LogIn, MapPin, Megaphone, Search, Store, X, Mail, Phone, Send } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { track } from '../lib/track';
import type { Bootstrap } from '../lib/types';
import { DynIcon } from '../lib/icons';
import { BrandLogo } from '../shared/Brand';
import { Button, Field, Input, Modal, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { CityPicker } from './CityPicker';
import { SiteContext, type SiteCtx } from './siteContext';

const CITY_KEY = 'bd_city';

function readStoredCity() {
  try {
    return localStorage.getItem(CITY_KEY);
  } catch {
    return null;
  }
}

function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setLoading(true);
    setErr(null);
    try {
      await api.post('/public/contact', f);
      toast('ההודעה נשלחה! נחזור אליך בהקדם');
      setF({ name: '', email: '', phone: '', subject: '', message: '' });
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="צרו איתנו קשר" size="md">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="טלפון">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" dir="ltr" className="text-right" />
        </Field>
        <Field label="אימייל" className="sm:col-span-2">
          <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" dir="ltr" className="text-right" />
        </Field>
        <Field label="נושא" className="sm:col-span-2">
          <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="למשל: רוצה לפרסם את העסק שלי" />
        </Field>
        <Field label="הודעה" required className="sm:col-span-2">
          <Textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={4} />
        </Field>
      </div>
      {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-5 flex justify-end">
        <Button onClick={send} loading={loading} icon={<Send size={16} />}>
          שליחה
        </Button>
      </div>
    </Modal>
  );
}

function CategoryStrip({ boot, active, onPick }: { boot: Bootstrap | null; active: string | null; onPick: (slug: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * -320, behavior: 'smooth' });
  const cats = boot?.categories ?? [];
  return (
    <div className="relative">
      <button onClick={() => scroll(-1)} className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lift md:flex" aria-label="גלילה ימינה">
        <ChevronRight size={18} />
      </button>
      <div ref={ref} className="scrollbar-none flex gap-2 overflow-x-auto px-1 py-2.5 md:px-11">
        <CategoryChip label="הכל" icon={<LayoutGrid size={18} />} color="#1e5c2e" active={!active} count={boot?.stats.liveDeals} onClick={() => onPick(null)} />
        {cats.map((c) => (
          <CategoryChip key={c.id} label={c.name} icon={<DynIcon name={c.icon} size={18} />} color={c.color} active={active === c.slug} count={c.deals} onClick={() => onPick(c.slug)} />
        ))}
        {!boot && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-11 w-32 shrink-0 rounded-2xl" />)}
      </div>
      <button onClick={() => scroll(1)} className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lift md:flex" aria-label="גלילה שמאלה">
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}

function CategoryChip({ label, icon, color, active, count, onClick }: { label: string; icon: ReactNode; color: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'group flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-3.5 pr-1.5 text-[14px] font-semibold transition-all duration-200',
        active ? 'bg-leaf-700 text-white shadow-[0_10px_20px_-10px_rgba(20,70,30,.9)]' : 'bg-white text-ink-700 shadow-soft ring-1 ring-ink-100 hover:-translate-y-0.5 hover:shadow-lift',
      )}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl text-white transition-transform group-hover:-rotate-6 group-hover:scale-110"
        style={{ background: `linear-gradient(150deg, ${color}, ${color}cc)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.18)' }}
      >
        {icon}
      </span>
      {label}
      {count != null && count > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-white/20' : 'bg-lime-100 text-lime-800')}>{count}</span>}
    </button>
  );
}

export default function SiteLayout() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [qDraft, setQDraft] = useState(params.get('q') || '');
  const isHome = loc.pathname === '/';

  useEffect(() => {
    api.get<Bootstrap>('/public/bootstrap').then(setBoot).catch(() => {});
  }, []);

  // restore remembered city on the home page
  useEffect(() => {
    if (isHome && !params.get('city')) {
      const stored = readStoredCity();
      if (stored) {
        const next = new URLSearchParams(params);
        next.set('city', stored);
        setParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome]);

  useEffect(() => {
    track('pageview', { city: params.get('city') || undefined, category: params.get('cat') || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, params.get('city'), params.get('cat')]);

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(isHome ? params : undefined);
      if (value) next.set(key, value);
      else next.delete(key);
      if (isHome) setParams(next, { replace: key === 'q' });
      else navigate(`/?${next.toString()}`);
    },
    [isHome, params, setParams, navigate],
  );

  const city = useMemo(() => boot?.cities.find((c) => c.slug === params.get('city')) ?? null, [boot, params]);
  const category = useMemo(() => boot?.categories.find((c) => c.slug === params.get('cat')) ?? null, [boot, params]);

  const ctx: SiteCtx = {
    boot,
    city,
    category,
    q: params.get('q') || '',
    sort: params.get('sort') || 'hot',
    setCity: (slug) => {
      try {
        if (slug) localStorage.setItem(CITY_KEY, slug);
        else localStorage.removeItem(CITY_KEY);
      } catch {
        /* ignore */
      }
      if (slug) track('filter_city', { city: slug });
      update('city', slug);
    },
    setCategory: (slug) => {
      if (slug) track('filter_category', { category: slug });
      update('cat', slug);
    },
    setQ: (q) => update('q', q || null),
    setSort: (s) => update('sort', s === 'hot' ? null : s),
    openCityPicker: () => setCityOpen(true),
    openContact: () => setContactOpen(true),
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') || '') !== qDraft && (isHome || qDraft)) {
        if (qDraft) track('search');
        update('q', qDraft || null);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const site = boot?.settings.site;
  const businessLink = me.user?.role === 'business' ? { to: '/dashboard', label: 'לממשק העסק' } : me.user?.role === 'admin' ? { to: '/admin', label: 'לממשק הניהול' } : { to: '/register', label: 'פרסום דיל לעסקים' };

  return (
    <SiteContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col">
        {site?.announcementEnabled && site.announcementText && (
          <div className="relative z-50 bg-gradient-to-l from-wood-600 via-wood-500 to-wood-600 px-4 py-2 text-center text-sm font-semibold text-white">
            <Megaphone size={15} className="ml-1.5 inline" />
            {site.announcementText}
          </div>
        )}

        <header className="glass sticky top-0 z-40 border-b border-white/60 shadow-[0_10px_30px_-20px_rgba(20,60,20,.35)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4">
            <BrandLogo height={30} className="sm:!h-[46px]" />

            <div className="relative hidden flex-1 md:block">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="מה מחפשים היום? פיצה, ציפורניים, אוזניות…"
                className="h-12 w-full rounded-2xl border border-ink-100 bg-white/90 pr-11 pl-10 text-[15px] shadow-[inset_0_1px_3px_rgba(0,0,0,.05)] outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-500/15"
              />
              {qDraft && (
                <button onClick={() => setQDraft('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label="ניקוי חיפוש">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
              <button onClick={() => setSearchOpen((v) => !v)} className="btn-icon md:hidden" aria-label="חיפוש">
                <Search size={20} />
              </button>
              <button
                onClick={() => setCityOpen(true)}
                className="group flex h-11 min-w-0 items-center gap-2 rounded-2xl bg-white pl-3 pr-1.5 sm:pr-2 text-[14px] font-bold text-ink-800 shadow-soft ring-1 ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-lift sm:h-12"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">
                  <MapPin size={16} />
                </span>
                <span className="max-w-[64px] truncate sm:max-w-[140px]">{city?.name ?? 'כל הארץ'}</span>
                <ChevronDown size={16} className="hidden text-ink-400 transition group-hover:translate-y-0.5 sm:block" />
              </button>
              {!me.user && (
                <Link to="/login" className="btn btn-ghost hidden h-12 lg:inline-flex">
                  <LogIn size={18} /> כניסה
                </Link>
              )}
              <Link to={businessLink.to} className="btn btn-leaf hidden h-12 sm:inline-flex">
                <Store size={18} /> {businessLink.label}
              </Link>
              <Link to={businessLink.to} className="btn btn-leaf h-11 w-11 !px-0 sm:hidden" aria-label={businessLink.label}>
                <Store size={18} />
              </Link>
            </div>
          </div>
          {searchOpen && (
            <div className="px-4 pb-3 md:hidden">
              <div className="relative">
                <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input autoFocus value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="חיפוש דילים…" className="input h-11 pr-10" />
              </div>
            </div>
          )}
          <div className="mx-auto max-w-7xl px-3">
            <CategoryStrip boot={boot} active={category?.slug ?? null} onPick={ctx.setCategory} />
          </div>
        </header>

        <motion.main key={loc.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex-1">
          <Outlet />
        </motion.main>

        <footer className="relative mt-20 overflow-hidden bg-leaf-950 text-ink-200">
          <div aria-hidden className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(700px 300px at 85% 0%, rgba(140,193,10,.25), transparent 70%), radial-gradient(600px 300px at 10% 100%, rgba(140,63,24,.35), transparent 70%)' }} />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <BrandLogo height={52} />
              <p className="max-w-xs text-sm leading-relaxed text-ink-300">{site?.footerText}</p>
            </div>
            <div>
              <h3 className="mb-3 font-bold text-white">ללקוחות</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:text-lime-300">כל הדילים</Link></li>
                <li><button onClick={() => setCityOpen(true)} className="hover:text-lime-300">דילים לפי עיר</button></li>
                <li><button onClick={() => setContactOpen(true)} className="hover:text-lime-300">צור קשר</button></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-bold text-white">לעסקים</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="hover:text-lime-300">הרשמה חינם — {boot?.settings.trial.siteDays ?? 3} ימי ניסיון</Link></li>
                <li><Link to="/pricing" className="hover:text-lime-300">חבילות ומחירים</Link></li>
                <li><Link to="/login" className="hover:text-lime-300">כניסה לממשק העסק</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-bold text-white">דברו איתנו</h3>
              <ul className="space-y-2 text-sm">
                {site?.contactPhone && (
                  <li className="flex items-center gap-2"><Phone size={15} className="text-lime-400" /><a href={`tel:${site.contactPhone}`} dir="ltr">{site.contactPhone}</a></li>
                )}
                {site?.contactEmail && (
                  <li className="flex items-center gap-2"><Mail size={15} className="text-lime-400" /><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></li>
                )}
              </ul>
            </div>
          </div>
          <div className="relative border-t border-white/10 py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} {site?.name ?? 'בולדיל'} · כל הזכויות שמורות</div>
        </footer>
      </div>
      {boot && <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} cities={boot.cities} current={city} onPick={ctx.setCity} />}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </SiteContext.Provider>
  );
}
