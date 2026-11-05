import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Coins, CreditCard, FileText, Printer, Receipt, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Wallet } from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { BusinessInfo, CardInput, Package, Payment, TokenTx } from '../lib/types';
import { BLOCK_REASON, date, dateTime, daysLeft, money, STATUS_LABEL, TOKEN_TYPE } from '../lib/format';
import { PackageCard } from '../shared/PackageCard';
import { CheckoutModal } from '../shared/CheckoutModal';
import { CardForm, emptyCard, validateCardInput } from '../shared/CardForm';
import { BrandLogo } from '../shared/Brand';
import { Button, Empty, Modal, Pagination, Skeleton, StatusBadge, Switch, Tabs, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, Panel } from './kit';

interface BillingData {
  business: BusinessInfo;
  subscriptions: Package[];
  tokenPacks: Package[];
  payments: Payment[];
  billing: { provider: string; vatPercent: number; pricesIncludeVat: boolean };
}

interface InvoiceData {
  payment: Payment;
  business: { name: string; address: string; phone: string; owner: string; email: string };
  site: { name: string; contactEmail: string; contactPhone: string };
}

function InvoiceModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, loading } = useApi<InvoiceData>(id ? `/business/billing/invoices/${id}` : null);
  const p = data?.payment;
  return (
    <Modal
      open={!!id}
      onClose={onClose}
      size="lg"
      title="חשבונית מס / קבלה"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            סגירה
          </Button>
          <Button onClick={() => window.print()} icon={<Printer size={17} />} disabled={!data}>
            הדפסה / שמירה כ-PDF
          </Button>
        </>
      }
    >
      {loading || !data || !p ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="print-area relative overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-ink-100 sm:p-8">
          {p.status === 'refunded' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded-2xl border-4 border-red-400/60 px-6 py-2 text-5xl font-black text-red-400/60">זוכה</span>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-5">
            <div>
              <BrandLogo to={null} height={48} />
              <div className="mt-2 text-xs text-ink-500">
                {data.site.contactEmail} · {data.site.contactPhone}
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs text-ink-500">מספר חשבונית</div>
              <div className="font-mono text-xl font-black" dir="ltr">
                {p.invoice_number}
              </div>
              <div className="mt-1 text-xs text-ink-500">{dateTime(p.created_at)}</div>
            </div>
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-ink-400">לכבוד</div>
              <div className="font-bold">{data.business.name}</div>
              <div className="text-sm text-ink-600">{data.business.owner}</div>
              <div className="text-sm text-ink-600">{data.business.address}</div>
              <div className="text-sm text-ink-600">
                {data.business.phone} · {data.business.email}
              </div>
            </div>
            <div className="sm:text-left">
              <div className="text-xs font-semibold text-ink-400">אמצעי תשלום</div>
              <div className="text-sm">כרטיס אשראי •••• {p.card_last4 || '—'}</div>
              <div className="text-xs text-ink-500" dir="ltr">
                {p.provider_ref}
              </div>
              {p.period_start && (
                <div className="mt-1 text-sm text-ink-600">
                  תקופה: {date(p.period_start)} – {date(p.period_end)}
                </div>
              )}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-ink-100 text-ink-500">
                <th className="py-2 text-right font-semibold">תיאור</th>
                <th className="py-2 text-left font-semibold">סכום</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-ink-100">
                <td className="py-3 font-semibold">{p.description}</td>
                <td className="py-3 text-left tabular-nums">{money(Math.round((p.amount - p.vat) * 100) / 100, { decimals: true })}</td>
              </tr>
            </tbody>
          </table>
          <div className="mr-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">סכום לפני מע״מ</span>
              <span className="tabular-nums">{money(Math.round((p.amount - p.vat) * 100) / 100, { decimals: true })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">מע״מ</span>
              <span className="tabular-nums">{money(p.vat, { decimals: true })}</span>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-2 text-lg font-black">
              <span>סה״כ לתשלום</span>
              <span className="tabular-nums">{money(p.amount, { decimals: true })}</span>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-ink-400">מסמך ממוחשב · {data.site.name}</p>
        </div>
      )}
    </Modal>
  );
}

function CardModal({ open, onClose, demo, onSaved }: { open: boolean; onClose: () => void; demo: boolean; onSaved: (b: BusinessInfo) => void }) {
  const toast = useToast();
  const [card, setCard] = useState<CardInput>(emptyCard);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const save = async () => {
    const v = validateCardInput(card);
    if (v) return setError(v);
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ business: BusinessInfo }>('/business/billing/card', { card: { ...card, number: card.number.replace(/\s/g, '') } });
      onSaved(res.business);
      toast('אמצעי התשלום עודכן');
      setCard(emptyCard);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="עדכון אמצעי תשלום"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={save} loading={loading} icon={<ShieldCheck size={17} />}>
            שמירת כרטיס
          </Button>
        </>
      }
    >
      <CardForm value={card} onChange={setCard} demo={demo} />
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
    </Modal>
  );
}

function TokenLedger() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<{ items: TokenTx[]; total: number }>(`/business/tokens${qs({ page, size: 30 })}`);
  if (loading && !data) return <Skeleton className="h-60" />;
  if (!data?.items.length) return <Empty icon={<Coins size={28} />} title="אין תנועות טוקנים" />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="l-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>סוג</th>
              <th>פירוט</th>
              <th>כמות</th>
              <th>יתרה</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap text-ink-500">{dateTime(t.created_at)}</td>
                <td className="whitespace-nowrap">
                  <span className={cx('chip', t.pool === 'daily' ? 'bg-sky-50 text-sky-700' : 'bg-ink-100 text-ink-700')}>{TOKEN_TYPE[t.type] ?? t.type}</span>
                </td>
                <td className="max-w-[320px] truncate text-ink-600">{t.note}</td>
                <td className={cx('font-black tabular-nums', t.amount > 0 ? 'text-lime-700' : 'text-wood-600')} dir="ltr">
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </td>
                <td className="tabular-nums text-ink-600">
                  {t.balance_after}
                  {t.pool === 'daily' && <span className="text-xs text-ink-400"> (יומי)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} size={30} onPage={setPage} />
    </>
  );
}

export default function BillingPage() {
  const { setBusiness } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi<BillingData>('/business/billing');
  const [checkout, setCheckout] = useState<Package | null>(null);
  const [invoice, setInvoice] = useState<number | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [tab, setTab] = useState<'payments' | 'tokens'>('payments');
  const [busy, setBusy] = useState<number | 'renew' | null>(null);

  useEffect(() => {
    if (data?.business) setBusiness(data.business);
  }, [data, setBusiness]);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[460px] rounded-[30px]" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const b = data.business;
  const demo = data.billing.provider === 'demo';
  const current = b.package?.id;
  const cantBuyTokens = ['blocked', 'suspended'].includes(b.status);

  const updated = (nb: BusinessInfo) => {
    setBusiness(nb);
    reload();
  };

  const selectFree = async (p: Package) => {
    setBusy(p.id);
    try {
      const res = await api.post<{ business: BusinessInfo }>('/business/billing/select-package', { packageId: p.id });
      updated(res.business);
      toast(`החבילה הוחלפה ל-${p.name}. התשלום יתבצע בסיום הניסיון.`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const toggleRenew = async (v: boolean) => {
    setBusy('renew');
    try {
      const res = await api.post<{ business: BusinessInfo }>('/business/billing/auto-renew', { enabled: v });
      updated(res.business);
      toast(v ? 'החידוש האוטומטי הופעל' : 'החידוש האוטומטי כובה — המנוי יסתיים בסוף התקופה', v ? 'success' : 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const subCta = (p: Package): { label: string; action: () => void; disabled?: boolean; secondary?: { label: string; action: () => void } } => {
    const isCurrent = p.id === current;
    if (b.status === 'trial') {
      return isCurrent
        ? { label: 'תשלום והפעלה עכשיו', action: () => setCheckout(p) }
        : { label: 'בחירה בחבילה', action: () => selectFree(p), secondary: { label: 'או לשלם ולהפעיל עכשיו', action: () => setCheckout(p) } };
    }
    if (b.status === 'active') return isCurrent ? { label: 'החבילה הנוכחית', action: () => {}, disabled: true } : { label: 'מעבר ותשלום', action: () => setCheckout(p) };
    if (b.status === 'suspended') return { label: 'החשבון מושעה', action: () => {}, disabled: true };
    return isCurrent ? { label: 'חידוש ותשלום', action: () => setCheckout(p) } : { label: 'מעבר ותשלום', action: () => setCheckout(p) };
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader title="חבילות ותשלומים" subtitle="ניהול המנוי, טוקנים, אמצעי תשלום וחשבוניות" icon={<Wallet size={22} />} />

      {demo && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>
            <b>מצב הדגמה:</b> מערכת הסליקה פועלת בסימולציה — לא מתבצעים חיובים אמיתיים. כרטיס שמספרו מסתיים ב-0002 יידחה לצורך בדיקה.
          </span>
        </div>
      )}

      {/* status + tokens */}
      <div className="grid gap-6 lg:grid-cols-5">
        <motion.section
          initial={{ opacity: 0, rotateX: 10 }}
          animate={{ opacity: 1, rotateX: 0 }}
          style={{ transformPerspective: 1200 }}
          className="relative overflow-hidden rounded-[30px] p-6 text-white shadow-deep lg:col-span-3"
        >
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#0b2a14,#1e5c2e 55%,#3f8f2a)' }} />
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-white/70">המנוי שלי</span>
              <span className="chip bg-white/15 text-white ring-1 ring-white/20">{STATUS_LABEL[b.status]}</span>
            </div>
            <div className="mt-2 font-display text-4xl">{b.package ? `חבילת ${b.package.name}` : 'לא נבחרה חבילה'}</div>
            {b.package && (
              <div className="text-white/75">
                {money(b.package.price)} {b.package.period === 'year' ? 'לשנה' : 'לחודש'} · {b.package.tokens} טוקנים בכל תקופה
              </div>
            )}
            {['blocked', 'suspended'].includes(b.status) && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-1.5 text-sm ring-1 ring-red-300/30">
                <TriangleAlert size={15} /> {BLOCK_REASON[b.blocked_reason] || 'החשבון חסום'}
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Info icon={<CalendarClock size={16} />} label={b.status === 'trial' ? 'סיום ניסיון' : 'סוף התקופה'} value={b.status === 'trial' ? `${date(b.trial.ends_at)} · עוד ${daysLeft(b.trial.ends_at)} ימים` : date(b.period_end)} />
              <Info
                icon={<CreditCard size={16} />}
                label="אמצעי תשלום"
                value={b.card ? `${b.card.brand} •••• ${b.card.last4}` : 'לא הוגדר'}
                action={
                  <button onClick={() => setCardOpen(true)} className="text-xs font-bold text-lime-300 hover:underline">
                    {b.card ? 'עדכון' : 'הוספה'}
                  </button>
                }
              />
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <RefreshCw size={14} /> חידוש אוטומטי
                </div>
                <div className="mt-2">
                  {['active', 'past_due'].includes(b.status) ? (
                    <Switch checked={b.auto_renew} onChange={toggleRenew} disabled={busy === 'renew'} label={<span className="text-white">{b.auto_renew ? 'פעיל' : 'כבוי'}</span>} />
                  ) : (
                    <span className="text-sm text-white/80">{b.status === 'trial' ? 'יופעל לאחר התשלום' : '—'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="card-3d relative overflow-hidden p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-amber-200/50 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-sm text-ink-500">טוקנים זמינים לפרסום</div>
              <div className="mt-1 font-display text-6xl leading-none text-ink-900">{b.tokens.available}</div>
            </div>
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              style={{ transformPerspective: 600, background: 'radial-gradient(circle at 35% 30%,#fff7c2,#f5c518 55%,#a07a00 120%)' }}
              className="flex h-16 w-16 items-center justify-center rounded-full text-amber-900 shadow-3d"
            >
              <Coins size={30} />
            </motion.div>
          </div>
          <div className="relative mt-5 space-y-2 text-sm">
            <div className="flex justify-between rounded-xl bg-ink-50 px-3 py-2">
              <span className="text-ink-500">יתרה מחבילות ורכישות</span>
              <b>{b.tokens.balance}</b>
            </div>
            {b.status === 'trial' && (
              <div className="flex justify-between rounded-xl bg-sky-50 px-3 py-2 text-sky-900">
                <span>טוקן יומי (תקופת ניסיון)</span>
                <b>{b.tokens.daily ? 'זמין היום' : 'חדש מחר'}</b>
              </div>
            )}
            <p className="pt-1 text-xs text-ink-500">כל פרסום דיל עולה טוקן אחד. טוקנים מחבילת טוקנים לא פגים.</p>
          </div>
          <a href="#token-packs" className="btn btn-outline relative mt-4 w-full">
            <Sparkles size={16} /> רכישת טוקנים נוספים
          </a>
        </section>
      </div>

      {/* subscriptions */}
      <section>
        <div className="mb-5">
          <h2 className="text-xl font-black text-ink-900">{b.status === 'trial' ? 'בחרו את החבילה שתמשיך אחרי הניסיון' : 'חבילות מנוי'}</h2>
          <p className="text-sm text-ink-500">
            {b.status === 'trial' ? 'אפשר להחליף חבילה בחינם עד סוף תקופת הניסיון. אין צורך בכרטיס אשראי עד אז.' : 'מעבר חבילה מחויב מיידית ומתחיל תקופה חדשה.'}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.subscriptions.map((p) => {
            const cta = subCta(p);
            return (
              <PackageCard
                key={p.id}
                pkg={p}
                current={p.id === current}
                selected={p.id === current}
                ctaLabel={cta.label}
                ctaDisabled={cta.disabled}
                ctaLoading={busy === p.id}
                onSelect={cta.action}
                footer={
                  cta.secondary ? (
                    <button onClick={cta.secondary.action} className="mt-3 w-full text-center text-sm font-semibold underline-offset-2 opacity-80 hover:underline" style={{ color: p.theme.text }}>
                      {cta.secondary.label}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      </section>

      {/* token packs */}
      {data.tokenPacks.length > 0 && (
        <section id="token-packs" className="scroll-mt-24">
          <div className="mb-5">
            <h2 className="text-xl font-black text-ink-900">חבילות טוקנים</h2>
            <p className="text-sm text-ink-500">צריכים עוד פרסומים החודש? טוקנים נוספים, ללא תאריך תפוגה.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.tokenPacks.map((p) => (
              <PackageCard key={p.id} pkg={p} ctaLabel={cantBuyTokens ? 'יש להסדיר מנוי' : p.cta_text || 'רכישה'} ctaDisabled={cantBuyTokens} onSelect={() => setCheckout(p)} />
            ))}
          </div>
        </section>
      )}

      {/* history */}
      <Panel
        padded={false}
        title="היסטוריה"
        icon={<Receipt size={17} />}
        actions={
          <Tabs<'payments' | 'tokens'>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'payments', label: 'תשלומים וחשבוניות' },
              { value: 'tokens', label: 'תנועות טוקנים' },
            ]}
          />
        }
      >
        {tab === 'payments' ? (
          data.payments.length === 0 ? (
            <Empty icon={<FileText size={28} />} title="עוד לא בוצעו תשלומים" text="חשבוניות יופיעו כאן אחרי כל תשלום." />
          ) : (
            <div className="overflow-x-auto">
              <table className="l-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>תיאור</th>
                    <th>סכום</th>
                    <th>כרטיס</th>
                    <th>סטטוס</th>
                    <th>חשבונית</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-ink-500">{dateTime(p.created_at)}</td>
                      <td className="max-w-[300px]">
                        <div className="truncate font-semibold">{p.description}</div>
                        {p.failure_reason && <div className="text-xs text-red-600">{p.failure_reason}</div>}
                      </td>
                      <td className="whitespace-nowrap font-bold tabular-nums">{money(p.amount)}</td>
                      <td className="whitespace-nowrap text-ink-500">{p.card_last4 ? `•••• ${p.card_last4}` : '—'}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        {p.invoice_number ? (
                          <Button size="sm" variant="outline" onClick={() => setInvoice(p.id)} icon={<FileText size={14} />}>
                            {p.invoice_number}
                          </Button>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <TokenLedger />
        )}
      </Panel>

      <CheckoutModal open={!!checkout} onClose={() => setCheckout(null)} pkg={checkout} business={b} demo={demo} onDone={updated} />
      <InvoiceModal id={invoice} onClose={() => setInvoice(null)} />
      <CardModal open={cardOpen} onClose={() => setCardOpen(false)} demo={demo} onSaved={updated} />
    </div>
  );
}

function Info({ icon, label, value, action }: { icon: ReactNode; label: string; value: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          {icon} {label}
        </span>
        {action}
      </div>
      <div className="mt-1.5 truncate text-sm font-bold">{value}</div>
    </div>
  );
}
