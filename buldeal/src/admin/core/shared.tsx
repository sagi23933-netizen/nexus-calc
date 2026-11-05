import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { api } from '../../lib/api';
import type { Category, City, Package } from '../../lib/types';
import { Select, cx } from '../../shared/ui';

/** Admin-wide lookups (categories, cities, subscription packages), cached per session. */
type Lookups = { categories: Category[]; cities: City[]; packages: Package[] };
let cache: Lookups | null = null;
let inflight: Promise<Lookups> | null = null;

export function invalidateLookups() {
  cache = null;
}

export function useLookups() {
  const [data, setData] = useState<Lookups | null>(cache);
  useEffect(() => {
    if (cache) return;
    let p = inflight;
    if (!p) {
      p = inflight = Promise.all([
        api.get<{ items: Category[] }>('/admin/categories'),
        api.get<{ items: City[] }>('/admin/cities'),
        api.get<{ packages: Package[] }>('/admin/packages'),
      ])
        .then(([c, ci, pk]) => {
          cache = { categories: c.items, cities: ci.items, packages: pk.packages };
          return cache;
        })
        .finally(() => {
          inflight = null;
        });
    }
    p.then((d) => setData(d)).catch(() => {});
  }, []);
  return data ?? { categories: [], cities: [], packages: [] };
}

export function KeyVal({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/5', className)}>
      <div className="text-[11px] font-medium text-ink-400">{label}</div>
      <div className="mt-0.5 truncate font-bold text-white">{children}</div>
    </div>
  );
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-x-auto scrollbar-thin', className)}>{children}</div>;
}

export function SourceBadge({ source }: { source: 'site' | 'admin' }) {
  return (
    <span className={cx('chip ring-1', source === 'admin' ? 'bg-wood-400/10 text-wood-200 ring-wood-300/20' : 'bg-white/5 text-ink-300 ring-white/10')}>
      {source === 'admin' ? 'נפתח ע״י מנהל' : 'הרשמה באתר'}
    </span>
  );
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text).catch(() => {});
}

export const FEEDBACK_LABEL: Record<string, string> = { yes: 'עזר', no: 'לא עזר' };

export function FeedbackChip({ value, customers }: { value: 'yes' | 'no' | null; customers?: number | null }) {
  if (!value) return <span className="chip bg-white/5 text-ink-400 ring-1 ring-white/10">ללא תשובה</span>;
  return (
    <span className={cx('chip ring-1', value === 'yes' ? 'bg-lime-400/10 text-lime-300 ring-lime-400/20' : 'bg-red-400/10 text-red-300 ring-red-400/20')}>
      {value === 'yes' ? '👍 עזר' : '👎 לא עזר'}
      {value === 'yes' && customers ? ` · ${customers} לקוחות` : ''}
    </span>
  );
}

/**
 * Dark select. `.admin-theme .a-input` uses the `background` shorthand (higher specificity), which resets the
 * chevron's repeat/size/position from the shared Select — force them back here.
 */
export function DSelect({ className, ...props }: ComponentProps<typeof Select>) {
  return <Select dark {...props} className={cx('!bg-[length:16px] !bg-[left_12px_center] !bg-no-repeat !pl-9', className)} />;
}
