import * as XLSX from 'xlsx';
import type { AttendanceRecord, AttendanceColumnMapping, AbsenceType, Employee } from '../types';
import { generateId } from './utils';

export interface ParsedRow {
  [key: string]: string | number | null;
}

export function readExcelFile(file: File, maxHeaderScanRows = 10): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];

        if (!jsonData || jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(jsonData.length, maxHeaderScanRows); i++) {
          const row = jsonData[i];
          const nonEmpty = row.filter(cell => cell !== '' && cell != null).length;
          if (nonEmpty >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        const rawHeaders = (jsonData[headerRowIndex] as (string | number)[]).map(h => String(h ?? '').trim());
        const headerPairs: { header: string; originalIndex: number }[] = rawHeaders
          .map((h, i) => ({ header: h, originalIndex: i }))
          .filter(p => p.header.length > 0);
        const headers = headerPairs.map(p => p.header);

        const rows: ParsedRow[] = jsonData.slice(headerRowIndex + 1)
          .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
          .map(row => {
            const obj: ParsedRow = {};
            headerPairs.forEach(({ header, originalIndex }) => {
              obj[header] = row[originalIndex] ?? null;
            });
            return obj;
          });

        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseDate(value: string | number | null): string {
  if (!value) return '';

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  const str = String(value).trim();

  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  const yyyymmdd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
  }

  return str;
}

function parseTime(value: string | number | null): string {
  if (!value) return '';

  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return str;
}

function parseHours(value: string | number | null): number {
  if (!value) return 0;
  if (typeof value === 'number') return Math.round(value * 100) / 100;

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return parseInt(match[1]) + parseInt(match[2]) / 60;

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseAbsenceType(value: string | number | null): AbsenceType | undefined {
  if (!value) return undefined;
  const str = String(value).trim().toLowerCase();

  const mapping: Record<string, AbsenceType> = {
    'חופשה': 'vacation', 'vacation': 'vacation', 'v': 'vacation',
    'מחלה': 'sick', 'sick': 'sick', 's': 'sick',
    'חצי מחלה': 'sick_half', 'sick_half': 'sick_half',
    'מילואים': 'reserve', 'reserve': 'reserve', 'r': 'reserve',
    'ללא תשלום': 'unpaid', 'unpaid': 'unpaid',
    'אבל': 'bereavement', 'bereavement': 'bereavement',
    'תאונת עבודה': 'work_accident', 'work_accident': 'work_accident',
    'שעות הריון': 'pregnancy_hours',
    'לידה': 'maternity', 'חל"ד': 'maternity',
    'היעדרות מאושרת': 'authorized', 'authorized': 'authorized',
    'חופשה חלקית': 'vacation_partial', 'vacation_partial': 'vacation_partial',
    'עבודה בחג': 'holiday_work', 'holiday_work': 'holiday_work',
    'שעת הורות': 'parental_hour', 'parental_hour': 'parental_hour',
    'מחלה ללא תשלום': 'sick_no_pay', 'sick_no_pay': 'sick_no_pay',
    'קיזוז שנ גלובלי': 'offset_overtime', 'קיזוז ש"נ גלובלי': 'offset_overtime', 'offset_overtime': 'offset_overtime',
    'אחר': 'other', 'other': 'other',
  };

  return mapping[str] || undefined;
}

export function convertRowsToAttendance(
  rows: ParsedRow[],
  mapping: AttendanceColumnMapping,
  employees: Employee[]
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];

  for (const row of rows) {
    const empNumRaw = row[mapping.employeeNumber];
    if (!empNumRaw) continue;

    const empNum = String(empNumRaw).trim();
    const employee = employees.find(e => e.employeeNumber === empNum || e.id === empNum);
    if (!employee) continue;

    const dateStr = parseDate(mapping.date ? row[mapping.date] : null);
    if (!dateStr) continue;

    const clockIn = mapping.clockIn ? parseTime(row[mapping.clockIn]) : undefined;
    const clockOut = mapping.clockOut ? parseTime(row[mapping.clockOut]) : undefined;
    const actualHoursRaw = mapping.actualHours ? parseHours(row[mapping.actualHours]) : 0;
    const absenceTypeRaw = mapping.absenceType ? parseAbsenceType(row[mapping.absenceType]) : undefined;
    const absenceHoursRaw = mapping.absenceHours ? parseHours(row[mapping.absenceHours]) : 0;
    const notes = mapping.notes && row[mapping.notes] ? String(row[mapping.notes]) : undefined;

    let actualHours = actualHoursRaw;
    if (!actualHours && clockIn && clockOut) {
      const inH = parseInt(clockIn.split(':')[0]) + parseInt(clockIn.split(':')[1]) / 60;
      const outH = parseInt(clockOut.split(':')[0]) + parseInt(clockOut.split(':')[1]) / 60;
      actualHours = outH < inH ? (24 - inH + outH) : (outH - inH);
    }

    records.push({
      id: generateId(),
      employeeId: employee.id,
      date: dateStr,
      clockIn: clockIn || undefined,
      clockOut: clockOut || undefined,
      actualHours: actualHours || undefined,
      absenceType: absenceTypeRaw,
      absenceHours: absenceHoursRaw || undefined,
      notes,
      isManual: false,
    });
  }

  return records;
}


interface ReportDetectResult {
  isReport: true;
  employeeNumber: string;
  employeeName: string;
  records: AttendanceRecord[];
}

export function detectAndParseReport(
  file: File,
  employees: Employee[]
): Promise<ReportDetectResult | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];

        if (!raw || raw.length < 10) { resolve(null); return; }

        let empRowIdx = -1;
        let empNumber = '';
        let empName = '';
        for (let i = 0; i < Math.min(10, raw.length); i++) {
          const row = raw[i];
          for (let c = 0; c < row.length; c++) {
            if (String(row[c]).trim() === 'עובד') {
              empRowIdx = i;
              empNumber = String(row[c + 1] ?? '').trim();
              const part1 = String(row[c + 2] ?? '').trim();
              const part2 = String(row[c + 3] ?? '').trim();
              empName = `${part2} ${part1}`.trim();
              break;
            }
          }
          if (empRowIdx >= 0) break;
        }

        if (empRowIdx < 0) { resolve(null); return; }

        const employee = employees.find(emp =>
          emp.employeeNumber === empNumber ||
          emp.employeeNumber === empNumber.padStart(7, '0')
        );
        if (!employee) {
          resolve({
            isReport: true,
            employeeNumber: empNumber,
            employeeName: empName,
            records: [],
          });
          return;
        }

        let headerRowIdx = -1;
        for (let i = empRowIdx + 1; i < Math.min(empRowIdx + 5, raw.length); i++) {
          const rowStr = raw[i].map(c => String(c).trim());
          if (rowStr.includes('תאריך') && rowStr.includes('כניסה')) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx < 0) { resolve(null); return; }

        const hRow = raw[headerRowIdx].map(c => String(c).trim());
        let dateCol = -1, dayTypeCol = -1, agreementCol = -1;
        let clockIn1Col = -1, clockOut1Col = -1, clockIn2Col = -1, clockOut2Col = -1;
        let actualHoursCol = -1;
        let absenceCol = -1;

        let clockInCount = 0;
        for (let c = 0; c < hRow.length; c++) {
          const h = hRow[c];
          if (h === 'תאריך') dateCol = c;
          else if (h === 'סוג' || (h === '' && dateCol >= 0 && dayTypeCol < 0 && c === dateCol + 2)) dayTypeCol = c;
          else if (h === 'מספר') agreementCol = c;
          else if (h === 'כניסה') {
            clockInCount++;
            if (clockInCount === 1) clockIn1Col = c;
            else if (clockInCount === 2) clockIn2Col = c;
          } else if (h === 'יציאה') {
            if (clockIn1Col >= 0 && clockOut1Col < 0) clockOut1Col = c;
            else if (clockIn2Col >= 0 && clockOut2Col < 0) clockOut2Col = c;
          }
        }

        const subRow2 = headerRowIdx + 2 < raw.length
          ? raw[headerRowIdx + 2].map(c => String(c).trim())
          : [];

        for (let c = 0; c < subRow2.length; c++) {
          const h = subRow2[c];
          if (h === 'בפועל') actualHoursCol = c;
          else if (h === 'העדרות') absenceCol = c;
        }

        if (actualHoursCol < 0) {
          const subRow1 = headerRowIdx + 1 < raw.length
            ? raw[headerRowIdx + 1].map(c => String(c).trim())
            : [];
          for (let c = 0; c < subRow1.length; c++) {
            if (subRow1[c] === 'שעות' && subRow2[c] === 'בפועל') actualHoursCol = c;
          }
        }

        if (dayTypeCol < 0) {
          const hRow2 = headerRowIdx + 1 < raw.length
            ? raw[headerRowIdx + 1].map(c => String(c).trim())
            : [];
          for (let c = 0; c < hRow2.length; c++) {
            if (hRow2[c] === 'יום' && c > dateCol) { dayTypeCol = c; break; }
          }
        }

        const dataStart = headerRowIdx + 3;
        const records: AttendanceRecord[] = [];

        for (let r = dataStart; r < raw.length; r++) {
          const row = raw[r];
          if (!row || row.length === 0) continue;

          const dateVal = row[dateCol];
          if (typeof dateVal !== 'number' || dateVal < 1000) break;
          
          const dateStr = parseDate(dateVal);
          if (!dateStr) continue;

          const codeVal = row[agreementCol >= 0 ? agreementCol : dateCol + 3];
          const code = typeof codeVal === 'number' ? codeVal : 0;
          if (code === 7 || code === 9) {
            const ahVal = actualHoursCol >= 0 ? row[actualHoursCol] : 0;
            const hours = typeof ahVal === 'number' ? ahVal : 0;
            const ci = clockIn1Col >= 0 ? row[clockIn1Col] : '';
            const co = clockOut1Col >= 0 ? row[clockOut1Col] : '';
            const hasClockTimes = (typeof ci === 'number' && ci > 0) || (typeof co === 'number' && co > 0);
            if (hours <= 0 && !hasClockTimes) continue;
          }

          let absenceType: AbsenceType | undefined;
          if (code === 101) {
            const absText = String(row[clockIn1Col] ?? '').trim();
            if (absText.includes('חופש') || absText.includes('חופשה')) {
              absenceType = 'vacation';
            } else if (absText.includes('מחלה')) {
              absenceType = 'sick';
            } else if (absText.includes('מילואים')) {
              absenceType = 'reserve';
            } else {
              absenceType = 'vacation';
            }
          }

          let clockIn = '';
          let clockOut = '';
          const ci1 = row[clockIn1Col];
          const co1 = row[clockOut1Col];

          if (typeof ci1 === 'number' && ci1 > 0 && ci1 < 1) {
            clockIn = parseTime(ci1);
          }
          if (typeof co1 === 'number' && co1 > 0 && co1 < 1) {
            clockOut = parseTime(co1);
          }

          if (clockOut2Col >= 0) {
            const co2 = row[clockOut2Col];
            if (typeof co2 === 'number' && co2 > 0 && co2 < 1) {
              clockOut = parseTime(co2);
            }
          }

          let actualHours = 0;
          const ahCol = actualHoursCol >= 0 ? actualHoursCol : -1;
          if (ahCol >= 0) {
            const ahVal = row[ahCol];
            if (typeof ahVal === 'number') actualHours = Math.round(ahVal * 100) / 100;
          }

          let absenceHours = 0;
          if (absenceCol >= 0 && !absenceType) {
            const abVal = row[absenceCol];
            if (typeof abVal === 'number' && abVal > 0) {
              absenceHours = Math.round(abVal * 100) / 100;
            }
          }

          if (absenceType && actualHours === 0 && absenceHours === 0) {
            const stdCol = actualHoursCol >= 0 ? actualHoursCol - 1 : -1;
            if (stdCol >= 0) {
              const stdVal = row[stdCol];
              if (typeof stdVal === 'number' && stdVal > 0) absenceHours = stdVal;
            }
          }

          records.push({
            id: generateId(),
            employeeId: employee.id,
            date: dateStr,
            clockIn: clockIn || undefined,
            clockOut: clockOut || undefined,
            actualHours: actualHours || undefined,
            absenceType,
            absenceHours: absenceHours || undefined,
            notes: undefined,
            isManual: false,
          });
        }

        resolve({
          isReport: true,
          employeeNumber: empNumber,
          employeeName: empName,
          records,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function readEmployeesFromExcel(file: File): Promise<Partial<Employee>[]> {
  return readExcelFile(file).then(({ rows }) => {
    return rows.map(row => {
      const emp: Partial<Employee> = {
        id: generateId(),
        employeeNumber: String(row['מספר עובד'] ?? row['employee_number'] ?? row['ID'] ?? '').trim(),
        firstName: String(row['שם פרטי'] ?? row['first_name'] ?? row['FirstName'] ?? '').trim(),
        lastName: String(row['שם משפחה'] ?? row['last_name'] ?? row['LastName'] ?? '').trim(),
        department: String(row['מחלקה'] ?? row['department'] ?? '').trim(),
        isActive: true,
        workPercentage: parseFloat(String(row['אחוז משרה'] ?? row['work_percentage'] ?? '100')) || 100,
        sickDaysBalance: parseFloat(String(row['יתרת מחלה'] ?? '0')) || 0,
        vacationDaysBalance: parseFloat(String(row['יתרת חופשה'] ?? '0')) || 0,
      };
      return emp;
    }).filter(e => e.employeeNumber);
  });
}
