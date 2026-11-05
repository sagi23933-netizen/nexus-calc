import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Select, cx } from '../shared/ui';
import { SERIES_DARK } from '../shared/charts';

/**
 * Dark select: `.admin-theme .a-input` uses the `background` shorthand with higher specificity than the
 * bg utilities, so the chevron must be forced with !important utilities.
 */
export const DarkSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function DarkSelect({ className, ...rest }, ref) {
  return <Select ref={ref} dark className={cx('!bg-[length:16px] !bg-[left_12px_center] !bg-no-repeat', className)} {...rest} />;
});

/** Horizontal magnitude bars with direct value labels (single hue — magnitude, not identity). */
export function BarList({ items, color = SERIES_DARK[0], empty = 'אין נתונים בטווח', format, max: maxProp }: {
  items: { label: ReactNode; value: number; key?: string; hint?: ReactNode }[];
  color?: string;
  empty?: string;
  format?: (v: number) => string;
  max?: number;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-500">{empty}</p>;
  const max = maxProp ?? Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={it.key ?? i} className="group" title={`${typeof it.label === 'string' ? it.label : ''} · ${it.value.toLocaleString('he-IL')} (${Math.round((it.value / total) * 100)}%)`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink-200">{it.label}</span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums text-ink-400">
              <b className="font-bold text-white">{format ? format(it.value) : it.value.toLocaleString('he-IL')}</b>
              <span className="w-8 text-left text-[11px]">{Math.round((it.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full transition-[width] duration-700 group-hover:brightness-125" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- dates (Israel time) ----------
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayIL = (d: Date = new Date()) => fmtDay.format(d);
export const daysAgoIL = (n: number) => dayIL(new Date(Date.now() - n * 86400_000));

/** Every YYYY-MM-DD between two days (inclusive). */
export function dayRange(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length < 800) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-ink-200 ring-1 ring-white/10">{children}</kbd>;
}
