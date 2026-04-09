import type { MonthlyCalculation, ComponentMapping } from '../types';


const RECORD_LENGTH = 126;

function padNum(value: number, width: number = 7): string {
  const isNeg = value < 0;
  const absVal = Math.abs(value);
  let intRep = Math.round(absVal * 100);

  const maxVal = Math.pow(10, width) - 1;
  if (intRep > maxVal) {
    console.warn(
      `padNum overflow: value ${value} (intRep=${intRep}) exceeds max ${maxVal} for width ${width} — clamping`
    );
    intRep = maxVal;
  }

  let str = String(intRep).padStart(width, '0');

  if (isNeg) {
    const negMap: Record<string, string> = {
      '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E',
      '5': 'F', '6': 'G', '7': 'H', '8': 'I', '9': 'J'
    };
    const lastChar = str[str.length - 1];
    str = str.slice(0, -1) + (negMap[lastChar] ?? lastChar);
  }

  return str.slice(-width);
}

function spaces(n: number): string {
  return ' '.repeat(n);
}

function buildRecord(fields: string): string {
  const padded = fields.padEnd(RECORD_LENGTH, ' ').slice(0, RECORD_LENGTH);
  return padded + '\r\n';
}


function buildRecord0(calc: MonthlyCalculation): string {
  const empNum = calc.employeeNumber.padStart(7, '0').slice(-7);
  const month = String(calc.month).padStart(2, '0');
  const fields =
    empNum +
    month +
    '0' +
    spaces(3) +
    padNum(calc.totalSickDays) +
    padNum(calc.totalVacationDays) +
    padNum(calc.totalReserveDays) +
    spaces(21) +
    padNum(calc.totalActualWorkHours) +
    padNum(calc.taxWorkDays) +
    padNum(calc.paidWorkDays) +
    padNum(calc.actualWorkDays) +
    padNum(calc.totalPaidHours);

  return buildRecord(fields);
}


function buildRecord1(
  empNum: string,
  month: string,
  componentNumber: string,
  quantity: number,
  rate: number = 0,
  recordType: string = '1'
): string {
  const fields =
    empNum.padStart(7, '0').slice(-7) +
    month +
    recordType +
    componentNumber.padStart(3, '0').slice(-3) +
    padNum(quantity) +
    padNum(rate);

  return buildRecord(fields);
}


function buildEOF(): string {
  return '9'.padEnd(RECORD_LENGTH, ' ') + '\r\n';
}

export function generateTamalDat(
  calculations: MonthlyCalculation[],
  componentMappings: ComponentMapping[],
  year: number,
  month: number,
  employees?: { id: string; department?: string }[]
): string {
  const lines: string[] = [];
  const monthStr = String(month).padStart(2, '0');

  const filteredCalcs = calculations.filter(
    c => c.year === year && c.month === month
  );

  const addRecord = (record: string) => {
    const errors = validateRecord(record);
    if (errors.length > 0) {
      console.warn('TAMAL record validation errors:', errors, record);
      return;
    }
    lines.push(record);
  };

  for (const calc of filteredCalcs) {
    const empNum = calc.employeeNumber.padStart(7, '0').slice(-7);

    addRecord(buildRecord0(calc));

    const getMapping = (key: string) =>
      componentMappings.find(m => m.internalKey === key && m.enabled);

    if (calc.totalOvertime125Hours > 0) {
      const m = getMapping('overtime125');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalOvertime125Hours, 0, m.recordType));
    }

    if (calc.totalOvertime150Hours > 0) {
      const m = getMapping('overtime150');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalOvertime150Hours, 0, m.recordType));
    }

    if (calc.totalSaturdayHours > 0) {
      const m = getMapping('saturdayHours');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalSaturdayHours, 0, m.recordType));
    }

    if (calc.totalAbsenceHours > 0) {
      const m = getMapping('absenceDeduct');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalAbsenceHours, 0, m.recordType));
    }

    if (calc.totalSickHours > 0) {
      const m = getMapping('sickPay');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalSickHours, 0, m.recordType));
    }

    if (calc.totalVacationHours > 0) {
      const m = getMapping('vacationPay');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalVacationHours, 0, m.recordType));
    }

    if (calc.totalReserveDays > 0) {
      const m = getMapping('reservePay');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalReserveDays, 0, m.recordType));
    }

    if (calc.totalUnpaidHours > 0) {
      const m = getMapping('unpaidDeduct');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalUnpaidHours, 0, m.recordType));
    }

    if (calc.globalOvertimeBalance > 0 || calc.globalOvertimeOffsetTotal > 0) {
      const m = getMapping('globalOTBalance');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.globalOvertimeBalance, 0, m.recordType));
    }

    if (calc.totalSaturdayOvertimeHours > 0) {
      const m = getMapping('saturdayOvertime');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalSaturdayOvertimeHours, 0, m.recordType));
    }

    if (calc.totalEveHolidayBonusHours > 0) {
      const m = getMapping('eveHolidayBonus');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.totalEveHolidayBonusHours, 0, m.recordType));
    }

    if (calc.vacation4PercentAmount && calc.vacation4PercentAmount > 0) {
      const m = getMapping('vacation4Percent');
      if (m) addRecord(buildRecord1(empNum, monthStr, m.componentNumber, calc.vacation4PercentAmount, 0, m.recordType));
    }

    if (employees) {
      const emp = employees.find(e => e.id === calc.employeeId);
      if (emp?.department && /^\d+$/.test(emp.department)) {
        const deptNum = emp.department.padStart(4, '0').slice(-4);
        const fields =
          empNum +
          monthStr +
          '6' +
          '001' +
          padNum(1) +
          padNum(0) +
          deptNum;
        addRecord(buildRecord(fields));
      }
    }
  }

  addRecord(buildEOF());

  return lines.join('');
}

function encodeWindows1255(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code >= 0x05D0 && code <= 0x05EA) {
      bytes.push(code - 0x05D0 + 0xE0);
    } else if (code === 0x05F0) bytes.push(0xD0);
    else if (code === 0x05F1) bytes.push(0xD1);
    else if (code === 0x05F2) bytes.push(0xD2);
    else if (code === 0x20AA) bytes.push(0xDB);
    else if (code === 0x2013) bytes.push(0x96);
    else if (code === 0x2014) bytes.push(0x97);
    else if (code === 0x2018) bytes.push(0x91);
    else if (code === 0x2019) bytes.push(0x92);
    else if (code === 0x201C) bytes.push(0x93);
    else if (code === 0x201D) bytes.push(0x94);
    else if (code === 0x2026) bytes.push(0x85);
    else bytes.push(0x3F);
  }
  return new Uint8Array(bytes);
}

export function downloadTamalFile(content: string, year: number, month: number): void {
  const encoded = encodeWindows1255(content);
  const blob = new Blob([new Uint8Array(encoded)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TAMAL-5_${year}_${String(month).padStart(2, '0')}.DAT`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateRecord(record: string): string[] {
  const errors: string[] = [];
  if (record.length !== 128) {
    errors.push(`אורך רשומה שגוי: ${record.length} (צפוי: 128)`);
  }
  return errors;
}
