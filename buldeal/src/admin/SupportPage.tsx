import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, CheckCircle2, Globe, LifeBuoy, Mail, Phone, RotateCcw, Send, UserRound } from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, relative, telHref } from '../lib/format';
import type { Ticket, TicketMessage } from '../lib/types';
import { Avatar, Button, Empty, Skeleton, StatusBadge, cx } from '../shared/ui';
import { DSelect } from './core/shared';
import { useToast } from '../shared/Toast';
import { PageHeader } from './kit';

type TicketFull = Ticket & { business?: string; logo_url?: string };

function Thread({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ ticket: TicketFull; messages: TicketMessage[] }>(`/admin/tickets/${id}`);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data?.messages.length]);

  useEffect(() => {
    if (data) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ticket.id]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/tickets/${id}/messages`, { message: text.trim() });
      setText('');
      reload();
      onChanged();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: 'open' | 'pending' | 'closed') => {
    try {
      await api.post(`/admin/tickets/${id}/status`, { status });
      toast(status === 'closed' ? 'הפנייה נסגרה' : 'הפנייה נפתחה מחדש');
      reload();
      onChanged();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-16" />
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="mr-auto h-20 w-1/2" />
      </div>
    );
  }
  const t = data.ticket;
  const who = t.business || t.name || 'אורח';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-4">
        <button onClick={onBack} className="btn-icon text-ink-300 hover:bg-white/10 lg:hidden" aria-label="חזרה לרשימה">
          <ArrowRight size={18} />
        </button>
        <Avatar src={t.logo_url} name={who} size={42} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-white">{t.subject}</div>
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-400">
            {t.business_id ? (
              <Link to={`/admin/businesses/${t.business_id}`} className="flex items-center gap-1 hover:text-lime-300">
                <Building2 size={12} /> {t.business}
              </Link>
            ) : (
              <span className="flex items-center gap-1">
                <UserRound size={12} /> {t.name} (פנייה מהאתר)
              </span>
            )}
            {t.email && (
              <a href={`mailto:${t.email}`} className="flex items-center gap-1 hover:text-lime-300" dir="ltr">
                <Mail size={12} /> {t.email}
              </a>
            )}
            {t.phone && (
              <a href={telHref(t.phone)} className="flex items-center gap-1 hover:text-lime-300" dir="ltr">
                <Phone size={12} /> {t.phone}
              </a>
            )}
          </div>
        </div>
        <StatusBadge status={t.status} dark />
        {t.status === 'closed' ? (
          <Button size="sm" variant="a-outline" icon={<RotateCcw size={14} />} onClick={() => setStatus('open')}>
            פתיחה מחדש
          </Button>
        ) : (
          <Button size="sm" variant="a-outline" icon={<CheckCircle2 size={14} />} onClick={() => setStatus('closed')}>
            סגירת פנייה
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-6" style={{ background: 'radial-gradient(600px 300px at 50% 0%, rgba(140,193,10,.05), transparent)' }}>
        <div className="text-center text-[11px] text-ink-500">נפתחה {dateTime(t.created_at)}</div>
        {data.messages.map((m) => {
          const mine = m.sender === 'admin';
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cx('max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-lg', mine ? 'rounded-bl-md text-leaf-950' : 'rounded-br-md bg-white/[0.06] text-ink-100 ring-1 ring-white/10')}
                style={mine ? { background: 'linear-gradient(160deg,#c6f16b,#8cc10a)' } : undefined}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={cx('mt-1 text-[10px]', mine ? 'text-leaf-900/70' : 'text-ink-500')}>
                  {mine ? 'צוות בולדיל' : who} · {dateTime(m.created_at)}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-white/5 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
            }}
            rows={2}
            placeholder={t.business_id ? 'תשובה לעסק (תופיע בחלון הצ׳אט שלו ובהתראות)…' : 'תשובה לפונה (תישלח במייל אם הוגדר SMTP)…'}
            className="a-input min-h-[52px] flex-1 resize-none"
          />
          <Button type="submit" loading={sending} disabled={!text.trim()} icon={<Send size={16} />} className="h-[52px]">
            שליחה
          </Button>
        </div>
        <div className="mt-1.5 text-[11px] text-ink-500">Ctrl+Enter לשליחה</div>
      </form>
    </div>
  );
}

export default function SupportPage() {
  const [sp, setSp] = useSearchParams();
  const selected = Number(sp.get('ticket')) || null;
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const { data, loading, reload } = useApi<{ items: TicketFull[] }>(`/admin/tickets${qs({ status, source })}`);
  const items = data?.items ?? [];

  const select = (id: number | null) => {
    const next = new URLSearchParams(sp);
    if (id) next.set('ticket', String(id));
    else next.delete('ticket');
    setSp(next, { replace: true });
  };

  const openCount = items.filter((t) => t.status !== 'closed').length;

  return (
    <>
      <PageHeader title="פניות ותמיכה" subtitle={`${openCount} פניות פתוחות · פניות מחלון הצ׳אט של העסקים ומטופס יצירת הקשר באתר`} icon={<LifeBuoy size={22} />} />
      <div className="a-card grid h-[calc(100vh-220px)] min-h-[520px] overflow-hidden lg:grid-cols-[360px_1fr]">
        <aside className={cx('flex min-h-0 flex-col border-white/5 lg:border-l', !!selected && 'hidden lg:flex')}>
          <div className="flex gap-2 border-b border-white/5 p-3">
            <DSelect className="!py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">כל הסטטוסים</option>
              <option value="open">פתוחות</option>
              <option value="pending">נענו</option>
              <option value="closed">סגורות</option>
            </DSelect>
            <DSelect className="!py-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">כל המקורות</option>
              <option value="dashboard">ממשק עסקים</option>
              <option value="site">טופס באתר</option>
            </DSelect>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && !data ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty dark icon={<LifeBuoy size={24} />} title="אין פניות" text="תיבת הפניות ריקה 🎉" />
            ) : (
              <AnimatePresence initial={false}>
                {items.map((t) => {
                  const who = t.business || t.name || 'אורח';
                  const active = t.id === selected;
                  return (
                    <motion.button
                      layout
                      key={t.id}
                      onClick={() => select(t.id)}
                      className={cx('relative flex w-full items-start gap-3 border-b border-white/5 px-4 py-3.5 text-right transition', active ? 'bg-lime-400/10' : 'hover:bg-white/5')}
                    >
                      {active && <span className="absolute inset-y-2 right-0 w-1 rounded-l-full bg-lime-400" />}
                      <Avatar src={t.logo_url} name={who} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cx('truncate text-sm', t.unread_admin ? 'font-black text-white' : 'font-semibold text-ink-100')}>{who}</span>
                          <span className="shrink-0 text-[10px] text-ink-500">{relative(t.last_message_at)}</span>
                        </span>
                        <span className="block truncate text-xs font-semibold text-ink-300">{t.subject}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{t.last_message}</span>
                        <span className="mt-1.5 flex items-center gap-1.5">
                          <StatusBadge status={t.status} dark />
                          <span className="chip bg-white/5 text-ink-400">
                            {t.source === 'site' ? <Globe size={11} /> : <Building2 size={11} />}
                            {t.source === 'site' ? 'אתר' : 'עסק'}
                          </span>
                        </span>
                      </span>
                      {t.unread_admin > 0 && <span className="mt-1 min-w-[20px] rounded-full bg-lime-400 px-1.5 text-center text-[11px] font-black leading-5 text-leaf-950">{t.unread_admin}</span>}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </aside>
        <section className={cx('min-h-0', !selected && 'hidden lg:block')}>
          {selected ? (
            <Thread key={selected} id={selected} onBack={() => select(null)} onChanged={reload} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Empty dark icon={<LifeBuoy size={26} />} title="בחרו פנייה מהרשימה" text="כאן תוכלו לקרוא את השיחה ולהשיב לעסק או לפונה מהאתר" />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
