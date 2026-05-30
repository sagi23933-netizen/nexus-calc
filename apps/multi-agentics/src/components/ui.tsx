/** Small shared presentational primitives. */

import type { HTMLAttributes, ReactNode } from 'react'

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return <span className={`dot ${pulse ? 'animate-pulse-soft' : ''}`} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
}

export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="pill" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
      <span className="dot" style={{ background: color }} />
      {children}
    </span>
  )
}

export function Card({
  children,
  className = '',
  hover = false,
  ...rest
}: { children: ReactNode; className?: string; hover?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Stat({ label, value, accent = 'var(--brand-soft)', sub }: { label: string; value: ReactNode; accent?: string; sub?: ReactNode }) {
  return (
    <Card hover className="flex flex-col gap-2">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: accent }}>
        {value}
      </span>
      {sub && <span className="text-xs text-[var(--text-muted)]">{sub}</span>}
    </Card>
  )
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ProgressBar({ value, color = 'var(--brand)' }: { value: number; color?: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <Card className="flex flex-col items-center justify-center text-center py-12 gap-2">
      {icon && <div className="text-[var(--text-dim)] mb-1">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-[var(--text-muted)] max-w-sm">{hint}</p>}
    </Card>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-transparent"
      style={{ width: size, height: size, borderTopColor: 'var(--brand-soft)', borderRightColor: 'var(--brand-soft)' }}
    />
  )
}

/** Tiny inline SVG sparkline. */
export function Sparkline({ points, color = 'var(--brand-soft)', width = 120, height = 32 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(height - ((p - min) / range) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
