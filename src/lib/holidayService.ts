import type { Holiday, Religion } from '../types';
import { generateId } from './utils';


const API_KEY = import.meta.env.VITE_CALENDARIFIC_API_KEY || '';
const BASE_URL = 'https://calendarific.com/api/v2/holidays';

interface CalendarificHoliday {
  name: string;
  date: { iso: string };
  type: string[];
}

interface CalendarificResponse {
  meta: { code: number };
  response: { holidays: CalendarificHoliday[] };
}


const HEBREW_NAMES: Record<string, string> = {
  "New Year's Day": 'ראש השנה לועזי',
  "Tu Bishvat": 'ט"ו בשבט',
  "Fast of Esther": 'תענית אסתר',
  "Purim Eve": 'ערב פורים',
  "Purim": 'פורים',
  "Shushan Purim": 'שושן פורים',
  "Passover Eve": 'ערב פסח',
  "Passover (Day 1)": 'פסח (יום א\')',
  "Passover (Day 2)": 'חוה"מ פסח (ב\')',
  "Passover (Day 3)": 'חוה"מ פסח (ג\')',
  "Passover (Day 4)": 'חוה"מ פסח (ד\')',
  "Passover (Day 5)": 'חוה"מ פסח (ה\')',
  "Passover (Day 6)": 'חוה"מ פסח (ו\')',
  "Passover (Day 7)": 'שביעי של פסח',
  "Mimouna Day": 'מימונה',
  "Yom HaShoah": 'יום השואה',
  "Yom HaZikaron": 'יום הזיכרון',
  "Yom HaAtzmaut": 'יום העצמאות',
  "Lag BaOmer": 'ל"ג בעומר',
  "Jerusalem Day": 'יום ירושלים',
  "Memorial Day for Ethiopian Jews": 'יום הזיכרון ליהודי אתיופיה',
  "Shavuot Eve": 'ערב שבועות',
  "Shavuot": 'שבועות',
  "17th of Tammuz": 'י"ז בתמוז',
  "Tisha B'Av Eve": 'ערב תשעה באב',
  "Tisha B'Av": 'תשעה באב',
  "Rosh Hashana Eve": 'ערב ראש השנה',
  "Rosh Hashana": 'ראש השנה (יום א\')',
  "Rosh Hashana (Day 2)": 'ראש השנה (יום ב\')',
  "Gedaliah Fast": 'צום גדליה',
  "Yom Kippur Eve": 'ערב יום כיפור',
  "Yom Kippur": 'יום כיפור',
  "Sukkot Eve": 'ערב סוכות',
  "Sukkot (Day 1)": 'סוכות (יום א\')',
  "Sukkot (Day 2)": 'חוה"מ סוכות (ב\')',
  "Sukkot (Day 3)": 'חוה"מ סוכות (ג\')',
  "Sukkot (Day 4)": 'חוה"מ סוכות (ד\')',
  "Sukkot (Day 5)": 'חוה"מ סוכות (ה\')',
  "Sukkot (Day 6)": 'חוה"מ סוכות (ו\')',
  "Sukkot (Day 7) / Hoshanah Rabah": 'הושענא רבה',
  "Shemini Atzeret / Simchat Torah": 'שמיני עצרת / שמחת תורה',
  "Sigd": 'סיגד',
  "Hanukkah (Day 1)": 'חנוכה (נר א\')',
  "Hanukkah (Day 2)": 'חנוכה (נר ב\')',
  "Hanukkah (Day 3)": 'חנוכה (נר ג\')',
  "Hanukkah (Day 4)": 'חנוכה (נר ד\')',
  "Hanukkah (Day 5)": 'חנוכה (נר ה\')',
  "Hanukkah (Day 6) / Rosh Chodesh Tevet": 'חנוכה (נר ו\')',
  "Hanukkah (Day 7)": 'חנוכה (נר ז\')',
  "Hanukkah (Day 8)": 'חנוכה (נר ח\')',
  "Asarah B'Tevet (Tenth of Tevet)": 'עשרה בטבת',
  "Aliyah Day": 'יום העלייה',

  "Ramadan begins": 'תחילת רמדאן',
  "Eid al-Fitr Eve": 'ערב עיד אל-פיטר',
  "Eid al-Fitr": 'עיד אל-פיטר',
  "Eid al-Fitr Holiday": 'עיד אל-פיטר (חופשה)',
  "Eid al-Adha Eve": 'ערב עיד אל-אדחא',
  "Eid al-Adha": 'עיד אל-אדחא',
  "Eid al-Adha Holiday": 'עיד אל-אדחא (חופשה)',
  "Al Isra' wal Miraj": 'אל-איסרא וואל-מעראג\'',
  "Muharram Eve": 'ערב מוחרם',
  "Muharram": 'ראש השנה המוסלמי',
  "Prophet's Birthday Eve": 'ערב מולד הנביא',
  "Prophet's Birthday": 'מולד הנביא',

  "Catholic/Protestant Christmas Eve": 'ערב חג המולד',
  "Catholic/Protestant Christmas Day": 'חג המולד',
  "Catholic/Protestant Boxing Day": 'יום המתנות',
  "Catholic/Protestant Epiphany Eve": 'ערב התגלות',
  "Catholic/Protestant Epiphany": 'חג ההתגלות',
  "Orthodox Christmas Eve": 'ערב חג המולד (אורתודוכסי)',
  "Orthodox Christmas Day": 'חג המולד (אורתודוכסי)',
  "Orthodox Christmas Holiday": 'חג המולד (אורתודוכסי) — חופשה',
  "Orthodox New Year's Eve": 'ערב ראש השנה (אורתודוכסי)',
  "Orthodox New Year": 'ראש השנה (אורתודוכסי)',
  "Catholic/Protestant Palm Sunday": 'יום הדקלים',
  "Catholic/Protestant Maundy Thursday": 'יום חמישי הקדוש',
  "Catholic/Protestant Good Friday": 'יום שישי הטוב',
  "Catholic/Protestant Holy Saturday": 'שבת הקודש',
  "Catholic/Protestant Easter Sunday": 'חג הפסחא',
  "Catholic/Protestant Easter Monday": 'שני של פסחא',
  "Armenian/Orthodox Palm Sunday": 'יום הדקלים (ארמני)',
  "Armenian/Orthodox Maundy Thursday": 'יום חמישי הקדוש (ארמני)',
  "Armenian/Orthodox Good Friday": 'יום שישי הטוב (ארמני)',
  "Armenian/Orthodox Holy Saturday": 'שבת הקודש (ארמנית)',
  "Armenian/Orthodox Easter Sunday": 'חג הפסחא (ארמני)',
  "Armenian/Orthodox Easter Monday": 'שני של פסחא (ארמני)',
  "Catholic/Protestant Feast of the Annunciation": 'חג הבשורה',
  "Orthodox Feast of the Annunciation": 'חג הבשורה (אורתודוכסי)',
  "Armenian Feast of the Annunciation": 'חג הבשורה (ארמני)',
  "Catholic/Protestant Ascension Eve": 'ערב העלייה לשמיים',
  "Catholic/Protestant Ascension Day": 'חג העלייה לשמיים',
  "Armenian/Orthodox Ascension Eve": 'ערב העלייה (ארמני)',
  "Armenian/Orthodox Ascension Day": 'חג העלייה (ארמני)',
  "Catholic/Protestant Pentecost Eve": 'ערב שבועון',
  "Catholic/Protestant Pentecost": 'חג השבועון',
  "Catholic/Protestant Pentecost Monday": 'שני של שבועון',
  "Armenian/Orthodox Pentecost Eve": 'ערב שבועון (ארמני)',
  "Armenian/Orthodox Pentecost": 'חג השבועון (ארמני)',
  "Armenian/Orthodox Pentecost Monday": 'שני של שבועון (ארמני)',
  "Orthodox Epiphany Eve": 'ערב התגלות (אורתודוכסי)',
  "Orthodox Epiphany Day": 'חג ההתגלות (אורתודוכסי)',
  "Armenian Christmas Eve": 'ערב חג המולד (ארמני)',
  "Armenian Christmas Day": 'חג המולד (ארמני)',
  "Armenian Christmas Holiday": 'חג המולד (ארמני) — חופשה',
  "New Year's Eve": 'ערב שנה חדשה',

  "Prophet Shuaib's Feast Eve": 'ערב חג נבי שועייב',
  "Prophet Shuaib's Feast": 'חג נבי שועייב',
  "Prophet Shuaib's Feast Holiday": 'חג נבי שועייב (חופשה)',
  "Feast of Prophet Sabalan Eve": 'ערב חג נבי סבלאן',
  "Feast of Prophet Sabalan": 'חג נבי סבלאן',
  "Eid al-Khader Eve": 'ערב עיד אל-ח\'אדר',
  "Eid al-Khader": 'עיד אל-ח\'אדר',

  "International Women's Day": 'יום האישה הבינלאומי',
  "May Day": 'אחד במאי',
  "Victory Day over Nazi Germany": 'יום הניצחון על גרמניה הנאצית',
  "First Day of School Year": 'יום פתיחת שנת הלימודים',
};

function translateName(englishName: string): string {
  return HEBREW_NAMES[englishName] || englishName;
}


function mapTypeToReligion(types: string[]): Religion | undefined {
  const lower = types.map(t => t.toLowerCase());
  if (lower.includes('hebrew')) return 'jewish';
  if (lower.includes('muslim')) return 'muslim';
  if (lower.includes('christian') || lower.includes('orthodox')) return 'christian';
  return undefined;
}

function isDruzeHoliday(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('shuaib') || lower.includes('sabalan') || lower.includes('khader');
}


function isRelevantOptionalHoliday(name: string, types: string[]): boolean {
  const lower = types.map(t => t.toLowerCase());
  if (!lower.includes('optional holiday')) return false;
  const n = name.toLowerCase();
  if (n.includes('passover eve') || n.includes('shavuot eve') || n.includes('rosh hashana eve')
    || n.includes('yom kippur eve') || n.includes('sukkot eve')) return true;
  if (lower.includes('muslim') || lower.includes('christian') || lower.includes('orthodox')) return true;
  if (isDruzeHoliday(name)) return true;
  return false;
}

function isEveHoliday(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes(' eve') && !lower.includes('new year\'s eve');
}

function isCholHamoed(name: string): boolean {
  const lower = name.toLowerCase();
  const passoverCholMatch = lower.match(/passover \(day ([2-6])\)/);
  const sukkotCholMatch = lower.match(/sukkot \(day ([2-7])\)/);
  return !!(passoverCholMatch || sukkotCholMatch);
}

function isNationalHoliday(types: string[]): boolean {
  return types.some(t => t.toLowerCase() === 'national holiday');
}

const holidayCache = new Map<number, Holiday[]>();

export async function fetchHolidaysFromAPI(year: number): Promise<Holiday[]> {
  holidayCache.delete(year);

  const url = `${BASE_URL}?country=IL&year=${year}&api_key=${API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Calendarific API error: ${response.status}`);
    }

    const data: CalendarificResponse = await response.json();
    if (data.meta.code !== 200) {
      throw new Error(`Calendarific API returned code ${data.meta.code}`);
    }

    const holidays: Holiday[] = [];
    const seen = new Set<string>();

    for (const h of data.response.holidays) {
      const lower = h.type.map(t => t.toLowerCase());
      if (!lower.includes('national holiday') && !lower.includes('optional holiday')) continue;

      const dateIso = h.date.iso.split('T')[0];
      const key = `${dateIso}:${h.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let religion: Religion | undefined = mapTypeToReligion(h.type);
      if (!religion && isDruzeHoliday(h.name)) {
        religion = 'druze';
      }

      const national = isNationalHoliday(h.type);
      const eve = isEveHoliday(h.name);
      const cholHamoed = isCholHamoed(h.name);
      const isOptionalOnly = !national && !isRelevantOptionalHoliday(h.name, h.type) && !cholHamoed;

      holidays.push({
        id: generateId(),
        date: dateIso,
        name: translateName(h.name),
        isEveHoliday: eve,
        isCholHamoed: cholHamoed,
        isHolidayWork: isOptionalOnly,
        religion: national ? undefined : religion,
      });
    }

    holidayCache.set(year, holidays);
    return holidays;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Calendarific API timeout (8s) for year ${year}`);
    }
    throw err;
  }
}

export async function ensureHolidaysForYear(
  year: number,
  currentHolidays: Holiday[],
  dispatch: (action: { type: 'SET_HOLIDAYS'; payload: Holiday[] }) => void,
): Promise<Holiday[]> {
  const yearPrefix = `${year}-`;
  const yearHolidays = currentHolidays.filter(h => h.date.startsWith(yearPrefix));

  const hasUntranslated = yearHolidays.some(h => /[a-zA-Z]{3,}/.test(h.name));
  if (yearHolidays.length > 0 && !hasUntranslated) return currentHolidays;

  const fetched = await fetchHolidaysFromAPI(year);
  const otherYears = currentHolidays.filter(h => !h.date.startsWith(yearPrefix));
  const merged = [...otherYears, ...fetched];
  dispatch({ type: 'SET_HOLIDAYS', payload: merged });
  return merged;
}

export function filterHolidaysForEmployee(
  holidays: Holiday[],
  religion?: Religion,
): Holiday[] {
  return holidays.filter(h => {
    if (h.isHolidayWork) return false;
    if (!h.religion) return true;
    if (!religion) return false;
    return h.religion === religion;
  });
}

export function getHolidayNameForDate(holidays: Holiday[], date: string): string | undefined {
  const matches = holidays.filter(h => h.date === date);
  if (matches.length === 0) return undefined;
  return matches.map(h => h.name).join(' / ');
}
