import { useNow } from '../lib/hooks';
import { timeLeft } from '../lib/format';
import { cx } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Live "time left" readout. */
export function Countdown({ to, className, compact }: { to: string; className?: string; compact?: boolean }) {
  const now = useNow(1000);
  const t = timeLeft(to, now);
  if (t.ms <= 0) return <span className={className}>הסתיים</span>;
  const hours = t.d * 24 + t.h;
  return (
    <span className={cx('tabular-nums', className)} dir="ltr">
      {compact && hours === 0 ? `${pad(t.m)}:${pad(t.s)}` : `${pad(hours)}:${pad(t.m)}:${pad(t.s)}`}
    </span>
  );
}

/** Remaining-time progress (1 → 0) for a deal window. */
export function useDealProgress(startsAt: string, expiresAt: string) {
  const now = useNow(5000);
  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();
  const total = Math.max(1, end - start);
  const remaining = Math.min(1, Math.max(0, (end - now) / total));
  const urgent = end - now < 2 * 3600_000;
  return { remaining, urgent, started: now >= start };
}
