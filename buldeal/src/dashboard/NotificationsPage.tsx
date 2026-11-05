import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, CreditCard, Gift, Lock, Megaphone, MessageSquareHeart, MessagesSquare, Rocket, Sparkles, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { Notification } from '../lib/types';
import { dateTime, relative } from '../lib/format';
import { Button, Empty, Skeleton, cx } from '../shared/ui';
import { PageHeader } from './kit';

const ICON: Record<string, { icon: ReactNode; cls: string }> = {
  welcome: { icon: <Sparkles size={18} />, cls: 'bg-lime-100 text-lime-700' },
  feedback: { icon: <MessageSquareHeart size={18} />, cls: 'bg-pink-100 text-pink-700' },
  deal: { icon: <Rocket size={18} />, cls: 'bg-lime-100 text-lime-700' },
  billing: { icon: <CreditCard size={18} />, cls: 'bg-sky-100 text-sky-700' },
  trial: { icon: <Timer size={18} />, cls: 'bg-amber-100 text-amber-700' },
  blocked: { icon: <Lock size={18} />, cls: 'bg-red-100 text-red-700' },
  tokens: { icon: <Gift size={18} />, cls: 'bg-amber-100 text-amber-700' },
  ticket: { icon: <MessagesSquare size={18} />, cls: 'bg-violet-100 text-violet-700' },
  admin: { icon: <Megaphone size={18} />, cls: 'bg-leaf-100 text-leaf-700' },
};

export default function NotificationsPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { data, loading, reload } = useApi<{ items: Notification[]; unread: number }>('/business/notifications');

  const readAll = async () => {
    await api.post('/business/notifications/read', {});
    reload();
    refresh();
  };

  const open = async (n: Notification) => {
    if (!n.read_at) {
      await api.post('/business/notifications/read', { ids: [n.id] }).catch(() => {});
      refresh();
    }
    if (n.link) navigate(n.link);
    else reload();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="התראות"
        subtitle={data ? (data.unread ? `${data.unread} התראות שלא נקראו` : 'הכל נקרא ✓') : undefined}
        icon={<Bell size={22} />}
        actions={
          data?.unread ? (
            <Button variant="outline" onClick={readAll} icon={<CheckCheck size={17} />}>
              סימון הכל כנקרא
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="card-3d">
          <Empty icon={<Bell size={28} />} title="אין התראות" text="כאן יופיעו עדכונים על דילים, תשלומים ותקופת הניסיון." />
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((n, i) => {
            const meta = ICON[n.type] ?? { icon: <Bell size={18} />, cls: 'bg-ink-100 text-ink-600' };
            return (
              <motion.li key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
                <button
                  onClick={() => open(n)}
                  className={cx(
                    'flex w-full items-start gap-4 rounded-3xl p-4 text-right transition hover:-translate-y-0.5',
                    n.read_at ? 'bg-white/70 ring-1 ring-ink-100 hover:shadow-soft' : 'card-3d ring-1 ring-lime-200',
                  )}
                >
                  <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', meta.cls)}>{meta.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className={cx('text-[15px]', n.read_at ? 'font-semibold text-ink-700' : 'font-bold text-ink-900')}>{n.title}</span>
                      {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-lime-500" />}
                    </span>
                    {n.body && <span className="mt-1 block whitespace-pre-line text-sm text-ink-500">{n.body}</span>}
                    <span className="mt-1.5 block text-xs text-ink-400" title={dateTime(n.created_at)}>
                      {relative(n.created_at)}
                    </span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
