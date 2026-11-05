import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Camera, Coins, ExternalLink, Eye, Mail, MapPin, MousePointerClick, Package as PackageIcon, Phone, ThumbsUp, Ticket, Wallet } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi } from '../lib/hooks';
import { BLOCK_REASON, money, num } from '../lib/format';
import { Avatar, Button, Empty, Skeleton, StatusBadge, Tabs, Tilt, cx } from '../shared/ui';
import { Countdown } from '../shared/Countdown';
import { useToast } from '../shared/Toast';
import { Panel } from './kit';
import { SourceBadge } from './core/shared';
import { ActionsTab, DealsTab, DetailsTab, PaymentsTab, SubscriptionTab, TicketsTab, TokensTab, type BizDetail } from './core/BizTabs';

type Tab = 'details' | 'subscription' | 'tokens' | 'deals' | 'payments' | 'tickets' | 'actions';

export default function BusinessDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'details';
  const setTab = (t: Tab) => setSp({ tab: t }, { replace: true });
  const { data, loading, error, reload } = useApi<BizDetail>(`/admin/businesses/${id}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.upload(`/admin/businesses/${id}/logo`, file);
      toast('הלוגו עודכן');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (error)
    return (
      <Panel>
        <Empty dark title="העסק לא נמצא" text={error} action={<Link to="/admin/businesses" className="btn btn-lime">חזרה לרשימה</Link>} />
      </Panel>
    );

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 !rounded-3xl" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-96 !rounded-3xl" />
      </div>
    );
  }

  const b = data.business;
  const helpedRate = data.stats.answered ? Math.round(((data.stats.helped || 0) / data.stats.answered) * 100) : null;

  return (
    <>
      <Link to="/admin/businesses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 hover:text-lime-300">
        <ArrowRight size={16} /> כל העסקים
      </Link>

      <Tilt max={3} scale={1} glare={false} style={{ borderRadius: 28 }}>
        <section className="a-card relative overflow-hidden !rounded-[28px] p-6 sm:p-8" style={{ transformStyle: 'preserve-3d' }}>
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-wood-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center" style={{ transform: 'translateZ(30px)' }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative shrink-0 self-start rounded-full bg-white p-1.5 shadow-[0_20px_40px_-14px_rgba(0,0,0,.8)] ring-4 ring-white/10"
              aria-label="החלפת לוגו"
            >
              <Avatar src={b.logo_url} name={b.name} size={96} />
              <span className={cx('absolute inset-1.5 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100', uploading && 'opacity-100')}>
                <Camera size={22} className={uploading ? 'animate-pulse' : ''} />
              </span>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-black text-white">{b.name}</h1>
                <StatusBadge status={b.status} dark />
                <SourceBadge source={b.source} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-300">
                {b.category && <span>{b.category.name}</span>}
                {b.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {b.city.name}
                  </span>
                )}
                <span className="flex items-center gap-1" dir="ltr">
                  <Phone size={14} /> {b.phone}
                </span>
                <span className="flex items-center gap-1" dir="ltr">
                  <Mail size={14} /> {data.owner.email}
                </span>
              </div>
              {b.blocked_reason && ['blocked', 'suspended'].includes(b.status) && (
                <div className="mt-3 inline-flex rounded-xl bg-red-500/10 px-3 py-1.5 text-sm text-red-200 ring-1 ring-red-400/20">{BLOCK_REASON[b.blocked_reason] || b.blocked_reason}</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm a-btn-outline">
                  <ExternalLink size={14} /> עמוד העסק באתר
                </a>
                <Button size="sm" variant="a-outline" icon={<Coins size={14} />} onClick={() => setTab('tokens')}>
                  הוספת טוקנים
                </Button>
                <Button size="sm" variant="a-outline" icon={<Wallet size={14} />} onClick={() => setTab('subscription')}>
                  ניסיון ומנוי
                </Button>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[460px] lg:grid-cols-2">
              <div className="rounded-2xl bg-black/25 p-3.5 ring-1 ring-white/5">
                <div className="flex items-center gap-1 text-[11px] text-ink-400">
                  <PackageIcon size={12} /> חבילה
                </div>
                <div className="mt-1 truncate font-black text-white">{b.package?.name || 'לא נבחרה'}</div>
              </div>
              <div className="rounded-2xl bg-black/25 p-3.5 ring-1 ring-white/5">
                <div className="flex items-center gap-1 text-[11px] text-ink-400">
                  <Coins size={12} /> טוקנים זמינים
                </div>
                <div className="mt-1 font-black text-white">
                  {b.tokens.available}
                  {b.tokens.daily > 0 && <span className="mr-1 text-xs font-medium text-sky-300">({b.tokens.daily} יומי)</span>}
                </div>
              </div>
              <div className="rounded-2xl bg-black/25 p-3.5 ring-1 ring-white/5">
                <div className="text-[11px] text-ink-400">{b.status === 'trial' ? 'ניסיון מסתיים בעוד' : 'מנוי עד'}</div>
                <div className="mt-1 font-black text-white">
                  {b.status === 'trial' && b.trial.ends_at ? <Countdown to={b.trial.ends_at} /> : b.period_end ? new Date(b.period_end).toLocaleDateString('he-IL') : '—'}
                </div>
              </div>
              <div className="rounded-2xl bg-black/25 p-3.5 ring-1 ring-white/5">
                <div className="text-[11px] text-ink-400">הכנסות מהעסק</div>
                <div className="mt-1 font-black text-white">{money(data.stats.revenue)}</div>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-5 sm:grid-cols-4">
            {[
              { icon: <Ticket size={15} />, label: 'דילים באוויר', value: data.deals.length },
              { icon: <Eye size={15} />, label: 'צפיות מצטברות', value: num(data.stats.views + data.deals.reduce((a, d) => a + (d.views ?? 0), 0)) },
              { icon: <MousePointerClick size={15} />, label: 'לחיצות חיוג/ניווט', value: num(data.stats.clicks + data.deals.reduce((a, d) => a + (d.clicks_phone ?? 0) + (d.clicks_waze ?? 0), 0)) },
              { icon: <ThumbsUp size={15} />, label: 'הפרסום עזר', value: helpedRate == null ? '—' : `${helpedRate}%` },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-lime-300">{s.icon}</span>
                <span>
                  <span className="block text-[11px] text-ink-400">{s.label}</span>
                  <span className="block font-bold text-white">{s.value}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </Tilt>

      <div className="my-6">
        <Tabs
          dark
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'details', label: 'פרטים' },
            { value: 'subscription', label: 'ניסיון ומנוי' },
            { value: 'tokens', label: 'טוקנים' },
            { value: 'deals', label: 'דילים', count: data.deals.length },
            { value: 'payments', label: 'תשלומים', count: data.payments.length },
            { value: 'tickets', label: 'פניות', count: data.tickets.length },
            { value: 'actions', label: 'פעולות' },
          ]}
        />
      </div>

      {tab === 'details' && <DetailsTab key={b.id + (b.name || '')} data={data} onSaved={reload} />}
      {tab === 'subscription' && <SubscriptionTab data={data} onSaved={reload} />}
      {tab === 'tokens' && <TokensTab data={data} onSaved={reload} />}
      {tab === 'deals' && <DealsTab data={data} onSaved={reload} />}
      {tab === 'payments' && <PaymentsTab data={data} onSaved={reload} />}
      {tab === 'tickets' && <TicketsTab data={data} />}
      {tab === 'actions' && <ActionsTab data={data} onSaved={reload} />}
    </>
  );
}
