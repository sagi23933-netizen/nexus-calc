import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { InstallButton } from '../shared/InstallPrompt';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Bell, ChevronDown, Coins, CreditCard, ExternalLink, Gift, Home, KeyRound, LayoutGrid, LogOut, Plus, Rocket, Store, Timer, TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useNow } from '../lib/hooks';
import type { Notification } from '../lib/types';
import { relative, timeLeft } from '../lib/format';
import { BrandLogo } from '../shared/Brand';
import { Avatar, PageLoader, Spinner, StatusBadge, cx } from '../shared/ui';
import { BootstrapProvider } from './kit';
import { SupportWidget } from './SupportWidget';
import { FeedbackPrompt } from './FeedbackModal';
import { BlockedScreen } from './BlockedScreen';
import { ChangePasswordModal } from './ChangePasswordModal';

const NAV = [
  { to: '/dashboard', label: 'סקירה', icon: Home, end: true },
  { to: '/dashboard/deals', label: 'הדילים שלי', icon: LayoutGrid },
  { to: '/dashboard/stats', label: 'סטטיסטיקות', icon: BarChart3 },
  { to: '/dashboard/billing', label: 'חבילות ותשלומים', icon: CreditCard },
  { to: '/dashboard/profile', label: 'פרופיל העסק', icon: Store },
  { to: '/dashboard/notifications', label: 'התראות', icon: Bell },
];

const OPEN_WHEN_BLOCKED = ['/dashboard/billing', '/dashboard/profile', '/dashboard/notifications'];

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

function Dropdown({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97, rotateX: -10 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{ transformPerspective: 900, transformOrigin: 'top left' }}
          className={cx('absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-3xl bg-white shadow-deep ring-1 ring-ink-100', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NotificationsBell({ unread }: { unread: number }) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    api.get<{ items: Notification[] }>('/business/notifications').then((d) => setItems(d.items.slice(0, 8))).catch(() => setItems([]));
  }, [open]);

  const go = async (n: Notification) => {
    setOpen(false);
    if (!n.read_at) await api.post('/business/notifications/read', { ids: [n.id] }).catch(() => {});
    refresh();
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api.post('/business/notifications/read', {}).catch(() => {});
    setItems((l) => l?.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })) ?? null);
    refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-icon relative h-11 w-11 rounded-2xl bg-white shadow-soft ring-1 ring-ink-100" aria-label="התראות">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <Dropdown open={open} className="w-[min(92vw,380px)]">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <span className="font-bold">התראות</span>
          {unread > 0 && (
            <button onClick={readAll} className="text-xs font-semibold text-lime-700 hover:underline">
              סימון הכל כנקרא
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {!items ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">אין התראות חדשות</p>
          ) : (
            items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={cx('flex w-full gap-3 px-4 py-3 text-right transition hover:bg-lime-50', !n.read_at && 'bg-lime-50/50')}>
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-ink-200' : 'bg-lime-500')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-ink-400">{relative(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <Link to="/dashboard/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 py-3 text-center text-sm font-semibold text-leaf-700 hover:bg-ink-50">
          לכל ההתראות
        </Link>
      </Dropdown>
    </div>
  );
}

function UserMenu({ onPassword }: { onPassword: () => void }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const b = me.business!;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-2xl bg-white py-1 pl-2 pr-1 shadow-soft ring-1 ring-ink-100 transition hover:ring-lime-300">
        <Avatar src={b.logo_url} name={b.name} size={36} />
        <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{me.user?.name || b.name}</span>
        <ChevronDown size={16} className="text-ink-400" />
      </button>
      <Dropdown open={open} className="w-64">
        <div className="border-b border-ink-100 px-4 py-3">
          <div className="truncate font-bold">{b.name}</div>
          <div className="truncate text-xs text-ink-500">{me.user?.email}</div>
        </div>
        <div className="p-1.5">
          {[
            { icon: <Store size={17} />, label: 'פרופיל העסק', onClick: () => navigate('/dashboard/profile') },
            { icon: <ExternalLink size={17} />, label: 'צפייה בדף העסק באתר', onClick: () => window.open(`/b/${b.slug}`, '_blank') },
            { icon: <KeyRound size={17} />, label: 'שינוי סיסמה', onClick: onPassword },
          ].map((i) => (
            <button
              key={i.label}
              onClick={() => {
                setOpen(false);
                i.onClick();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <span className="text-ink-400">{i.icon}</span>
              {i.label}
            </button>
          ))}
          <InstallButton
            label="התקנת האפליקציה בטלפון"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-leaf-700 hover:bg-lime-50 [&>svg]:text-lime-600"
          />
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={17} /> התנתקות
          </button>
        </div>
      </Dropdown>
    </div>
  );
}

function TrialBanner() {
  const { me } = useAuth();
  const now = useNow(30000);
  const b = me.business!;
  if (b.status === 'past_due') {
    return (
      <div className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-l from-amber-50 to-amber-100 px-4 py-3 text-amber-900 ring-1 ring-amber-200 lg:mx-8">
        <TriangleAlert size={20} className="shrink-0" />
        <span className="flex-1 text-sm font-semibold">חידוש המנוי נכשל. עדכנו אמצעי תשלום כדי למנוע חסימה של החשבון.</span>
        <Link to="/dashboard/billing" className="btn btn-sm btn-wood">
          עדכון תשלום
        </Link>
      </div>
    );
  }
  if (b.status !== 'trial' || !b.trial.ends_at) return null;
  const t = timeLeft(b.trial.ends_at, now);
  const urgent = t.ms < 24 * 3600_000;
  const total = Math.max(1, b.trial.days) * 86400_000;
  const progress = Math.min(1, Math.max(0, t.ms / total));
  return (
    <div
      className={cx('relative mx-4 mt-4 overflow-hidden rounded-3xl px-4 py-3.5 text-white shadow-lift sm:px-5 sm:py-4 lg:mx-8', urgent && 'ring-2 ring-amber-300')}
      style={{ background: urgent ? 'linear-gradient(120deg,#6e3013,#a8592a 60%,#c47643)' : 'linear-gradient(120deg,#123a1f,#1e5c2e 55%,#3f8f2a)' }}
    >
      <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner-top sm:flex">{urgent ? <Timer size={24} /> : <Gift size={24} />}</div>
        <div className="min-w-[240px] flex-1">
          <div className="font-bold">
            {urgent ? 'תקופת הניסיון מסתיימת בקרוב!' : 'את/ה בתקופת ניסיון חינם'}{' '}
            <span className="tabular-nums text-lime-200">
              · נותרו {t.d > 0 ? `${t.d} ימים ו-` : ''}
              {t.h} שעות
            </span>
          </div>
          <div className="mt-0.5 hidden text-sm text-white/75 sm:block">
            {b.package ? `בסיום הניסיון תמשיך חבילת ${b.package.name}. ` : ''}
            ללא תשלום עד סוף התקופה החשבון ייחסם אוטומטית. טוקן חינם אחד בכל יום.
          </div>
          <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full bg-lime-300" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <Link to="/dashboard/billing" className="btn btn-lime w-full shrink-0 sm:w-auto">
          <Rocket size={17} /> {b.package ? 'תשלום והפעלה' : 'בחירת חבילה'}
        </Link>
      </div>
    </div>
  );
}

function TokensPill() {
  const { me } = useAuth();
  const b = me.business!;
  return (
    <Link
      to="/dashboard/billing"
      className="group flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-3 pr-1.5 shadow-soft ring-1 ring-ink-100 transition hover:ring-lime-300"
      title={b.tokens.daily ? `${b.tokens.balance} ביתרה + ${b.tokens.daily} טוקן יומי` : `${b.tokens.balance} טוקנים ביתרה`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl text-leaf-950 shadow-3d transition group-hover:rotate-12" style={{ background: 'linear-gradient(160deg,#fff3a6,#f5c518 60%,#c99a00)' }}>
        <Coins size={17} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-black tabular-nums">{b.tokens.available}</span>
        <span className="block whitespace-nowrap text-[10px] font-medium text-ink-500">{b.tokens.daily ? `כולל ${b.tokens.daily} יומי` : 'טוקנים'}</span>
      </span>
    </Link>
  );
}

function Sidebar() {
  const { me } = useAuth();
  const b = me.business!;
  const unread = b.counts.unread_notifications;
  return (
    <aside className="fixed inset-y-0 right-0 z-40 hidden w-[284px] flex-col border-l border-white/60 bg-white/70 px-4 pb-4 pt-5 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <BrandLogo height={46} to="/" />
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-3xl bg-gradient-to-l from-white to-lime-50/70 p-3 shadow-soft ring-1 ring-ink-100">
        <Avatar src={b.logo_url} name={b.name} size={46} className="shadow-md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-ink-900">{b.name}</div>
          <div className="mt-1">
            <StatusBadge status={b.status} />
          </div>
        </div>
      </div>
      <NavLink to="/dashboard/new" className="btn btn-lime btn-lg mt-5 w-full !rounded-2xl">
        <Plus size={22} strokeWidth={3} /> פרסום דיל חדש
      </NavLink>
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx(
                'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-semibold transition',
                isActive ? 'bg-leaf-700 text-white shadow-[0_12px_24px_-12px_rgba(16,60,24,.8),inset_0_1px_0_rgba(255,255,255,.15)]' : 'text-ink-600 hover:bg-white hover:text-ink-900 hover:shadow-soft',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl transition', isActive ? 'bg-white/15 text-lime-300' : 'bg-ink-50 text-ink-500 group-hover:bg-lime-100 group-hover:text-lime-700')}>
                  <n.icon size={18} />
                </span>
                <span className="flex-1">{n.label}</span>
                {n.to === '/dashboard/notifications' && unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white">{unread}</span>}
                {n.to === '/dashboard/deals' && b.counts.live_deals > 0 && (
                  <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-black', isActive ? 'bg-white/20 text-white' : 'bg-lime-100 text-lime-800')}>{b.counts.live_deals}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Link to="/dashboard/billing" className="relative mt-4 block overflow-hidden rounded-3xl p-4 text-white shadow-lift" style={{ background: 'linear-gradient(150deg,#0f3519,#1e5c2e 60%,#3f8f2a)' }}>
        <div className="pointer-events-none absolute -left-6 -top-10 h-28 w-28 rounded-full bg-lime-400/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <span className="text-sm text-white/75">טוקנים זמינים</span>
          <Coins size={18} className="text-amber-300" />
        </div>
        <div className="relative mt-1 text-4xl font-black tabular-nums">{b.tokens.available}</div>
        <div className="relative mt-1 text-xs text-white/70">
          {b.package ? `חבילת ${b.package.name}` : 'לא נבחרה חבילה'}
          {b.tokens.daily ? ' · כולל טוקן יומי' : ''}
        </div>
      </Link>
    </aside>
  );
}

function MobileNav() {
  const items = [
    { to: '/dashboard', label: 'סקירה', icon: Home, end: true },
    { to: '/dashboard/deals', label: 'דילים', icon: LayoutGrid },
    { to: '/dashboard/new', label: 'דיל חדש', icon: Plus, main: true },
    { to: '/dashboard/stats', label: 'נתונים', icon: BarChart3 },
    { to: '/dashboard/billing', label: 'חבילות', icon: CreditCard },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-ink-100 bg-white/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-end justify-between">
        {items.map((i) =>
          i.main ? (
            <NavLink key={i.to} to={i.to} className="-mt-7 flex flex-col items-center gap-1 text-[11px] font-bold text-leaf-800">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-leaf-950 shadow-glow" style={{ background: 'linear-gradient(160deg,#c6f16b,#8cc10a 55%,#6f9e0b)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -4px 0 rgba(40,70,0,.35), 0 14px 26px -10px rgba(60,110,0,.8)' }}>
                <Plus size={28} strokeWidth={3} />
              </span>
              {i.label}
            </NavLink>
          ) : (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold transition', isActive ? 'text-leaf-700' : 'text-ink-400')}>
              {({ isActive }) => (
                <>
                  <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition', isActive && 'bg-lime-100')}>
                    <i.icon size={20} />
                  </span>
                  {i.label}
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}

export default function DashboardLayout() {
  const { me, refresh } = useAuth();
  const loc = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [forcedPw, setForcedPw] = useState(false);

  useEffect(() => {
    const t = setInterval(() => refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  useEffect(() => {
    if (!me.user?.mustChangePassword) return;
    try {
      if (sessionStorage.getItem('bd_pw_prompted')) return;
      sessionStorage.setItem('bd_pw_prompted', '1');
    } catch {
      /* ignore */
    }
    setForcedPw(true);
    setPwOpen(true);
  }, [me.user?.mustChangePassword]);

  const b = me.business;
  if (!b) return <PageLoader />;
  const locked = ['blocked', 'suspended'].includes(b.status) && !OPEN_WHEN_BLOCKED.some((p) => loc.pathname.startsWith(p));

  return (
    <BootstrapProvider>
      <div className="relative min-h-screen bg-cream">
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] animate-blob rounded-full bg-lime-200/40 blur-3xl" />
          <div className="absolute -bottom-48 left-1/3 h-[460px] w-[460px] animate-blob rounded-full bg-wood-100/50 blur-3xl [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(30,92,46,.06)_1px,transparent_0)] bg-[length:24px_24px]" />
        </div>
        <Sidebar />
        <div className="relative lg:pr-[284px]">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-cream/75 px-4 py-3 backdrop-blur-xl lg:px-8">
            <div className="lg:hidden">
              <BrandLogo height={36} to="/dashboard" />
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <span className="text-sm text-ink-500">שלום, </span>
              <span className="font-bold text-ink-900">{me.user?.name?.split(' ')[0] || b.name}</span>
              <span className="text-sm text-ink-500"> 👋</span>
            </div>
            <div className="flex-1 lg:hidden" />
            <TokensPill />
            <NotificationsBell unread={b.counts.unread_notifications} />
            <UserMenu
              onPassword={() => {
                setForcedPw(false);
                setPwOpen(true);
              }}
            />
          </header>
          <TrialBanner />
          <main className="px-4 pb-44 pt-6 lg:px-8 lg:pb-28">
            {locked ? (
              <BlockedScreen business={b} />
            ) : (
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}>
                <Outlet />
              </motion.div>
            )}
          </main>
        </div>
        <MobileNav />
        <SupportWidget />
        <FeedbackPrompt />
        <ChangePasswordModal open={pwOpen} forced={forcedPw} onClose={() => setPwOpen(false)} />
      </div>
    </BootstrapProvider>
  );
}

