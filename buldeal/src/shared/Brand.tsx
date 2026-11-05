import { Link } from 'react-router-dom';
import { cx } from './ui';

export function BrandLogo({ className, to = '/', height = 44 }: { className?: string; to?: string | null; height?: number }) {
  const img = <img src="/logo.webp" alt="בולדיל" style={{ height }} className={cx('w-auto drop-shadow-[0_6px_10px_rgba(20,50,10,.25)]', className)} />;
  return to ? (
    <Link to={to} aria-label="בולדיל — לדף הבית" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  ) : (
    img
  );
}

export function BrandIcon({ size = 36, className }: { size?: number; className?: string }) {
  return <img src="/icon-192.png" alt="" width={size} height={size} className={cx('drop-shadow-[0_6px_10px_rgba(20,50,10,.3)]', className)} />;
}
