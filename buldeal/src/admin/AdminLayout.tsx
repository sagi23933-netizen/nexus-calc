import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Bell, Bot, Building2, ChevronsLeft, ChevronsRight, CreditCard, ExternalLink, LayoutDashboard, LifeBuoy, LogOut, MapPin, Megaphone, Menu,
  Search, Settings, ShieldCheck, ScrollText, Shapes, Ticket, Package as PackageIcon, X, CheckCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { relative } from '../lib/format';
import type { Notification } from '../lib/types';
import { PageLoader, cx } from '../shared/ui';

type Badges = { tickets: number; notifications: number; trialsEnding: number };

const NAV: { group: string; items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: keyof Badges }[] }[] = [
  {
    group: 'ראשי',
    items: [
      { to: '/admin', label: 'דשבורד', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'אנליטיקס וכניסות', icon: BarChart3 },
    ],
  },
  {
    group: 'עסקים',
    items: [
      { to: '/admin/businesses', label: 'עסקים', icon: Building2, badge: 'trialsEnding' },
      { to: '/admin/deals', label: 'דילים', icon: Ticket },
      { to: '/admin/support', label: 'פניות ותמיכה', icon: LifeBuoy, badge: 'tickets' },
    ],
  },
  {
    group: 'מוצר',
    items: [
      { to: '/admin/packages', label: 'סטודיו חבילות', icon: PackageIcon },
      { to: '/admin/categories', label: 'קטגוריות', icon: Shapes },
      { to: '/admin/cities', label: 'ערים', icon: MapPin },
      { to: '/admin/ai', label: 'מודלי AI', icon: Bot },
    ],
  },
  { group: 'כספים', items: [{ to: '/admin/payments', label: 'תשלומים וטוקנים', icon: CreditCard }] },
  {
    group: 'מערכת',
    items: [
      { to: '/admin/notifications', label: 'התראות ושידור', icon: Megaphone, badge: 'notifications' },
      { to: '/admin/settings', label: 'הגדרות', icon: Settings },
      { to: '/admin/admins', label: 'מנהלים', icon: ShieldCheck },
      { to: '/admin/audit', label: 'יומן פעולות', icon: ScrollText },
    ],
  },
];

const TITLES: [RegExp, string][] = [
  [/^\/admin\/?$/, 'דשבורד'],
  [/^\/admin\/analytics/, 'אנליטיקס וכניסות'],
  [/^\/admin\/businesses\/\d+/, 'כרטיס עסק'],
  [/^\/admin\/businesses/, 'עסקים'],
  [/^\/admin\/deals/, 'דילים'],
  [/^\/admin\/support/, 'פניות ותמיכה'],
  [/^\/admin\/packages/, 'סטודיו חבילות'],
  [/^\/admin\/categories/, 'קטגוריות'],
  [/^\/admin\/cities/, 'ערים'],
  [/^\/admin\/ai/, 'מודלי AI'],
  [/^\/admin\/payments/, 'תשלומים וטוקנים'],
  [/^\/admin\/notifications/, 'התראות ושידור'],
  [/^\/admin\/settings/, 'הגדרות'],
  [/^\/admin\/admins/, 'מנהלים'],
  [/^\/admin\/audit/, 'יומן פעולות'],
];

function SidebarContent({ collapsed, badges, onNavigate }: { collapsed: boolean; badges: Badges | null; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 scrollbar-none">
      {NAV.map((g) => (
        <div key={g.group}>
          {!collapsed && <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-ink-500">{g.group}</div>}
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const count = it.badge && badges ? badges[it.badge] : 0;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                      collapsed && 'justify-center px-0',
                      isActive ? 'text-leaf-950' : 'text-ink-300 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="admin-nav-active"
                          className="absolute inset-0 rounded-xl"
                          style={{ background: 'linear-gradient(160deg,#c6f16b,#8cc10a 60%,#6f9e0b)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 0 rgba(0,0,0,.2), 0 10px 20px -10px rgba(140,193,10,.7)' }}
                          transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                        />
                      )}
                      <it.icon size={18} className="relative shrink-0" />
                      {!collapsed && <span className="relative flex-1 truncate">{it.label}</span>}
                      {count > 0 && (
                        <span
                          className={cx(
                            'relative min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5',
                            isActive ? 'bg-leaf-950/20 text-leaf-950' : 'bg-lime-400 text-leaf-950',
                            collapsed && 'absolute -left-1 -top-1 min-w-[18px] text-[10px] leading-[18px]',
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function useClickOutside(ref: RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function NotificationsMenu({ unread, onChange }: { unread: number; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const nav = useNavigate();

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const d = await api.get<{ items: Notification[] }>('/admin/notifications').catch(() => null);
      setItems(d?.items.slice(0, 12) ?? []);
    }
  };
  const readAll = async () => {
    await api.post('/admin/notifications/read');
    setItems((l) => l?.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })) ?? null);
    onChange();
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="btn-icon relative text-ink-200 hover:bg-white/10" aria-label="התראות">
        <Bell size={19} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-black text-leaf-950">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="a-card absolute left-0 top-12 z-50 w-[min(380px,calc(100vw-24px))] !rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="font-bold text-white">התראות מערכת</span>
              <button onClick={readAll} className="flex items-center gap-1 text-xs font-semibold text-lime-300 hover:text-lime-200">
                <CheckCheck size={14} /> סימון הכל כנקרא
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {!items ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-12" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-ink-400">אין התראות</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setOpen(false);
                      if (n.link) nav(n.link);
                    }}
                    className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-right transition hover:bg-white/5"
                  >
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-white/15' : 'bg-lime-400')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-400">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-ink-500">{relative(n.created_at)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <Link to="/admin/notifications" onClick={() => setOpen(false)} className="block py-3 text-center text-sm font-semibold text-lime-300 hover:bg-white/5">
              לכל ההתראות ושידור הודעות
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const name = me.user?.name || 'מנהל';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-white/5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-wood-300 to-wood-600 font-black text-white shadow-3d">{name[0]}</span>
        <span className="hidden text-right leading-tight md:block">
          <span className="block text-sm font-bold text-white">{name}</span>
          <span className="block text-[11px] text-ink-400">מנהל על</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="a-card absolute left-0 top-12 z-50 w-56 !rounded-2xl p-1.5">
            <div className="truncate px-3 py-2 text-xs text-ink-400" dir="ltr">
              {me.user?.email}
            </div>
            <Link to="/admin/settings" onClick={close} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-200 hover:bg-white/5">
              <Settings size={16} /> הגדרות מערכת
            </Link>
            <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-200 hover:bg-white/5">
              <ExternalLink size={16} /> צפייה באתר
            </a>
            <button
              onClick={async () => {
                await logout();
                nav('/admin/login', { replace: true });
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              <LogOut size={16} /> התנתקות
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [badges, setBadges] = useState<Badges | null>(null);
  const [q, setQ] = useState('');

  const loadBadges = useCallback(() => {
    api.get<Badges>('/admin/badges').then(setBadges).catch(() => {});
  }, []);

  useEffect(() => {
    loadBadges();
    const t = setInterval(loadBadges, 60_000);
    return () => clearInterval(t);
  }, [loadBadges]);

  useEffect(() => {
    loadBadges();
    setDrawer(false);
  }, [loc.pathname, loadBadges]);

  useEffect(() => {
    document.title = `${TITLES.find(([r]) => r.test(loc.pathname))?.[1] ?? 'ניהול'} · בולדיל אדמין`;
  }, [loc.pathname]);

  const title = TITLES.find(([r]) => r.test(loc.pathname))?.[1] ?? 'ניהול';

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/admin/businesses?q=${encodeURIComponent(q.trim())}`);
  };

  const brand = (
    <Link to="/admin" className={cx('flex items-center gap-3 px-5 py-5', collapsed && 'justify-center px-0')}>
      <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 drop-shadow-[0_8px_14px_rgba(140,193,10,.35)]" />
      {!collapsed && (
        <span className="leading-tight">
          <span className="block font-display text-xl text-white">בולדיל</span>
          <span className="block text-[11px] font-semibold tracking-wide text-lime-300/80">SUPER ADMIN</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="admin-theme min-h-screen">
      {/* desktop sidebar */}
      <aside
        className={cx('fixed inset-y-0 right-0 z-40 hidden flex-col border-l border-white/5 transition-[width] duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-[264px]')}
        style={{ background: 'linear-gradient(180deg, rgba(18,32,23,.85), rgba(8,16,11,.92))', backdropFilter: 'blur(18px)', boxShadow: '-20px 0 50px -30px rgba(0,0,0,.8)' }}
      >
        {brand}
        <SidebarContent collapsed={collapsed} badges={badges} />
        <button onClick={() => setCollapsed((c) => !c)} className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-ink-400 transition hover:bg-white/5 hover:text-white">
          {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
          {!collapsed && 'כיווץ תפריט'}
        </button>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 right-0 flex w-[280px] flex-col border-l border-white/5"
              style={{ background: 'linear-gradient(180deg,#122017,#08100b)' }}
            >
              <div className="flex items-center justify-between">
                {brand}
                <button onClick={() => setDrawer(false)} className="btn-icon ml-3 text-ink-300 hover:bg-white/10" aria-label="סגירת תפריט">
                  <X size={20} />
                </button>
              </div>
              <SidebarContent collapsed={false} badges={badges} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={cx('transition-[padding] duration-300', collapsed ? 'lg:pr-[76px]' : 'lg:pr-[264px]')}>
        <header className="sticky top-0 z-30 border-b border-white/5" style={{ background: 'rgba(8,16,11,.72)', backdropFilter: 'blur(16px) saturate(140%)' }}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button onClick={() => setDrawer(true)} className="btn-icon text-ink-200 hover:bg-white/10 lg:hidden" aria-label="תפריט">
              <Menu size={20} />
            </button>
            <h2 className="truncate text-lg font-bold text-white">{title}</h2>
            <form onSubmit={search} className="relative mr-auto hidden w-full max-w-xs md:block">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש עסק, אימייל, טלפון…" className="a-input !py-2 !pr-9 text-sm" />
            </form>
            <div className="mr-auto flex items-center gap-1 md:mr-0">
              <a href="/" target="_blank" rel="noreferrer" className="btn btn-sm a-btn-outline hidden sm:inline-flex">
                <ExternalLink size={15} /> צפייה באתר
              </a>
              <NotificationsMenu unread={badges?.notifications ?? 0} onChange={loadBadges} />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
              <Suspense fallback={<PageLoader dark />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
