/** Fill a sparse per-day series so every day in the range has a row (Israel-time day keys). */
export function fillDays<T extends { day: string }>(rows: T[], days: number, empty: Omit<T, 'day'>): T[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = fmt.format(new Date(Date.now() - i * 86400_000));
    out.push((map.get(key) as T) ?? ({ day: key, ...empty } as T));
  }
  return out;
}
