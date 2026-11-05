import { Fragment, useState } from 'react';
import { ChevronDown, ScrollText } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, relative } from '../lib/format';
import { Empty, Pagination, Skeleton, cx } from '../shared/ui';
import { PageHeader, Panel } from './kit';
import { TableWrap } from './core/shared';

interface AuditRow {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string;
  ip: string;
  created_at: string;
  email: string | null;
  name: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  login: 'כניסה למערכת',
  'business.create': 'יצירת עסק',
  'business.update': 'עדכון עסק',
  'business.tokens': 'עדכון טוקנים',
  'business.trial': 'שינוי תקופת ניסיון',
  'business.status': 'שינוי סטטוס',
  'business.reset_password': 'איפוס סיסמה',
  'business.delete': 'מחיקת עסק',
  'deal.remove': 'הסרת דיל',
  'deal.expiry': 'שינוי משך דיל',
  'package.create': 'יצירת חבילה',
  'package.update': 'עדכון חבילה',
  'package.delete': 'מחיקת חבילה',
  'ai.create': 'הוספת מודל AI',
  'ai.update': 'עדכון מודל AI',
  'ai.activate': 'הפעלת מודל AI',
  'ai.delete': 'מחיקת מודל AI',
  'payment.refund': 'זיכוי תשלום',
  broadcast: 'שידור הודעה',
  'settings.update': 'עדכון הגדרות',
  'admin.create': 'הוספת מנהל',
  'admin.update': 'עדכון מנהל',
  'admin.delete': 'מחיקת מנהל',
  export: 'ייצוא נתונים',
  'system.jobs': 'הרצת משימות',
};

function actionTone(a: string) {
  if (/delete|remove|refund/.test(a)) return 'bg-red-400/10 text-red-300 ring-red-400/20';
  if (/create|activate/.test(a)) return 'bg-lime-400/10 text-lime-300 ring-lime-400/20';
  if (a === 'login') return 'bg-sky-400/10 text-sky-300 ring-sky-400/20';
  return 'bg-white/5 text-ink-200 ring-white/10';
}

function pretty(details: string) {
  if (!details) return '';
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading } = useApi<{ items: AuditRow[]; total: number; page: number; size: number }>(`/admin/audit${qs({ page })}`);

  return (
    <>
      <PageHeader title="יומן פעולות" subtitle="תיעוד כל הפעולות הרגישות של מנהלי המערכת" icon={<ScrollText size={22} />} />
      <Panel padded={false}>
        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <Empty dark icon={<ScrollText size={24} />} title="היומן ריק" />
        ) : (
          <>
            <TableWrap>
              <table className="a-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>מועד</th>
                    <th>מנהל</th>
                    <th>פעולה</th>
                    <th>ישות</th>
                    <th>פרטים</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => {
                    const details = pretty(r.details);
                    const expanded = open === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr className={cx(details && 'cursor-pointer')} onClick={() => details && setOpen(expanded ? null : r.id)}>
                          <td className="whitespace-nowrap">
                            <div className="text-ink-200">{dateTime(r.created_at)}</div>
                            <div className="text-[11px] text-ink-500">{relative(r.created_at)}</div>
                          </td>
                          <td>
                            <div className="text-ink-100">{r.name || 'מערכת'}</div>
                            {r.email && (
                              <div className="text-xs text-ink-500" dir="ltr" style={{ textAlign: 'right' }}>
                                {r.email}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={cx('chip ring-1', actionTone(r.action))}>{ACTION_LABEL[r.action] || r.action}</span>
                          </td>
                          <td className="text-ink-300">
                            {r.entity || '—'}
                            {r.entity_id ? <span className="text-ink-500"> #{r.entity_id}</span> : null}
                          </td>
                          <td className="max-w-[320px]">
                            {details ? (
                              <span className="flex items-center gap-1 text-xs text-ink-400">
                                <span className="truncate font-mono" dir="ltr">
                                  {r.details.slice(0, 60)}
                                </span>
                                <ChevronDown size={14} className={cx('shrink-0 transition', expanded && 'rotate-180')} />
                              </span>
                            ) : (
                              <span className="text-ink-600">—</span>
                            )}
                          </td>
                          <td className="font-mono text-xs text-ink-500" dir="ltr">
                            {r.ip || '—'}
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="!pt-0">
                              <pre className="max-h-64 overflow-auto rounded-xl bg-black/40 p-4 text-left font-mono text-xs leading-relaxed text-lime-200 ring-1 ring-white/5" dir="ltr">
                                {details}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <div className="border-t border-white/5 px-3">
              <Pagination dark page={page} total={data.total} size={data.size} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
