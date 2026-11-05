import { useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';
import type { CardInput } from '../lib/types';
import { Field, Input, cx } from './ui';

function brand(num: string) {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'AMEX';
  if (/^(36|38|30)/.test(n)) return 'Diners';
  return n.length ? 'ישראכרט' : '';
}

export const emptyCard: CardInput = { number: '', exp: '', cvv: '', holder: '' };

export function validateCardInput(c: CardInput): string | null {
  const n = c.number.replace(/\D/g, '');
  if (n.length < 8 || n.length > 19) return 'מספר כרטיס לא תקין';
  if (!/^\d{2}\/\d{2}$/.test(c.exp)) return 'תוקף בפורמט MM/YY';
  if (!/^\d{3,4}$/.test(c.cvv)) return 'CVV לא תקין';
  if (!c.holder.trim()) return 'יש להזין שם בעל הכרטיס';
  return null;
}

/** Credit-card fields with a live 3D card that flips to the back on CVV focus. */
export function CardForm({ value, onChange, demo }: { value: CardInput; onChange: (c: CardInput) => void; demo?: boolean }) {
  const [flip, setFlip] = useState(false);
  const set = (k: keyof CardInput, v: string) => onChange({ ...value, [k]: v });
  const fmtNumber = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();
  const fmtExp = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const shown = (value.number || '•••• •••• •••• ••••').padEnd(19, '•');

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center">
      <div className="perspective mx-auto w-full max-w-[300px]">
        <div className="preserve-3d relative aspect-[1.586] w-full transition-transform duration-700" style={{ transform: flip ? 'rotateY(180deg)' : 'rotateY(0)' }}>
          <div
            className="backface-hidden absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-white shadow-deep"
            style={{ background: 'linear-gradient(135deg,#1e5c2e 0%,#3f8f2a 55%,#8cc10a 120%)' }}
          >
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-0 h-40 w-56 rounded-full bg-black/10" />
            <div className="relative flex items-center justify-between">
              <div className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500 shadow-inner" />
              <span className="text-sm font-black tracking-wide opacity-90" dir="ltr">
                {brand(value.number)}
              </span>
            </div>
            <div className="relative text-left font-mono text-[17px] tracking-[0.12em]" dir="ltr">
              {shown}
            </div>
            <div className="relative flex items-end justify-between text-[11px]">
              <div>
                <div className="opacity-60">בעל הכרטיס</div>
                <div className="max-w-[150px] truncate text-sm font-bold">{value.holder || 'השם שלך'}</div>
              </div>
              <div className="text-left" dir="ltr">
                <div className="opacity-60">VALID</div>
                <div className="font-mono text-sm font-bold">{value.exp || 'MM/YY'}</div>
              </div>
            </div>
          </div>
          <div className="backface-hidden absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-leaf-800 to-leaf-950 shadow-deep" style={{ transform: 'rotateY(180deg)' }}>
            <div className="mt-6 h-10 bg-black/70" />
            <div className="mx-4 mt-4 flex items-center justify-end rounded bg-white/90 px-3 py-1.5 font-mono text-sm text-ink-900" dir="ltr">
              {value.cvv.replace(/./g, '•') || 'CVV'}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        <Field label="מספר כרטיס">
          <div className="relative">
            <Input inputMode="numeric" autoComplete="cc-number" dir="ltr" className="pr-10 text-left font-mono" placeholder="0000 0000 0000 0000" value={value.number} onChange={(e) => set('number', fmtNumber(e.target.value))} />
            <CreditCard size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תוקף">
            <Input inputMode="numeric" autoComplete="cc-exp" dir="ltr" className="text-left font-mono" placeholder="MM/YY" value={value.exp} onChange={(e) => set('exp', fmtExp(e.target.value))} />
          </Field>
          <Field label="CVV">
            <Input
              inputMode="numeric"
              autoComplete="cc-csc"
              dir="ltr"
              className="text-left font-mono"
              placeholder="123"
              value={value.cvv}
              onFocus={() => setFlip(true)}
              onBlur={() => setFlip(false)}
              onChange={(e) => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </Field>
        </div>
        <Field label="שם בעל הכרטיס">
          <Input autoComplete="cc-name" value={value.holder} onChange={(e) => set('holder', e.target.value)} placeholder="ישראל ישראלי" />
        </Field>
        <p className={cx('flex items-center gap-1.5 text-xs', demo ? 'text-amber-700' : 'text-ink-500')}>
          <Lock size={13} />
          {demo ? 'מצב הדגמה: לא מתבצע חיוב אמיתי. כרטיס שמסתיים ב-0002 ידחה.' : 'התשלום מאובטח ומוצפן. פרטי הכרטיס אינם נשמרים אצלנו.'}
        </p>
      </div>
    </div>
  );
}
