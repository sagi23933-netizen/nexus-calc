import { useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { ICON_NAMES, DynIcon } from '../../lib/icons';
import { cx } from '../../shared/ui';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Collapsible inspector section. */
export function Section({ title, icon, children, defaultOpen = true, aside }: { title: ReactNode; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; aside?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-2 text-right text-sm font-bold text-white">
          {icon && <span className="text-lime-400">{icon}</span>}
          {title}
          <ChevronDown size={16} className={cx('mr-auto text-ink-400 transition-transform', !open && 'rotate-90')} />
        </button>
        {aside}
      </div>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Color swatch + hex input. Empty value allowed when `allowEmpty`. */
export function ColorField({ label, value, onChange, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  return (
    <label className="block">
      <span className="a-label !mb-1 text-xs">{label}</span>
      <span className="flex items-center gap-2">
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15" style={{ background: value || 'repeating-conic-gradient(#333 0 25%, #222 0 50%) 0 0/10px 10px' }}>
          <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
        </span>
        <input
          className="a-input !py-1.5 font-mono text-xs"
          dir="ltr"
          value={text}
          placeholder={allowEmpty ? 'ברירת מחדל' : '#000000'}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (HEX.test(v) || (allowEmpty && v === '')) onChange(v);
          }}
        />
        {allowEmpty && value && (
          <button type="button" onClick={() => onChange('')} className="btn-icon h-8 w-8 shrink-0 text-ink-400 hover:bg-white/10" aria-label="ניקוי צבע">
            <X size={14} />
          </button>
        )}
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; className?: string }) {
  return (
    <div className={cx('flex rounded-xl bg-black/30 p-1 ring-1 ring-white/5', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx('flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition', o.value === value ? 'bg-lime-400 text-leaf-950 shadow' : 'text-ink-300 hover:text-white')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RangeField({ label, value, min, max, step = 1, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-300">
        {label}
        <span className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-white" dir="ltr">
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-lime-400" />
    </label>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="a-label !mb-1 text-xs">אייקון</span>
      <button type="button" onClick={() => setOpen((o) => !o)} className="a-input flex items-center gap-2 !py-1.5 text-sm">
        {value ? <DynIcon name={value} size={16} className="text-lime-400" /> : <span className="h-4 w-4 rounded border border-dashed border-ink-500" />}
        <span className="flex-1 text-right">{value || 'ללא אייקון'}</span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div className="mt-2 grid max-h-48 grid-cols-7 gap-1 overflow-y-auto rounded-xl bg-black/40 p-2 ring-1 ring-white/10">
          <button type="button" title="ללא" onClick={() => (onChange(''), setOpen(false))} className={cx('flex h-9 items-center justify-center rounded-lg text-ink-400 hover:bg-white/10', !value && 'bg-lime-400/20 ring-1 ring-lime-400')}>
            <X size={15} />
          </button>
          {ICON_NAMES.map((n) => (
            <button
              key={n}
              type="button"
              title={n}
              onClick={() => (onChange(n), setOpen(false))}
              className={cx('flex h-9 items-center justify-center rounded-lg text-ink-200 hover:bg-white/10', value === n && 'bg-lime-400/20 text-lime-300 ring-1 ring-lime-400')}
            >
              <DynIcon name={n} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MiniField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="a-label !mb-1 text-xs">{label}</span>
      {children}
    </label>
  );
}
