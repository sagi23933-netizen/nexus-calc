import type { ComponentProps } from 'react';
import { ChartTooltip } from '../kit';
import { CHART_DARK } from '../../shared/charts';
import { shortDay } from '../../lib/format';

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Fill a per-day series so every day in the window is present (missing days = 0). */
export function fillDays<T extends { day: string }>(rows: T[], days: number, keys: (keyof T)[]): T[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(new Date(Date.now() - i * 86400_000));
    const r = map.get(day);
    if (r) out.push({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k]) || 0])) });
    else out.push({ day, ...Object.fromEntries(keys.map((k) => [k, 0])) } as T);
  }
  return out;
}

export const axisProps = {
  stroke: CHART_DARK.axis,
  tick: { fill: CHART_DARK.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = { stroke: CHART_DARK.grid, vertical: false } as const;

/** RTL wrapper around the kit tooltip (charts themselves render LTR). */
export function RtlTooltip(props: ComponentProps<typeof ChartTooltip>) {
  return (
    <div dir="rtl">
      <ChartTooltip labelFormatter={(l) => (/^\d{4}-\d{2}-\d{2}$/.test(l) ? shortDay(l) : l)} {...props} />
    </div>
  );
}

export const cursorLine = { stroke: 'rgba(198,241,107,.35)', strokeWidth: 1, strokeDasharray: '4 4' };
export const cursorBar = { fill: 'rgba(255,255,255,.04)' };
