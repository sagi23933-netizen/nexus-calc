const TZ = 'Asia/Jerusalem';

export function money(n: number | null | undefined, opts: { decimals?: boolean } = {}) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const decimals = opts.decimals ?? !Number.isInteger(v);
  return `₪${v.toLocaleString('he-IL', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`;
}

export const pct = (n: number) => `${Math.round(Number(n))}%`;
export const num = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('he-IL'));

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function date(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function shortDay(day: string) {
  // YYYY-MM-DD → DD/MM
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export function time(iso: string) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });
export function relative(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return date(iso);
}

/** Remaining time split into parts. */
export function timeLeft(iso: string, now = Date.now()) {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const total = Math.floor(ms / 1000);
  return { ms, d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function durationLabel(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} דקות`;
  if (hours === 1) return 'שעה';
  if (hours === 2) return 'שעתיים';
  if (hours === 24) return 'יממה';
  if (hours === 48) return 'יומיים';
  return Number.isInteger(hours) ? `${hours} שעות` : `${hours} שעות`;
}

export function daysLeft(iso: string | null | undefined) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000));
}

export const periodLabel = (p: string) => (p === 'year' ? 'לשנה' : p === 'month' ? 'לחודש' : 'תשלום חד־פעמי');

export const STATUS_LABEL: Record<string, string> = {
  trial: 'תקופת ניסיון',
  active: 'פעיל',
  past_due: 'ממתין לתשלום',
  blocked: 'חסום',
  suspended: 'מושעה',
};

export const BLOCK_REASON: Record<string, string> = {
  trial_ended: 'תקופת הניסיון הסתיימה ללא תשלום',
  subscription_ended: 'המנוי הסתיים',
  payment_failed: 'החיוב נכשל',
  admin: 'נחסם על ידי מנהל',
};

export const END_REASON: Record<string, string> = {
  expired: 'הסתיים',
  removed_by_business: 'הוסר על ידך',
  removed_by_admin: 'הוסר ע״י מנהל',
  blocked: 'הוסר — חשבון חסום',
};

export const TOKEN_TYPE: Record<string, string> = {
  trial_daily: 'טוקן יומי (ניסיון)',
  deal_publish: 'פרסום דיל',
  package_grant: 'הקצאת חבילה',
  purchase: 'רכישת טוקנים',
  admin_adjust: 'עדכון מנהל',
  refund: 'החזר',
};

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function waHref(phone: string, text = '') {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = `972${p.slice(1)}`;
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
