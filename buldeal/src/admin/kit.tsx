import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Tilt, cx } from '../shared/ui';
import { CHART_DARK } from '../shared/charts';

/** Shared building blocks for every super-admin screen (dark, elegant, 3D). */

export function PageHeader({ title, subtitle, icon, actions }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-leaf-950 shadow-3d" style={{ background: 'linear-gradient(160deg,#c6f16b,#8cc10a 60%,#6f9e0b)' }}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className, bodyClass, padded = true }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; padded?: boolean;
}) {
  return (
    <section className={cx('a-card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            {title && <h2 className="font-bold text-white">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'p-5', bodyClass)}>{children}</div>
    </section>
  );
}

const TONES = {
  lime: { icon: 'from-lime-300 to-lime-600 text-leaf-950', glow: 'rgba(140,193,10,.25)' },
  sky: { icon: 'from-sky-300 to-sky-600 text-sky-950', glow: 'rgba(56,150,230,.22)' },
  amber: { icon: 'from-amber-200 to-amber-500 text-amber-950', glow: 'rgba(240,170,20,.22)' },
  wood: { icon: 'from-wood-300 to-wood-600 text-white', glow: 'rgba(168,89,42,.25)' },
  violet: { icon: 'from-violet-300 to-violet-600 text-violet-950', glow: 'rgba(130,110,230,.22)' },
  red: { icon: 'from-red-300 to-red-600 text-red-950', glow: 'rgba(210,60,60,.22)' },
};

export function StatTile({ label, value, icon, tone = 'lime', hint, delta }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: keyof typeof TONES; hint?: ReactNode; delta?: number | null }) {
  const t = TONES[tone];
  return (
    <Tilt max={8} scale={1.02} className="h-full" style={{ borderRadius: 24 }}>
      <div className="a-card relative h-full overflow-hidden p-5" style={{ transformStyle: 'preserve-3d' }}>
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ background: t.glow }} />
        <div className="relative flex items-start justify-between gap-3" style={{ transform: 'translateZ(30px)' }}>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink-400">{label}</div>
            <div className="mt-1.5 truncate text-[28px] font-black leading-none tracking-tight text-white tabular-nums">{value}</div>
            {(hint || delta != null) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
                {delta != null && (
                  <span className={cx('inline-flex items-center gap-0.5 font-bold', delta >= 0 ? 'text-lime-400' : 'text-red-400')}>
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

/** Dark tooltip for recharts (pass as <Tooltip content={<ChartTooltip />} />). */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string | number; labelFormatter?: (l: string) => string; valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-xl px-3 py-2.5 text-xs shadow-deep" style={{ background: CHART_DARK.tooltipBg, border: `1px solid ${CHART_DARK.tooltipBorder}` }}>
      <div className="mb-1.5 font-bold text-white">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5 text-ink-200">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums text-white">{valueFormatter ? valueFormatter(Number(p.value)) : Number(p.value).toLocaleString('he-IL')}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-300">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <b className="text-white">{i.value}</b>}
        </span>
      ))}
    </div>
  );
}
