import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Mail, Megaphone, Send, Users } from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, relative } from '../lib/format';
import type { Notification } from '../lib/types';
import { Button, Confirm, Empty, Field, Input, Skeleton, Switch, Textarea, Tilt, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, Panel } from './kit';

const AUDIENCES = [
  { value: 'all', label: 'כל העסקים' },
  { value: 'trial', label: 'בתקופת ניסיון' },
  { value: 'active', label: 'מנויים פעילים' },
  { value: 'past_due', label: 'ממתינים לתשלום' },
  { value: 'blocked', label: 'חסומים' },
] as const;

const TYPE_STYLE: Record<string, string> = {
  signup: 'bg-lime-400/15 text-lime-300',
  billing: 'bg-amber-400/15 text-amber-300',
  ticket: 'bg-sky-400/15 text-sky-300',
  trial: 'bg-violet-400/15 text-violet-300',
};
const TYPE_LABEL: Record<string, string> = { signup: 'הרשמה', billing: 'תשלום', ticket: 'פנייה', trial: 'ניסיון', info: 'מידע' };

export default function NotificationsPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ items: Notification[]; unread: number }>('/admin/notifications');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['value']>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const { data: count } = useApi<{ total: number }>(`/admin/businesses${qs({ status: audience === 'all' ? '' : audience, size: 1 })}`);

  const readAll = async () => {
    await api.post('/admin/notifications/read');
    toast('כל ההתראות סומנו כנקראו');
    reload();
  };

  const send = async () => {
    setSending(true);
    try {
      const r = await api.post<{ sent: number }>('/admin/broadcast', { audience, title, body, email });
      toast(`ההודעה נשלחה ל-${r.sent} עסקים`);
      setTitle('');
      setBody('');
      setConfirm(false);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const items = (data?.items ?? []).filter((n) => filter === 'all' || !n.read_at);

  return (
    <>
      <PageHeader title="התראות ושידור הודעות" subtitle="התראות המערכת למנהלים, ושליחת הודעות לכל העסקים או לקבוצה מתוכם" icon={<Megaphone size={22} />} />

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="התראות מערכת"
          subtitle={data ? `${data.unread} שלא נקראו` : undefined}
          padded={false}
          actions={
            <>
              <div className="flex rounded-xl bg-black/30 p-1 text-xs ring-1 ring-white/5">
                {(['all', 'unread'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cx('rounded-lg px-3 py-1.5 font-semibold transition', filter === f ? 'bg-lime-400 text-leaf-950' : 'text-ink-300')}>
                    {f === 'all' ? 'הכל' : 'לא נקראו'}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="a-ghost" icon={<CheckCheck size={15} />} onClick={readAll}>
                סימון הכל
              </Button>
            </>
          }
        >
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty dark icon={<Bell size={24} />} title="אין התראות" />
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={cx('flex items-start gap-3 border-b border-white/5 px-5 py-4', !n.read_at && 'bg-lime-400/[0.03]')}>
                  <span className={cx('mt-0.5 rounded-lg px-2 py-0.5 text-[11px] font-bold', TYPE_STYLE[n.type] || 'bg-white/5 text-ink-300')}>{TYPE_LABEL[n.type] || n.type}</span>
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link to={n.link} className="font-semibold text-white hover:text-lime-300">
                        {n.title}
                      </Link>
                    ) : (
                      <div className="font-semibold text-white">{n.title}</div>
                    )}
                    {n.body && <p className="mt-0.5 text-sm text-ink-400">{n.body}</p>}
                    <div className="mt-1 text-[11px] text-ink-500" title={dateTime(n.created_at)}>
                      {relative(n.created_at)}
                    </div>
                  </div>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lime-400" />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6 xl:col-span-2">
          <Panel title="שידור הודעה לעסקים" subtitle="תופיע בהתראות בממשק העסק (ואופציונלית במייל)" actions={<Send size={18} className="text-ink-400" />}>
            <div className="space-y-4">
              <div>
                <div className="a-label">קהל יעד</div>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAudience(a.value)}
                      className={cx('chip px-3 py-1.5 ring-1 transition', audience === a.value ? 'bg-lime-400 text-leaf-950 ring-lime-300' : 'bg-white/5 text-ink-200 ring-white/10 hover:bg-white/10')}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                  <Users size={13} /> {count ? `${count.total} עסקים יקבלו את ההודעה` : '…'}
                </div>
              </div>
              <Field label="כותרת" dark>
                <Input dark value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: חג שמח! טוקן מתנה מחכה לכם" />
              </Field>
              <Field label="תוכן ההודעה" dark>
                <Textarea dark rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <Switch dark checked={email} onChange={setEmail} label="שליחה גם במייל" description="דורש הגדרת SMTP בהגדרות המערכת" />
              <Button className="w-full" icon={<Megaphone size={16} />} disabled={!title.trim()} onClick={() => setConfirm(true)}>
                שידור ההודעה
              </Button>
            </div>
          </Panel>

          <div>
            <div className="mb-2 px-1 text-xs font-semibold text-ink-400">תצוגה מקדימה — כך העסק יראה את ההודעה</div>
            <Tilt max={6} style={{ borderRadius: 24 }}>
              <div className="rounded-3xl bg-white p-5 text-ink-900 shadow-deep">
                <div className="flex items-start gap-3">
                  <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-lime-700">הודעה מצוות בולדיל</span>
                      <span className="text-[11px] text-ink-400">עכשיו</span>
                    </div>
                    <div className="mt-1 font-bold">{title || 'כותרת ההודעה'}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{body || 'תוכן ההודעה יופיע כאן…'}</p>
                    {email && (
                      <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">
                        <Mail size={11} /> נשלח גם במייל
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Tilt>
          </div>
        </div>
      </div>

      <Confirm
        dark
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={send}
        loading={sending}
        title="שידור הודעה"
        confirmText="שידור"
        body={
          <>
            ההודעה <b className="text-white">“{title}”</b> תישלח ל-{count?.total ?? '…'} עסקים ({AUDIENCES.find((a) => a.value === audience)?.label})
            {email ? ' וגם במייל' : ''}. להמשיך?
          </>
        }
      />
    </>
  );
}
