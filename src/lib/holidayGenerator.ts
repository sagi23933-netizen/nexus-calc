import Holidays from 'date-holidays';
import type { Holiday } from '../types';

export type Religion = 'jewish' | 'muslim' | 'christian' | 'druze';

export const RELIGION_LABELS: Record<Religion, string> = {
  jewish: 'יהודית',
  muslim: 'מוסלמית',
  christian: 'נוצרית',
  druze: 'דרוזית',
};

function isCholHamoedName(name: string): boolean {
  return name.includes('חול המועד') ||
    name.includes('Chol HaMoed') ||
    name.includes('Chol ha-Moed') ||
    name.toLowerCase().includes('intermediate');
}

export function generateHolidays(year: number): Holiday[] {
  const hd = new Holidays('IL');
  const holidays = hd.getHolidays(year);

  return holidays
    .filter(h => h.type === 'public')
    .map(h => ({
      id: `${h.date}-${h.name}`,
      date: h.date.split(' ')[0],
      name: h.name,
      isEveHoliday: h.name.includes('ערב') || h.name.includes('Eve'),
      isCholHamoed: isCholHamoedName(h.name),
      isHolidayWork: false,
    }));
}


export function generatePayrollYearHolidays(year: number, religions: Religion[]): Holiday[] {
  const hd = new Holidays('IL');
  const allHolidays: Holiday[] = [];
  const seen = new Set<string>();

  for (const y of [year, year + 1]) {
    const holidays = hd.getHolidays(y);
    for (const h of holidays) {
      if (h.type !== 'public') continue;

      const date = h.date.split(' ')[0];
      const key = `${date}-${h.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const religion = detectReligion(h.name);
      if (religions.length > 0 && (!religion || !religions.includes(religion))) continue;

      allHolidays.push({
        id: key,
        date,
        name: h.name,
        isEveHoliday: h.name.includes('ערב') || h.name.includes('Eve'),
        isCholHamoed: isCholHamoedName(h.name),
        isHolidayWork: false,
        religion,
      });
    }
  }

  return allHolidays.sort((a, b) => a.date.localeCompare(b.date));
}

function detectReligion(name: string): Religion | undefined {
  const jewishKeywords = [
    'ראש השנה', 'יום כיפור', 'סוכות', 'שמחת תורה', 'שמיני עצרת',
    'פסח', 'שבועות', 'יום העצמאות', 'יום הזיכרון', 'ט"ו בשבט',
    'פורים', 'חנוכה', 'ל"ג בעומר', 'ערב ראש השנה', 'ערב יום כיפור',
    'ערב פסח', 'ערב סוכות', 'שביעי של פסח',
    'Rosh Hashana', 'Yom Kippur', 'Sukkot', 'Simchat Torah', 'Shemini Atzeret',
    'Pesach', 'Passover', 'Shavuot', 'Independence', 'Purim', 'Hanukkah', 'Chanukah',
  ];
  const muslimKeywords = [
    'עיד אל-פיטר', 'עיד אל-אדחא', 'רמדאן', 'מולד הנביא',
    'Eid al-Fitr', 'Eid al-Adha', 'Ramadan', 'Mawlid',
  ];
  const christianKeywords = [
    'חג המולד', 'פסחא', 'ראש השנה הנוצרי',
    'Christmas', 'Easter', 'Good Friday',
  ];

  for (const kw of jewishKeywords) {
    if (name.includes(kw)) return 'jewish';
  }
  for (const kw of muslimKeywords) {
    if (name.includes(kw)) return 'muslim';
  }
  for (const kw of christianKeywords) {
    if (name.includes(kw)) return 'christian';
  }
  return undefined;
}
