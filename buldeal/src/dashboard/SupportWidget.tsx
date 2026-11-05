import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Headphones, MessageCirclePlus, Send, X, MessagesSquare, CheckCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Ticket, TicketMessage } from '../lib/types';
import { relative, time } from '../lib/format';
import { useAuth } from '../lib/auth';
import { Button, Input, Spinner, StatusBadge, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'thread'; id: number };

/** Floating "contact us" chat window for business owners (support tickets). */
export function SupportWidget() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [thread, setThread] = useState<{ ticket: Ticket; messages: TicketMessage[] } | null>(null);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const unread = me.business?.counts.unread_tickets ?? 0;

  const loadList = useCallback(() => {
    api.get<{ items: Ticket[] }>('/business/tickets').then((d) => setTickets(d.items)).catch(() => setTickets([]));
  }, []);

  const loadThread = useCallback(
    (id: number) => {
      api
        .get<{ ticket: Ticket; messages: TicketMessage[] }>(`/business/tickets/${id}`)
        .then((d) => {
          setThread(d);
          refresh();
        })
        .catch((e) => toast(errMsg(e), 'error'));
    },
    [refresh, toast],
  );

  // deep link ?support=<id>
  useEffect(() => {
    const sid = params.get('support');
    if (sid) {
      setOpen(true);
      setView({ kind: 'thread', id: Number(sid) });
      params.delete('support');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (!open) return;
    if (view.kind === 'list') loadList();
    if (view.kind === 'thread') {
      setThread(null);
      loadThread(view.id);
      const t = setInterval(() => loadThread(view.id), 12000);
      return () => clearInterval(t);
    }
  }, [open, view, loadList, loadThread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      if (view.kind === 'new') {
        const res = await api.post<{ id: number }>('/business/tickets', { subject: subject.trim() || 'פנייה מהממשק', message: text.trim() });
        setText('');
        setSubject('');
        setView({ kind: 'thread', id: res.id });
        toast('הפנייה נשלחה — נחזור אליך בהקדם');
      } else if (view.kind === 'thread') {
        await api.post(`/business/tickets/${view.id}/messages`, { message: text.trim() });
        setText('');
        loadThread(view.id);
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const quick = ['איך מפרסמים דיל?', 'בעיה בתשלום', 'רוצה לשדרג חבילה', 'הדיל לא מופיע באתר'];

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06, rotate: -4 }}
        whileTap={{ scale: 0.95 }}
        aria-label="צור קשר"
        className="fixed bottom-[92px] left-3 z-[70] flex h-12 w-12 items-center justify-center rounded-2xl text-leaf-950 lg:bottom-6 lg:left-6 lg:h-16 lg:w-16"
        style={{
          background: 'linear-gradient(160deg,#c6f16b,#8cc10a 55%,#6f9e0b)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -4px 0 rgba(40,70,0,.35), 0 18px 36px -12px rgba(60,110,0,.75)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={26} />
            </motion.span>
          ) : (
            <motion.span key="h" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Headphones size={26} />
            </motion.span>
          )}
        </AnimatePresence>
        {unread > 0 && !open && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-white">{unread}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{ transformPerspective: 1200, transformOrigin: 'bottom left' }}
            className="fixed bottom-[150px] left-3 right-3 z-[70] flex h-[min(560px,calc(100vh-200px))] flex-col overflow-hidden rounded-[28px] bg-white shadow-deep ring-1 ring-ink-100 sm:right-auto sm:w-[380px] lg:bottom-[104px] lg:left-6"
          >
            <div className="relative overflow-hidden px-5 pb-5 pt-4 text-white" style={{ background: 'linear-gradient(135deg,#123a1f,#1e5c2e 50%,#3f8f2a)' }}>
              <div className="pointer-events-none absolute -left-8 -top-12 h-36 w-36 rounded-full bg-lime-400/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                {view.kind !== 'list' && (
                  <button onClick={() => setView({ kind: 'list' })} className="btn-icon h-9 w-9 text-white hover:bg-white/10" aria-label="חזרה">
                    <ArrowRight size={18} />
                  </button>
                )}
                <div className="flex -space-x-2 space-x-reverse">
                  {['🙋‍♀️', '🧑‍💻'].map((e) => (
                    <span key={e} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg ring-2 ring-leaf-800">
                      {e}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{view.kind === 'thread' && thread ? thread.ticket.subject : 'צוות בולדיל כאן בשבילך'}</div>
                  <div className="flex items-center gap-1.5 text-xs text-lime-200">
                    <span className="h-2 w-2 rounded-full bg-lime-400" /> עונים בדרך כלל תוך שעה
                  </div>
                </div>
              </div>
            </div>

            {view.kind === 'list' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {!tickets ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <MessagesSquare className="mx-auto mb-3 text-lime-600" size={36} />
                      <p className="font-bold text-ink-800">אין פניות עדיין</p>
                      <p className="mt-1 text-sm text-ink-500">יש שאלה? אנחנו כאן — כתבו לנו ונחזור אליכם.</p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {tickets.map((t) => (
                        <li key={t.id}>
                          <button onClick={() => setView({ kind: 'thread', id: t.id })} className="flex w-full items-start gap-3 rounded-2xl p-3 text-right transition hover:bg-lime-50">
                            <span className={cx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', t.unread_business ? 'bg-lime-500' : 'bg-transparent')} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-ink-900">{t.subject}</span>
                                <span className="shrink-0 text-[11px] text-ink-400">{relative(t.last_message_at)}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-sm text-ink-500">{t.last_message}</span>
                              <span className="mt-1.5 inline-block">
                                <StatusBadge status={t.status} />
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-ink-100 p-3">
                  <Button className="w-full" icon={<MessageCirclePlus size={18} />} onClick={() => setView({ kind: 'new' })}>
                    פנייה חדשה
                  </Button>
                </div>
              </div>
            )}

            {view.kind === 'new' && (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((q) => (
                    <button key={q} onClick={() => setSubject(q)} className={cx('chip ring-1 transition', subject === q ? 'bg-lime-100 text-lime-800 ring-lime-300' : 'bg-ink-50 text-ink-600 ring-ink-200 hover:bg-lime-50')}>
                      {q}
                    </button>
                  ))}
                </div>
                <Input placeholder="נושא הפנייה" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
                <Textarea placeholder="ספרו לנו במה אפשר לעזור…" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[160px] flex-1" maxLength={3000} />
                <Button onClick={send} loading={sending} disabled={!text.trim()} icon={<Send size={16} />}>
                  שליחה
                </Button>
              </div>
            )}

            {view.kind === 'thread' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(30,92,46,.07)_1px,transparent_0)] bg-[length:18px_18px] p-4">
                  {!thread ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  ) : (
                    thread.messages.map((m) => {
                      const mine = m.sender !== 'admin';
                      return (
                        <div key={m.id} className={cx('flex', mine ? 'justify-start' : 'justify-end')}>
                          <div
                            className={cx(
                              'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                              mine ? 'rounded-tr-md bg-lime-100 text-ink-900' : 'rounded-tl-md bg-white text-ink-800 ring-1 ring-ink-100',
                            )}
                          >
                            {!mine && <div className="mb-0.5 text-[11px] font-bold text-leaf-700">צוות בולדיל</div>}
                            <p className="whitespace-pre-line">{m.body}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-400">
                              {time(m.created_at)}
                              {mine && <CheckCheck size={12} />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottom} />
                </div>
                <div className="flex items-end gap-2 border-t border-ink-100 p-3">
                  <Textarea
                    placeholder="כתבו הודעה…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    className="!min-h-[44px] max-h-32 flex-1 !py-2.5"
                    rows={1}
                  />
                  <Button onClick={send} loading={sending} disabled={!text.trim()} className="h-11 w-11 !px-0" aria-label="שליחה">
                    {!sending && <Send size={18} />}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
