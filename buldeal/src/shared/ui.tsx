import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes, type PointerEvent as RPointerEvent, type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X, ChevronRight, ChevronLeft, Inbox } from 'lucide-react';
import { prefersReducedMotion } from '../lib/hooks';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------- Button ----------------
type Variant = 'lime' | 'leaf' | 'wood' | 'ghost' | 'outline' | 'danger' | 'a-ghost' | 'a-outline';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = 'lime', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cx('btn', size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', variant.startsWith('a-') ? `a-btn-${variant.slice(2)}` : `btn-${variant}`, className)}
        {...rest}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);

export function Spinner({ className, size = 28 }: { className?: string; size?: number }) {
  return <Loader2 className={cx('animate-spin text-lime-600', className)} size={size} />;
}

export function PageLoader({ dark }: { dark?: boolean }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="relative h-14 w-14">
        <div className={cx('absolute inset-0 animate-ping rounded-2xl', dark ? 'bg-lime-500/20' : 'bg-lime-400/30')} />
        <img src="/icon-192.png" alt="" className="relative h-14 w-14 animate-floaty drop-shadow-xl" />
      </div>
    </div>
  );
}

// ---------------- Fields ----------------
export function Field({ label, hint, error, children, className, dark, required }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; dark?: boolean; required?: boolean }) {
  return (
    <div className={className}>
      {label && (
        <label className={dark ? 'a-label' : 'field-label'}>
          {label}
          {required && <span className="mr-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-500">{error}</p> : hint ? <p className={cx('mt-1 text-xs', dark ? 'text-ink-400' : 'text-ink-500')}>{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { dark?: boolean; invalid?: boolean }>(function Input({ dark, invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx(dark ? 'a-input' : 'input', invalid && 'input-error', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { dark?: boolean }>(function Textarea({ dark, className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(dark ? 'a-input' : 'input', 'min-h-[96px] resize-y leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { dark?: boolean }>(function Select({ dark, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(dark ? 'a-input' : 'input', 'cursor-pointer appearance-none bg-[length:16px] bg-[left_12px_center] bg-no-repeat pl-9', className)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2381917b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} {...rest}>
      {children}
    </select>
  );
});

export function Switch({ checked, onChange, label, dark, disabled, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; dark?: boolean; disabled?: boolean; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-lime-500 shadow-[inset_0_-2px_0_rgba(0,0,0,.15)]' : dark ? 'bg-white/15' : 'bg-ink-200',
        )}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all', checked ? 'right-[22px]' : 'right-0.5')} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className={cx('block text-sm font-semibold', dark ? 'text-ink-100' : 'text-ink-800')}>{label}</span>}
          {description && <span className={cx('block text-xs', dark ? 'text-ink-400' : 'text-ink-500')}>{description}</span>}
        </span>
      )}
    </label>
  );
}

// ---------------- Modal / Drawer ----------------
export function Modal({ open, onClose, title, children, size = 'md', dark, footer, hideClose, className }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; dark?: boolean; footer?: ReactNode; hideClose?: boolean; className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[1400px]' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={cx('fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4', dark && 'admin-theme !bg-transparent')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className={cx('absolute inset-0 backdrop-blur-sm', dark ? 'bg-black/70' : 'bg-leaf-950/45')} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 40, opacity: 0, rotateX: 8, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{ transformPerspective: 1200 }}
            className={cx(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]',
              widths[size],
              dark ? 'a-card !rounded-b-none text-ink-100 sm:!rounded-[28px]' : 'bg-white shadow-deep',
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className={cx('flex items-center justify-between gap-4 px-6 pb-2 pt-5', !title && 'absolute left-0 top-0 z-10')}>
                {title && <h2 className={cx('text-xl font-bold', dark ? 'text-white' : 'text-ink-900')}>{title}</h2>}
                {!hideClose && (
                  <button onClick={onClose} aria-label="סגירה" className={cx('btn-icon shrink-0', dark ? 'hover:bg-white/10' : '')}>
                    <X size={20} />
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
            {footer && <div className={cx('flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4', dark ? 'border-white/10' : 'border-ink-100 bg-ink-50/50')}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, confirmText = 'אישור', danger, dark, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: ReactNode; confirmText?: string; danger?: boolean; dark?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" dark={dark}
      footer={
        <>
          <Button variant={dark ? 'a-ghost' : 'ghost'} onClick={onClose}>ביטול</Button>
          <Button variant={danger ? 'danger' : 'lime'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
        </>
      }
    >
      <div className={dark ? 'text-ink-300' : 'text-ink-600'}>{body}</div>
    </Modal>
  );
}

// ---------------- misc ----------------
export function Empty({ icon, title, text, action, dark }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className={cx('mb-4 flex h-16 w-16 items-center justify-center rounded-3xl shadow-3d', dark ? 'bg-white/5 text-lime-400' : 'bg-lime-100 text-lime-700')}>{icon ?? <Inbox size={28} />}</div>
      <h3 className={cx('text-lg font-bold', dark ? 'text-white' : 'text-ink-900')}>{title}</h3>
      {text && <p className={cx('mt-1 max-w-sm text-sm', dark ? 'text-ink-400' : 'text-ink-500')}>{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function Tabs<T extends string>({ value, onChange, tabs, dark, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; dark?: boolean; className?: string }) {
  return (
    <div className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1 scrollbar-none', dark ? 'bg-black/30 ring-1 ring-white/5' : 'bg-ink-100/80', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition',
              active ? (dark ? 'text-leaf-950' : 'text-ink-900') : dark ? 'text-ink-300 hover:text-white' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {active && <motion.span layoutId={`tab-${tabs.map((x) => x.value).join()}`} className={cx('absolute inset-0 rounded-xl', dark ? 'bg-lime-400' : 'bg-white shadow-soft')} transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
            <span className="relative flex items-center gap-2">
              {t.label}
              {t.count != null && <span className={cx('rounded-full px-1.5 text-[11px]', active ? 'bg-black/10' : dark ? 'bg-white/10' : 'bg-ink-200')}>{t.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ page, total, size, onPage, dark }: { page: number; total: number; size: number; onPage: (p: number) => void; dark?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className={cx('flex items-center justify-between gap-3 px-2 py-3 text-sm', dark ? 'text-ink-400' : 'text-ink-500')}>
      <span>
        עמוד {page} מתוך {pages} · {total.toLocaleString('he-IL')} רשומות
      </span>
      <div className="flex gap-1">
        <button className={cx('btn-icon', dark && 'hover:bg-white/10')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="הקודם">
          <ChevronRight size={18} />
        </button>
        <button className={cx('btn-icon', dark && 'hover:bg-white/10')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="הבא">
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );
}

/** 3D tilt-on-hover wrapper. Children can use `[data-depth]` + translateZ for parallax layers. */
export function Tilt({ children, className, max = 10, scale = 1.02, glare = true, style, disabled }: { children: ReactNode; className?: string; max?: number; scale?: number; glare?: boolean; style?: CSSProperties; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const reduce = useRef(prefersReducedMotion());
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (disabled || reduce.current || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  };
  const reset = () => {
    setHover(false);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div className={cx('perspective', className)} style={style}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={reset}
        className="preserve-3d relative h-full transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(${hover && !disabled ? scale : 1})` }}
      >
        {children}
        {glare && !disabled && (
          <div
            className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] opacity-0 transition-opacity duration-300"
            style={{ opacity: hover ? 1 : 0, background: 'radial-gradient(circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.35), transparent 55%)', mixBlendMode: 'soft-light' }}
          />
        )}
      </div>
    </div>
  );
}

export function StatusDot({ tone }: { tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  const c = { green: 'bg-lime-500', amber: 'bg-amber-400', red: 'bg-red-500', gray: 'bg-ink-400', blue: 'bg-sky-500' }[tone];
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {tone === 'green' && <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', c)} />}
      <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', c)} />
    </span>
  );
}

const STATUS_STYLE: Record<string, { light: string; dark: string; label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' }> = {
  trial: { light: 'bg-sky-50 text-sky-700 ring-sky-200', dark: 'bg-sky-400/10 text-sky-300 ring-sky-400/20', label: 'ניסיון', tone: 'blue' },
  active: { light: 'bg-lime-50 text-lime-800 ring-lime-200', dark: 'bg-lime-400/10 text-lime-300 ring-lime-400/20', label: 'פעיל', tone: 'green' },
  past_due: { light: 'bg-amber-50 text-amber-800 ring-amber-200', dark: 'bg-amber-400/10 text-amber-300 ring-amber-400/20', label: 'ממתין לתשלום', tone: 'amber' },
  blocked: { light: 'bg-red-50 text-red-700 ring-red-200', dark: 'bg-red-400/10 text-red-300 ring-red-400/20', label: 'חסום', tone: 'red' },
  suspended: { light: 'bg-ink-100 text-ink-700 ring-ink-200', dark: 'bg-white/5 text-ink-300 ring-white/10', label: 'מושעה', tone: 'gray' },
  paid: { light: 'bg-lime-50 text-lime-800 ring-lime-200', dark: 'bg-lime-400/10 text-lime-300 ring-lime-400/20', label: 'שולם', tone: 'green' },
  failed: { light: 'bg-red-50 text-red-700 ring-red-200', dark: 'bg-red-400/10 text-red-300 ring-red-400/20', label: 'נכשל', tone: 'red' },
  refunded: { light: 'bg-ink-100 text-ink-700 ring-ink-200', dark: 'bg-white/5 text-ink-300 ring-white/10', label: 'זוכה', tone: 'gray' },
  open: { light: 'bg-amber-50 text-amber-800 ring-amber-200', dark: 'bg-amber-400/10 text-amber-300 ring-amber-400/20', label: 'פתוחה', tone: 'amber' },
  pending: { light: 'bg-sky-50 text-sky-700 ring-sky-200', dark: 'bg-sky-400/10 text-sky-300 ring-sky-400/20', label: 'נענתה', tone: 'blue' },
  closed: { light: 'bg-ink-100 text-ink-600 ring-ink-200', dark: 'bg-white/5 text-ink-400 ring-white/10', label: 'סגורה', tone: 'gray' },
  scheduled: { light: 'bg-violet-50 text-violet-700 ring-violet-200', dark: 'bg-violet-400/10 text-violet-300 ring-violet-400/20', label: 'מתוזמן', tone: 'blue' },
};

export function StatusBadge({ status, dark, label }: { status: string; dark?: boolean; label?: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.suspended;
  return (
    <span className={cx('chip ring-1', dark ? s.dark : s.light)}>
      <StatusDot tone={s.tone} />
      {label ?? s.label}
    </span>
  );
}

export function Avatar({ src, name, size = 40, className, ring }: { src?: string; name: string; size?: number; className?: string; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return src ? (
    <img src={src} alt={name} width={size} height={size} className={cx('shrink-0 rounded-full bg-white object-cover', ring && 'ring-2 ring-white', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 60% 45%), hsl(${(hue + 40) % 360} 65% 35%))` }}
    >
      {initials}
    </span>
  );
}
