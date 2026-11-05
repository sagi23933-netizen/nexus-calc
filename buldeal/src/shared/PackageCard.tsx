import type { CSSProperties, PointerEvent as RPointerEvent, ReactNode } from 'react';
import { Check, X, Coins, Rocket } from 'lucide-react';
import type { Package, PackageRow, PackageSticker } from '../lib/types';
import { money, periodLabel } from '../lib/format';
import { DynIcon } from '../lib/icons';
import { Tilt, cx } from './ui';

export const THEME_PRESETS: Record<string, { bg1: string; bg2: string; accent: string; text: string; label: string }> = {
  mint: { bg1: '#ffffff', bg2: '#eef8e4', accent: '#7cc22a', text: '#163b1f', label: 'מנטה' },
  lime: { bg1: '#1e5c2e', bg2: '#3f8f2a', accent: '#c6f16b', text: '#ffffff', label: 'ליים' },
  wood: { bg1: '#3b2414', bg2: '#8a4b2a', accent: '#ffcf66', text: '#fff7e8', label: 'עץ' },
  night: { bg1: '#0f1a14', bg2: '#22382a', accent: '#a3d520', text: '#f1f7ea', label: 'לילה' },
  sunset: { bg1: '#ff7a18', bg2: '#c81d25', accent: '#ffe14d', text: '#ffffff', label: 'שקיעה' },
  royal: { bg1: '#2b1b5a', bg2: '#5b3fd1', accent: '#ffd23f', text: '#ffffff', label: 'מלכותי' },
  ocean: { bg1: '#0b4f6c', bg2: '#20a4c8', accent: '#e8ff5a', text: '#ffffff', label: 'אוקיינוס' },
  pearl: { bg1: '#fdfbf5', bg2: '#f3ece0', accent: '#8c3f18', text: '#3a2410', label: 'פנינה' },
};

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isDarkColor = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) && lum(hex) < 0.3;

/** Sticker shapes ("הכי משתלם", "VIP", …) — rendered as absolutely positioned layers. */
export function StickerView({ s, selected, onPointerDown }: { s: PackageSticker; selected?: boolean; onPointerDown?: (e: RPointerEvent<HTMLDivElement>) => void }) {
  const size = s.size ?? 1;
  const base: CSSProperties = {
    left: `${s.x}%`,
    top: `${s.y}%`,
    transform: `translate(-50%, -50%) rotate(${s.rotate}deg) scale(${size}) translateZ(70px)`,
    color: s.textColor,
  };
  const shadow = 'drop-shadow(0 8px 12px rgba(0,0,0,.35))';
  let inner: ReactNode;
  switch (s.shape) {
    case 'circle':
      inner = (
        <div className="flex h-16 w-16 items-center justify-center rounded-full text-center text-[13px] font-black leading-tight shadow-[inset_0_2px_0_rgba(255,255,255,.45),inset_0_-3px_0_rgba(0,0,0,.2)]" style={{ background: s.color }}>
          <span className="px-1">{s.text}</span>
        </div>
      );
      break;
    case 'star':
    case 'burst':
      inner = (
        <div className="relative flex h-[76px] w-[76px] items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            {s.shape === 'star' ? (
              <path d="M50 2l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 33l30-3z" fill={s.color} />
            ) : (
              <path d="M50 0l8 14 15-7 2 16 16 1-7 15 14 9-14 9 7 15-16 1-2 16-15-7-8 14-8-14-15 7-2-16-16-1 7-15L0 50l14-9-7-15 16-1 2-16 15 7z" fill={s.color} />
            )}
          </svg>
          <span className="relative px-2 text-center text-[12px] font-black leading-tight">{s.text}</span>
        </div>
      );
      break;
    case 'tag':
      inner = (
        <div className="relative flex items-center rounded-l-md rounded-r-xl py-1.5 pl-3 pr-4 text-[13px] font-black" style={{ background: s.color, clipPath: 'polygon(12px 0,100% 0,100% 100%,12px 100%,0 50%)' }}>
          <span className="absolute left-[7px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/80" />
          <span className="pl-2">{s.text}</span>
        </div>
      );
      break;
    case 'pill':
      inner = (
        <div className="rounded-full px-3.5 py-1.5 text-[13px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,.5)]" style={{ background: s.color }}>
          {s.text}
        </div>
      );
      break;
    default:
      // ribbon
      inner = (
        <div className="relative">
          <div className="relative z-10 whitespace-nowrap rounded-md px-5 py-1.5 text-[14px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.15)]" style={{ background: s.color }}>
            {s.text}
          </div>
          <span className="absolute -left-2 top-1.5 -z-0 h-full w-4 rounded-sm brightness-75" style={{ background: s.color, clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%,40% 50%)' }} />
          <span className="absolute -right-2 top-1.5 -z-0 h-full w-4 rounded-sm brightness-75" style={{ background: s.color, clipPath: 'polygon(0 0,100% 0,60% 50%,100% 100%,0 100%)' }} />
        </div>
      );
  }
  return (
    <div
      className={cx('absolute z-30 select-none', onPointerDown && 'cursor-grab touch-none active:cursor-grabbing', selected && 'outline-dashed outline-2 outline-offset-4 outline-sky-400')}
      style={{ ...base, filter: shadow }}
      onPointerDown={onPointerDown}
    >
      {inner}
    </div>
  );
}

function RowView({ row, theme, selected, onClick }: { row: PackageRow; theme: Package['theme']; selected?: boolean; onClick?: () => void }) {
  const dark = isDarkColor(theme.bg1);
  const sel = selected ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent' : '';
  const clickable = onClick ? 'cursor-pointer rounded-lg hover:bg-black/5' : '';
  const color = row.color || undefined;
  switch (row.type) {
    case 'divider':
      return <div onClick={onClick} className={cx('py-2', clickable, sel)}><div className="h-px" style={{ background: dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.1)' }} /></div>;
    case 'spacer':
      return <div onClick={onClick} className={cx('h-4', clickable, sel)} />;
    case 'heading':
      return (
        <div onClick={onClick} className={cx('pt-2 text-[12px] font-black uppercase tracking-wider opacity-70', clickable, sel)} style={{ color }}>
          {row.text}
        </div>
      );
    case 'text':
      return (
        <p onClick={onClick} className={cx('text-[13px] leading-relaxed opacity-85', row.bold && 'font-bold', clickable, sel)} style={{ color }}>
          {row.text}
        </p>
      );
    case 'highlight':
      return (
        <div onClick={onClick} className={cx('flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-bold', clickable, sel)} style={{ background: theme.accent, color: isDarkColor(theme.accent) ? '#fff' : '#142010' }}>
          {row.icon && <DynIcon name={row.icon} size={16} />}
          <span>{row.text}</span>
        </div>
      );
    default:
      return (
        <div onClick={onClick} className={cx('flex items-start gap-2.5 text-[14px]', !row.included && 'opacity-50', row.bold && 'font-bold', clickable, sel)} style={{ color }}>
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: row.included ? theme.accent : dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.08)', color: row.included ? (isDarkColor(theme.accent) ? '#fff' : '#142010') : 'inherit' }}
          >
            {row.included ? <Check size={13} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
          </span>
          <span className={cx('flex-1', !row.included && 'line-through decoration-1')}>{row.text}</span>
          {row.icon && row.included && <DynIcon name={row.icon} size={15} className="mt-0.5 opacity-60" />}
        </div>
      );
  }
}

export interface PackageEditorHooks {
  selectedRowId?: string | null;
  selectedStickerId?: string | null;
  onRowClick?: (id: string) => void;
  onStickerPointerDown?: (e: RPointerEvent<HTMLDivElement>, id: string) => void;
  onHeaderClick?: () => void;
  innerRef?: (el: HTMLDivElement | null) => void;
}

interface Props {
  pkg: Package;
  selected?: boolean;
  current?: boolean;
  onSelect?: () => void;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  editor?: PackageEditorHooks;
  className?: string;
  footer?: ReactNode;
}

export function PackageCard({ pkg, selected, current, onSelect, ctaLabel, ctaDisabled, ctaLoading, editor, className, footer }: Props) {
  const t = pkg.theme;
  const dark = isDarkColor(t.bg1);
  const style = t.style || 'gradient';
  const elevation = t.elevation ?? 2;
  const bg =
    style === 'solid' ? t.bg1 : style === 'outline' ? 'transparent' : style === 'glass' ? (dark ? 'rgba(20,35,25,.65)' : 'rgba(255,255,255,.6)') : `linear-gradient(160deg, ${t.bg1} 0%, ${t.bg2} 100%)`;
  const shadows = [
    'none',
    '0 10px 24px -14px rgba(10,30,10,.35)',
    '0 1px 0 rgba(255,255,255,.35) inset, 0 26px 50px -26px rgba(10,30,10,.55), 0 8px 16px -10px rgba(10,30,10,.25)',
    '0 1px 0 rgba(255,255,255,.4) inset, 0 40px 70px -30px rgba(10,30,10,.7), 0 14px 26px -14px rgba(10,30,10,.4)',
  ];
  const highlighted = pkg.stickers.length > 0 || selected;

  const body = (
    <div
      ref={editor?.innerRef}
      className={cx('relative flex h-full flex-col rounded-[30px] p-6 pt-8 text-right transition-all', style === 'glass' && 'backdrop-blur-xl', selected && 'ring-4 ring-lime-400', className)}
      style={{
        background: bg,
        color: t.text,
        boxShadow: shadows[elevation],
        border: style === 'outline' ? `2px solid ${t.accent}` : `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        transformStyle: 'preserve-3d',
      }}
    >
      {pkg.stickers.map((s) => (
        <StickerView key={s.id} s={s} selected={editor?.selectedStickerId === s.id} onPointerDown={editor?.onStickerPointerDown ? (e) => editor.onStickerPointerDown!(e, s.id) : undefined} />
      ))}
      {current && <div className="absolute left-4 top-4 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur">החבילה שלך</div>}

      <div onClick={editor?.onHeaderClick} className={cx(editor?.onHeaderClick && 'cursor-pointer rounded-xl hover:bg-black/5')} style={{ transform: 'translateZ(40px)' }}>
        <h3 className="font-display text-[28px] leading-tight">{pkg.name}</h3>
        {pkg.subtitle && <p className="mt-0.5 text-sm font-medium opacity-75">{pkg.subtitle}</p>}
        <div className="mt-5 flex items-end gap-2">
          <span className="font-display text-[46px] leading-none tracking-tight">{money(pkg.price)}</span>
          <span className="mb-1.5 text-sm font-semibold opacity-75">{periodLabel(pkg.period)}</span>
        </div>
        {pkg.compare_price ? <div className="mt-1 text-sm font-semibold opacity-60 line-through">{money(pkg.compare_price)}</div> : <div className="mt-1 h-5" />}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip" style={{ background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.06)' }}>
            <Coins size={14} style={{ color: t.accent }} />
            {pkg.tokens} טוקנים{pkg.kind === 'subscription' ? (pkg.period === 'year' ? ' בשנה' : ' בחודש') : ''}
          </span>
          {pkg.priority_listing && (
            <span className="chip" style={{ background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.06)' }}>
              <Rocket size={14} style={{ color: t.accent }} /> קידום בראש
            </span>
          )}
        </div>
      </div>

      <div className="my-5 h-px" style={{ background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)' }} />

      <div className="flex-1 space-y-2.5" style={{ transform: 'translateZ(25px)' }}>
        {pkg.rows.map((r) => (
          <RowView key={r.id} row={r} theme={t} selected={editor?.selectedRowId === r.id} onClick={editor?.onRowClick ? () => editor.onRowClick!(r.id) : undefined} />
        ))}
      </div>

      {(onSelect || ctaLabel) && (
        <button
          type="button"
          onClick={onSelect}
          disabled={ctaDisabled || ctaLoading}
          className="btn mt-6 w-full py-3 text-base disabled:opacity-60"
          style={{
            background: t.accent,
            color: isDarkColor(t.accent) ? '#fff' : '#142010',
            boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 -3px 0 rgba(0,0,0,.18) inset, 0 12px 24px -12px rgba(0,0,0,.5)',
            transform: 'translateZ(35px)',
          }}
        >
          {ctaLoading ? '...' : ctaLabel ?? pkg.cta_text}
        </button>
      )}
      {footer}
    </div>
  );

  if (editor) return body;
  return (
    <Tilt max={6} scale={highlighted ? 1.03 : 1.02} className="h-full" style={{ borderRadius: 30 }}>
      {body}
    </Tilt>
  );
}
