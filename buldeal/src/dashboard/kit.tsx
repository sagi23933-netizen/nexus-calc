import { createContext, useContext, type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Tilt, cx } from '../shared/ui';
import { CHART_LIGHT } from '../shared/charts';
import { useApi } from '../lib/hooks';
import type { Bootstrap } from '../lib/types';

/** Shared building blocks for the business dashboard (light, elegant, 3D). */

export function PageHeader({ title, subtitle, icon, actions }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-leaf-950 shadow-3d" style={{ background: 'linear-gradient(160deg,#d6ee9c,#8cc10a 60%,#6f9e0b)' }}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className, bodyClass, padded = true, icon }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; padded?: boolean; icon?: ReactNode;
}) {
  return (
    <section className={cx('card-3d overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-100 text-lime-700">{icon}</span>}
            <div>
              {title && <h2 className="font-bold text-ink-900">{title}</h2>}
              {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'p-5', bodyClass)}>{children}</div>
    </section>
  );
}

const TONES = {
  lime: { icon: 'from-lime-200 via-lime-400 to-lime-600 text-leaf-950', glow: 'rgba(140,193,10,.22)' },
  leaf: { icon: 'from-leaf-400 via-leaf-600 to-leaf-800 text-white', glow: 'rgba(30,92,46,.18)' },
  sky: { icon: 'from-sky-200 via-sky-400 to-sky-600 text-sky-950', glow: 'rgba(56,150,230,.18)' },
  wood: { icon: 'from-wood-200 via-wood-400 to-wood-600 text-white', glow: 'rgba(168,89,42,.2)' },
  amber: { icon: 'from-amber-100 via-amber-300 to-amber-500 text-amber-950', glow: 'rgba(240,170,20,.2)' },
};

export function StatTile({ label, value, icon, tone = 'lime', hint, delta }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: keyof typeof TONES; hint?: ReactNode; delta?: number | null }) {
  const t = TONES[tone];
  return (
    <Tilt max={8} scale={1.02} className="h-full" style={{ borderRadius: 24 }}>
      <div className="card-3d relative h-full overflow-hidden p-4 sm:p-5" style={{ transformStyle: 'preserve-3d' }}>
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ background: t.glow }} />
        <div className="relative flex items-start justify-between gap-3" style={{ transform: 'translateZ(30px)' }}>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink-500">{label}</div>
            <div className="mt-1.5 truncate text-[26px] font-black leading-none tracking-tight text-ink-900 tabular-nums sm:text-[30px]">{value}</div>
            {(hint || delta != null) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                {delta != null && (
                  <span className={cx('inline-flex items-center gap-0.5 font-bold', delta >= 0 ? 'text-lime-700' : 'text-red-600')}>
                    {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {Math.abs(Math.round(delta))}%
                  </span>
                )}
                {hint}
              </div>
            )}
          </div>
          {icon && <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-3d', t.icon)}>{icon}</div>}
        </div>
      </div>
    </Tilt>
  );
}

interface TooltipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Light tooltip for recharts. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string | number; labelFormatter?: (l: string) => string; valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-xl px-3 py-2.5 text-xs shadow-lift" style={{ background: CHART_LIGHT.tooltipBg, border: `1px solid ${CHART_LIGHT.tooltipBorder}` }}>
      <div className="mb-1.5 font-bold text-ink-900">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5 text-ink-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums text-ink-900">{valueFormatter ? valueFormatter(Number(p.value)) : Number(p.value).toLocaleString('he-IL')}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <b className="text-ink-900">{i.value}</b>}
        </span>
      ))}
    </div>
  );
}

// ---------- bootstrap (categories, cities, public settings) shared across dashboard pages ----------
const BootCtx = createContext<Bootstrap | null>(null);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { data } = useApi<Bootstrap>('/public/bootstrap');
  return <BootCtx.Provider value={data}>{children}</BootCtx.Provider>;
}

export function useBootstrap() {
  return useContext(BootCtx);
}

export const DEAL_DEFAULTS = { maxHours: 48, minHours: 1, defaultHours: 24, maxDiscount: 95, freeRedesigns: 2, requireImage: false };

/** Overlay shown over an all-zero chart so empty periods read as "no data yet" rather than a broken chart. */
export function NoDataOverlay({ show, text = 'עדיין אין נתונים בתקופה הזו' }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink-500 shadow-soft ring-1 ring-ink-100">{text}</span>
    </div>
  );
}
