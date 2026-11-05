import { memo, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { MapPin, Navigation, Phone, Share2, Clock3, Eye, MousePointerClick, Sparkles, Star, MessageCircle } from 'lucide-react';
import type { Deal, DealDesign } from '../lib/types';
import { money, telHref, waHref } from '../lib/format';
import { trackDeal } from '../lib/track';
import { Countdown, useDealProgress } from './Countdown';
import { Avatar, Tilt, cx } from './ui';

export const FALLBACK_DESIGN: DealDesign = {
  layout: 'classic',
  palette: { bg1: '#1e5c2e', bg2: '#8cc10a', accent: '#ffe14d', text: '#ffffff', priceBg: '#ffe14d', priceText: '#1b1b1b' },
  pattern: 'dots',
  font: 'secular',
  headline: 'דיל בזק!',
  tagline: '',
  badge: 'מבצע בזק',
  emoji: '🔥',
  ctaText: 'אני רוצה!',
  animation: 'shine',
  radius: 'soft',
  vibe: '',
};

const RADIUS = { soft: 28, round: 40, sharp: 14 };

/** Pick near-black or white text for a given background hex. */
function onColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#141414';
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#141414' : '#ffffff';
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Decorative pattern layer derived from the design spec. */
function PatternLayer({ d, seed }: { d: DealDesign; seed: number }) {
  const { pattern, palette } = d;
  if (pattern === 'none') return null;
  if (['dots', 'grid', 'stripes', 'waves', 'bubbles'].includes(pattern)) {
    return <div aria-hidden className={cx('pointer-events-none absolute inset-0', `pat-${pattern}`)} style={{ color: palette.text, opacity: pattern === 'bubbles' ? 0.1 : 0.12 }} />;
  }
  const r = rand(seed + 3);
  const items = Array.from({ length: 14 }, (_, i) => ({ x: r() * 100, y: r() * 100, rot: r() * 360, s: 0.6 + r() * 0.9, c: i % 3 === 0 ? palette.accent : palette.text }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((it, i) => (
        <svg key={i} viewBox="0 0 24 24" width={16 * it.s} height={16 * it.s} className="absolute" style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `rotate(${it.rot}deg)`, opacity: pattern === 'leaves' ? 0.16 : 0.32 }}>
          {pattern === 'confetti' && <rect x="6" y="2" width="8" height="20" rx="3" fill={it.c} />}
          {pattern === 'sparkles' && <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={it.c} />}
          {pattern === 'leaves' && <path d="M3 21C3 9 11 3 21 3c0 10-6 18-18 18zm0 0 9-9" fill={it.c} stroke={it.c} strokeWidth="1.5" />}
        </svg>
      ))}
    </div>
  );
}

function ProgressBar({ deal, d }: { deal: Deal; d: DealDesign }) {
  const { remaining, urgent, started } = useDealProgress(deal.starts_at, deal.expires_at);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px] font-semibold" style={{ color: d.palette.text }}>
        <span className="flex items-center gap-1 opacity-90">
          <Clock3 size={13} className={urgent ? 'animate-pulse' : ''} />
          {started ? (urgent ? 'נגמר ממש עוד מעט!' : 'הדיל נגמר בעוד') : 'הדיל מתחיל בעוד'}
        </span>
        <Countdown to={started ? deal.expires_at : deal.starts_at} className="rounded-md bg-black/20 px-1.5 py-0.5 text-[12px] font-bold text-white" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/20">
        <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${(started ? remaining : 1) * 100}%`, background: urgent ? '#ff4d4d' : d.palette.accent }} />
      </div>
    </div>
  );
}

function ActionBtn({ href, onClick, icon, label, d, primary, disabled }: { href?: string; onClick?: (e: MouseEvent) => void; icon: ReactNode; label: string; d: DealDesign; primary?: boolean; disabled?: boolean }) {
  const style: CSSProperties = primary
    ? { background: d.palette.priceBg, color: d.palette.priceText, boxShadow: '0 1px 0 rgba(255,255,255,.45) inset, 0 -2px 0 rgba(0,0,0,.18) inset, 0 8px 16px -8px rgba(0,0,0,.5)' }
    : { background: 'rgba(255,255,255,.16)', color: d.palette.text, boxShadow: '0 1px 0 rgba(255,255,255,.25) inset' };
  const cls = cx('flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold backdrop-blur-sm transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0', disabled && 'pointer-events-none');
  if (href && !disabled)
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={onClick} className={cls} style={style} aria-label={label}>
        {icon}
        <span className="truncate">{label}</span>
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls} style={style} aria-label={label}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Sticker({ text, d, layout }: { text: string; d: DealDesign; layout: DealDesign['layout'] }) {
  if (!text) return null;
  if (layout === 'ribbon') {
    return (
      <div className="pointer-events-none absolute -left-12 top-6 z-20 w-48 -rotate-45 py-1.5 text-center text-[13px] font-black shadow-lg" style={{ background: d.palette.accent, color: onColor(d.palette.accent) }}>
        {text}
      </div>
    );
  }
  return (
    <div
      className="absolute right-3 top-3 z-20 rotate-[8deg] rounded-xl px-2.5 py-1 text-[12px] font-black shadow-[0_6px_14px_-6px_rgba(0,0,0,.55)]"
      style={{ background: d.palette.accent, color: onColor(d.palette.accent), transform: 'translateZ(50px) rotate(8deg)' }}
    >
      {text}
    </div>
  );
}

interface Props {
  deal: Deal;
  onOpen?: () => void;
  preview?: boolean;
  showStats?: boolean;
  large?: boolean;
  tilt?: boolean;
  className?: string;
}

function DealCardImpl({ deal, onOpen, preview, showStats, large, tilt = true, className }: Props) {
  const d: DealDesign = deal.design && deal.design.palette ? deal.design : FALLBACK_DESIGN;
  const p = d.palette;
  const radius = RADIUS[d.radius] ?? 28;
  const fontCls = `font-deal-${d.font}`;
  const discount = Math.round(deal.discount_percent);
  const biz = deal.business;

  const act = (type: 'phone' | 'waze' | 'share') => (e: MouseEvent) => {
    e.stopPropagation();
    if (preview) {
      e.preventDefault();
      return;
    }
    trackDeal(deal.id, type);
    if (type === 'share') {
      const url = `${window.location.origin}/deal/${deal.id}`;
      const text = `${deal.title} — ${discount}% הנחה ב${biz.name}`;
      if (navigator.share) navigator.share({ title: biz.name, text, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).catch(() => {});
    }
  };

  const discountBubble = (big = false) => (
    <div
      className={cx('relative flex shrink-0 flex-col items-center justify-center rounded-full font-black leading-none', d.animation === 'pulse' && 'animate-pulsebig', big ? 'h-32 w-32' : 'h-[76px] w-[76px]')}
      style={{ background: `radial-gradient(circle at 35% 30%, ${p.accent}, ${p.accent} 45%, rgba(0,0,0,.25) 140%)`, color: onColor(p.accent), boxShadow: '0 1px 0 rgba(255,255,255,.6) inset, 0 -4px 0 rgba(0,0,0,.2) inset, 0 14px 26px -10px rgba(0,0,0,.6)', transform: 'translateZ(60px)' }}
    >
      <span className={cx(fontCls, big ? 'text-5xl' : 'text-[28px]')} dir="ltr">
        {discount}%
      </span>
      <span className={cx('font-bold', big ? 'text-sm' : 'text-[11px]')}>הנחה</span>
    </div>
  );

  const prices = (
    <div className="flex flex-col items-start gap-1" style={{ transform: 'translateZ(45px)' }}>
      <span className="text-[13px] font-semibold opacity-80" style={{ color: p.text }}>
        במקום <s className="decoration-2">{money(deal.original_price)}</s>
      </span>
      <span
        className={cx('rounded-2xl px-3.5 py-1.5 text-[30px] font-black leading-none tracking-tight', fontCls)}
        style={{ background: p.priceBg, color: p.priceText, boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 -3px 0 rgba(0,0,0,.15) inset, 0 10px 20px -10px rgba(0,0,0,.55)' }}
      >
        {money(deal.final_price)}
      </span>
    </div>
  );

  const media = deal.image_url ? (
    <div className={cx('relative mx-auto overflow-hidden shadow-[0_16px_30px_-14px_rgba(0,0,0,.6)] ring-2 ring-white/40', d.layout === 'spotlight' ? 'h-36 w-36 rounded-full' : 'aspect-[16/9] w-full rounded-2xl')} style={{ transform: 'translateZ(30px)' }}>
      <img src={deal.image_url} alt={deal.title} loading="lazy" className="h-full w-full object-cover" />
    </div>
  ) : (
    <div className={cx('select-none text-center leading-none drop-shadow-[0_10px_14px_rgba(0,0,0,.35)]', d.animation === 'float' || d.layout === 'spotlight' ? 'animate-floaty' : '', d.layout === 'spotlight' ? 'text-6xl' : 'text-5xl')} style={{ transform: 'translateZ(35px)' }} aria-hidden>
      {d.emoji}
    </div>
  );

  const card = (
    <article
      onClick={onOpen}
      className={cx(
        'group relative flex h-full flex-col overflow-hidden text-right',
        onOpen && 'cursor-pointer',
        d.animation === 'glow' && 'animate-glow',
        large ? 'min-h-[560px]' : 'min-h-[470px]',
        !tilt && className,
      )}
      style={{
        borderRadius: radius,
        background: `linear-gradient(150deg, ${p.bg1} 0%, ${p.bg2} 100%)`,
        color: p.text,
        boxShadow: '0 1px 0 rgba(255,255,255,.35) inset, 0 -6px 0 rgba(0,0,0,.12) inset, 0 28px 50px -24px rgba(10,30,10,.6), 0 10px 18px -12px rgba(10,30,10,.35)',
        transformStyle: 'preserve-3d',
      }}
    >
      <PatternLayer d={d} seed={deal.id || 1} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(130% 55% at 50% -5%, rgba(255,255,255,.38), transparent 60%)' }} />
      {d.animation === 'shine' && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-l from-transparent via-white/30 to-transparent" />
      )}

      <Sticker text={d.badge} d={d} layout={d.layout} />
      {deal.featured && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-white backdrop-blur" style={{ transform: d.layout === 'ribbon' ? 'translateY(28px)' : undefined }}>
          <Star size={11} className="fill-amber-300 text-amber-300" /> מומלץ
        </div>
      )}

      {/* logo — centered at the top */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-6" style={{ transform: 'translateZ(55px)' }}>
        <div className="rounded-full bg-white p-1 shadow-[0_14px_26px_-10px_rgba(0,0,0,.6)] ring-4 ring-white/35">
          <Avatar src={biz.logo_url} name={biz.name} size={large ? 84 : 70} />
        </div>
        <div className="mt-2 max-w-full truncate text-[13px] font-bold opacity-95">{biz.name}</div>
        {(deal.category || deal.city) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium opacity-75">
            {deal.category?.name}
            {deal.category && deal.city && <span>·</span>}
            {deal.city?.name}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        <div className={cx('text-center', d.layout === 'ribbon' && 'text-right')} style={{ transform: 'translateZ(40px)' }}>
          <h3 className={cx('text-balance leading-[1.05]', fontCls, large ? 'text-[34px]' : 'text-[28px]', d.font === 'karantina' && (large ? 'text-[46px]' : 'text-[40px]'))} style={{ textShadow: '0 2px 12px rgba(0,0,0,.18)' }}>
            {d.headline}
          </h3>
          <p className="mt-1.5 text-balance text-[15px] font-bold leading-snug">{deal.title}</p>
          {d.tagline && d.tagline !== deal.title && <p className="mt-1 text-balance text-[13px] font-medium opacity-80">{d.tagline}</p>}
        </div>

        {d.layout === 'spotlight' ? (
          <>
            <div className="relative flex items-center justify-center py-1">
              {discountBubble(true)}
              <div className="absolute -left-1 top-0">{!deal.image_url && <span className="text-4xl drop-shadow-lg">{d.emoji}</span>}</div>
            </div>
            {deal.image_url && media}
            <div className="flex justify-center">{prices}</div>
          </>
        ) : d.layout === 'split' ? (
          <>
            {media}
            <div className="mt-auto grid grid-cols-2 overflow-hidden rounded-2xl bg-black/15 ring-1 ring-white/15" style={{ transform: 'translateZ(40px)' }}>
              <div className="flex flex-col items-center justify-center gap-0.5 border-l border-white/15 p-3">
                <span className={cx('text-[34px] font-black leading-none', fontCls)} style={{ color: p.accent }} dir="ltr">
                  -{discount}%
                </span>
                <s className="text-[13px] font-semibold opacity-80">{money(deal.original_price)}</s>
              </div>
              <div className="flex flex-col items-center justify-center p-3" style={{ background: p.priceBg, color: p.priceText }}>
                <span className="text-[11px] font-bold opacity-80">מחיר דיל</span>
                <span className={cx('text-[30px] font-black leading-none', fontCls)}>{money(deal.final_price)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {media}
            <div className="mt-auto flex items-center justify-between gap-3">
              {prices}
              {discountBubble()}
            </div>
          </>
        )}

        <ProgressBar deal={deal} d={d} />

        {(biz.address || biz.phone || biz.waze_url) && (
          <div className="space-y-2" style={{ transform: 'translateZ(30px)' }}>
            {biz.address && (
              <div className="flex items-center gap-1.5 text-[12px] font-medium opacity-90">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{biz.address}</span>
              </div>
            )}
            <div className="flex gap-2">
              {biz.phone && <ActionBtn href={telHref(biz.phone)} onClick={act('phone')} icon={<Phone size={15} />} label="חיוג" d={d} primary disabled={preview} />}
              {biz.waze_url && <ActionBtn href={biz.waze_url} onClick={act('waze')} icon={<Navigation size={15} />} label="Waze" d={d} primary={!biz.phone} disabled={preview} />}
              {biz.whatsapp && <ActionBtn href={waHref(biz.whatsapp, `היי, ראיתי את הדיל "${deal.title}" בבולדיל`)} onClick={act('phone')} icon={<MessageCircle size={15} />} label="וואטסאפ" d={d} disabled={preview} />}
              <ActionBtn onClick={act('share')} icon={<Share2 size={15} />} label="שיתוף" d={d} />
            </div>
          </div>
        )}

        {showStats && (
          <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-[12px] font-semibold text-white">
            <span className="flex items-center gap-1">
              <Eye size={13} /> {deal.views ?? 0} צפיות
            </span>
            <span className="flex items-center gap-1">
              <MousePointerClick size={13} /> {(deal.clicks_phone ?? 0) + (deal.clicks_waze ?? 0)} לחיצות
            </span>
            {deal.design_source === 'ai' && (
              <span className="flex items-center gap-1">
                <Sparkles size={13} /> AI
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );

  return tilt ? (
    <Tilt max={7} className={cx('h-full', className)} style={{ borderRadius: radius }}>
      {card}
    </Tilt>
  ) : (
    card
  );
}

export const DealCard = memo(DealCardImpl);
