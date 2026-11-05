import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Minus, Navigation, Phone, Plus, ThumbsDown, ThumbsUp, PartyPopper } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { HistoryItem } from '../lib/types';
import { dateTime, money } from '../lib/format';
import { Button, Modal, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';

const SNOOZE_KEY = 'bd_feedback_snooze';

function snoozed() {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === '1';
  } catch {
    return false;
  }
}
function snooze() {
  try {
    sessionStorage.setItem(SNOOZE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** "Did the post help and did people come?" — asked after every deal ends. */
export function FeedbackModal({ item, onClose, onDone, onLater }: { item: HistoryItem | null; onClose: () => void; onDone: () => void; onLater?: () => void }) {
  const toast = useToast();
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const [customers, setCustomers] = useState(5);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    setAnswer(null);
    setCustomers(5);
    setNote('');
    setThanks(false);
  }, [item?.id]);

  if (!item) return null;

  const submit = async (value: 'yes' | 'no') => {
    setSaving(true);
    try {
      await api.post(`/business/history/${item.id}/feedback`, { helped: value, customers: value === 'yes' ? customers : undefined, note });
      setThanks(true);
      setTimeout(() => {
        onDone();
      }, 1400);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!item} onClose={onClose} size="md" hideClose={thanks}>
      <AnimatePresence mode="wait">
        {thanks ? (
          <motion.div key="thanks" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-lime-100 text-lime-600 shadow-glow">
              <PartyPopper size={40} />
            </div>
            <h3 className="text-2xl font-black">תודה על המשוב!</h3>
            <p className="mt-1 text-ink-500">זה עוזר לנו לשפר את החשיפה של הדילים שלך.</p>
          </motion.div>
        ) : (
          <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 animate-floaty items-center justify-center rounded-3xl text-3xl shadow-3d" style={{ background: 'linear-gradient(160deg,#d6ee9c,#8cc10a)' }}>
                🎯
              </div>
              <p className="text-sm font-semibold text-lime-700">הדיל הסתיים · {dateTime(item.ended_at)}</p>
              <h2 className="mt-1 text-balance text-xl font-black text-ink-900">{item.title}</h2>
              <p className="mt-0.5 text-sm text-ink-500">
                {money(item.final_price)} במקום {money(item.original_price)} · {Math.round(item.discount_percent)}% הנחה
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: <Eye size={16} />, label: 'צפיות', value: item.views },
                { icon: <Phone size={16} />, label: 'חיוגים', value: item.clicks_phone },
                { icon: <Navigation size={16} />, label: 'ניווטים', value: item.clicks_waze },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-ink-50 p-3 text-center ring-1 ring-ink-100">
                  <div className="flex items-center justify-center gap-1 text-xs text-ink-500">
                    {s.icon}
                    {s.label}
                  </div>
                  <div className="mt-1 text-2xl font-black tabular-nums text-ink-900">{s.value}</div>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-center text-lg font-black text-ink-900">האם הפרסום עזר והגיעו אנשים?</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['yes', 'no'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAnswer(v)}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-3xl border-2 p-4 text-lg font-black transition-all',
                    answer === v
                      ? v === 'yes'
                        ? 'border-lime-500 bg-lime-50 text-lime-800 shadow-glow'
                        : 'border-wood-400 bg-wood-50 text-wood-700 shadow-lift'
                      : 'border-ink-100 bg-white text-ink-700 shadow-soft hover:-translate-y-1 hover:border-ink-200',
                  )}
                >
                  {v === 'yes' ? <ThumbsUp size={30} /> : <ThumbsDown size={30} />}
                  {v === 'yes' ? 'כן, הגיעו!' : 'לא ממש'}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {answer && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-4 pt-5">
                    {answer === 'yes' && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-lime-50 p-3 ring-1 ring-lime-200">
                        <span className="text-sm font-semibold text-ink-700">כמה לקוחות הגיעו בערך?</span>
                        <div className="flex items-center gap-2">
                          <button className="btn-icon h-9 w-9 bg-white shadow-sm" onClick={() => setCustomers((c) => Math.max(0, c - 1))} aria-label="פחות">
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={customers}
                            onChange={(e) => setCustomers(Math.max(0, Number(e.target.value) || 0))}
                            className="w-16 rounded-xl border border-lime-200 bg-white py-1.5 text-center text-lg font-black outline-none focus:border-lime-500"
                          />
                          <button className="btn-icon h-9 w-9 bg-white shadow-sm" onClick={() => setCustomers((c) => c + 1)} aria-label="יותר">
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    <Textarea
                      placeholder={answer === 'yes' ? 'רוצים לשתף משהו? (לא חובה)' : 'מה היה אפשר לשפר? (לא חובה)'}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={500}
                      className="!min-h-[72px]"
                    />
                    <Button className="w-full" size="lg" loading={saving} onClick={() => submit(answer)}>
                      שליחת משוב
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {onLater && (
              <button onClick={onLater} className="mx-auto mt-4 block text-sm font-medium text-ink-400 hover:text-ink-700">
                אזכיר לי אחר כך
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

/** Auto-prompts for pending feedback and handles `?feedback=<id>` deep links. Mounted once in the layout. */
export function FeedbackPrompt() {
  const { me, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [item, setItem] = useState<HistoryItem | null>(null);
  const pending = me.business?.counts.pending_feedback ?? 0;
  const blocked = me.business && ['blocked', 'suspended'].includes(me.business.status);

  const loadPending = useCallback(async () => {
    const d = await api.get<{ items: HistoryItem[] }>('/business/history?filter=pending&size=50');
    return d.items;
  }, []);

  // deep link
  useEffect(() => {
    const fid = params.get('feedback');
    if (!fid) return;
    params.delete('feedback');
    setParams(params, { replace: true });
    (async () => {
      let list = await loadPending().catch(() => [] as HistoryItem[]);
      let found = list.find((h) => h.id === Number(fid));
      if (!found) {
        list = (await api.get<{ items: HistoryItem[] }>('/business/history?size=200').catch(() => ({ items: [] }))).items;
        found = list.find((h) => h.id === Number(fid));
      }
      if (found) setItem(found);
    })();
  }, [params, setParams, loadPending]);

  // automatic prompt
  useEffect(() => {
    if (!pending || blocked || item || snoozed()) return;
    const t = setTimeout(() => {
      loadPending()
        .then((list) => {
          if (list.length && !snoozed()) setItem(list[list.length - 1]);
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [pending, blocked, item, loadPending]);

  return (
    <FeedbackModal
      item={item}
      onClose={() => {
        snooze();
        setItem(null);
      }}
      onLater={() => {
        snooze();
        setItem(null);
      }}
      onDone={() => {
        setItem(null);
        refresh();
      }}
    />
  );
}
