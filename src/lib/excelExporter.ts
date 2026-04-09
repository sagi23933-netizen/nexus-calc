import ExcelJS from 'exceljs';
import type { MonthlyCalculation, Employee, AgreementParams } from '../types';
import { DOW_LABELS } from './calculationEngine';
import { MONTH_NAMES } from './constants';

const DT: Record<string, string> = {
  regular: 'רגיל', short: 'מקוצר', friday: 'שישי', saturday: 'שבת',
  rest_day: 'יום מנוחה', holiday: 'חג', eve_holiday: 'ע.חג', chol_hamoed: 'חוה"מ',
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const val = (n: number) => n > 0 ? r2(n) : null;

const CYAN_DARK = '0E7490';
const CYAN_MED = '0891B2';
const CYAN_LIGHT = 'ECFEFF';

const HEADER_BG = 'E0F2FE';
const YELLOW_BG = 'FEF9C3';
const BORDER_COLOR = 'CBD5E1';
const GRAY_LIGHT = 'F8FAFC';
const WHITE = 'FFFFFF';

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } };
const allBorders: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function sanitizeSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet';
}

export async function exportCalculationsToExcel(
  calculations: MonthlyCalculation[],
  employees: Employee[],
  agreements: AgreementParams[],
  year: number,
  month: number,
  mode: 'all' | 'single' = 'all',
  singleEmployeeId?: string,
) {
  const calcs = mode === 'single' && singleEmployeeId
    ? calculations.filter(c => c.year === year && c.month === month && c.employeeId === singleEmployeeId)
    : calculations.filter(c => c.year === year && c.month === month);

  if (calcs.length === 0) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEXUS GROUP';
  wb.created = new Date();

  const monthName = MONTH_NAMES[month - 1];
  const periodLabel = `${monthName} ${year}`;

  if (mode === 'all') {
    buildSummarySheet(wb, calcs, employees, agreements, periodLabel);
  }

  for (const calc of calcs) {
    const emp = employees.find(e => e.id === calc.employeeId);
    const agr = emp ? agreements.find(a => a.id === emp.agreementId) : null;
    buildEmployeeSheet(wb, calc, emp, agr, periodLabel);
  }

  const monthStr = String(month).padStart(2, '0');
  const filename = mode === 'single' && calcs.length === 1
    ? `NEXUS_${calcs[0].employeeNumber}_${year}_${monthStr}.xlsx`
    : `NEXUS_דוח_שכר_${year}_${monthStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


function styleHeaderCell(cell: ExcelJS.Cell, bg = HEADER_BG) {
  cell.font = { bold: true, size: 10, color: { argb: '1E293B' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.border = allBorders;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function styleSectionTitle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11, color: { argb: WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CYAN_MED } };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

function styleDataCell(cell: ExcelJS.Cell, isEven = false) {
  cell.font = { size: 10 };
  cell.border = allBorders;
  if (isEven) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_LIGHT } };
  }
  if (typeof cell.value === 'number') {
    cell.alignment = { horizontal: 'center' };
    cell.numFmt = '#,##0.00';
  }
}

function styleTotalCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: CYAN_DARK } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CYAN_LIGHT } };
  cell.border = allBorders;
  if (typeof cell.value === 'number') {
    cell.alignment = { horizontal: 'center' };
    cell.numFmt = '#,##0.00';
  }
}

function styleInfoLabel(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: '475569' } };
  cell.alignment = { horizontal: 'right' };
}

function styleInfoValue(cell: ExcelJS.Cell) {
  cell.font = { size: 10, color: { argb: '1E293B' } };
  cell.border = { bottom: thinBorder };
}

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  calcs: MonthlyCalculation[],
  employees: Employee[],
  _agreements: AgreementParams[],
  periodLabel: string,
) {
  const ws = wb.addWorksheet('סיכום חודשי', { views: [{ rightToLeft: true }] });

  ws.columns = [
    { width: 18 }, { width: 10 }, { width: 10 }, { width: 11 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 9 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 12 },
  ];

  let row = 1;

  ws.mergeCells(row, 1, row, 6);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = `דוח שכר חודשי — ${periodLabel}`;
  titleCell.font = { bold: true, size: 14, color: { argb: CYAN_DARK } };
  titleCell.alignment = { horizontal: 'right' };

  ws.mergeCells(row, 15, row, 17);
  const logoCell = ws.getCell(row, 15);
  logoCell.value = 'NEXUS GROUP';
  logoCell.font = { bold: true, size: 14, color: { argb: CYAN_DARK } };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
  logoCell.alignment = { horizontal: 'center' };
  ws.getRow(row).height = 28;
  row++;

  ws.mergeCells(row, 1, row, 5);
  const subCell = ws.getCell(row, 1);
  subCell.value = `הופק: ${new Date().toLocaleDateString('he-IL')} • ${calcs.length} עובדים`;
  subCell.font = { size: 9, color: { argb: '64748B' } };
  row += 2;

  const headers = [
    'שם העובד', 'מס\'', 'ימי עבודה', 'תקן חודשי', 'שעות בפועל', 'רגיל',
    'ש"נ 125%', 'ש"נ 150%', '150%', '175%', '200%',
    'קיזוז', 'מחלה (ימים)', 'חופשה (ימים)', 'יתרת מחלה', 'יתרת חופשה', 'משולמות',
  ];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 22;
  row++;

  for (let idx = 0; idx < calcs.length; idx++) {
    const c = calcs[idx];
    const emp = employees.find(e => e.id === c.employeeId);
    const name = emp ? `${emp.firstName} ${emp.lastName}` : c.employeeNumber;
    const isEven = idx % 2 === 1;

    const vals = [
      name, c.employeeNumber, c.actualWorkDays, r2(c.totalPlannedHours ?? 0), r2(c.totalActualWorkHours), r2(c.totalRegularHours),
      val(c.totalOvertime125Hours), val(c.totalOvertime150Hours),
      val(c.totalSaturdayHours), val(c.totalSaturdayOvertimeHours), val(c.totalSaturdayOvertime2Hours ?? 0),
      val(c.globalOvertimeOffsetTotal), val(c.totalSickDays), val(c.totalVacationDays),
      r2(c.endingSickBalance), r2(c.endingVacationBalance), r2(c.totalPaidHours),
    ];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      styleDataCell(cell, isEven);
    });
    row++;
  }

  row++;
  const totals = [
    'סה"כ', '', calcs.reduce((s, c) => s + c.actualWorkDays, 0),
    r2(calcs.reduce((s, c) => s + (c.totalPlannedHours ?? 0), 0)),
    r2(calcs.reduce((s, c) => s + c.totalActualWorkHours, 0)),
    r2(calcs.reduce((s, c) => s + c.totalRegularHours, 0)),
    r2(calcs.reduce((s, c) => s + c.totalOvertime125Hours, 0)),
    r2(calcs.reduce((s, c) => s + c.totalOvertime150Hours, 0)),
    r2(calcs.reduce((s, c) => s + c.totalSaturdayHours, 0)),
    null, null,
    r2(calcs.reduce((s, c) => s + c.globalOvertimeOffsetTotal, 0)),
    r2(calcs.reduce((s, c) => s + c.totalSickDays, 0)),
    r2(calcs.reduce((s, c) => s + c.totalVacationDays, 0)),
    null, null,
    r2(calcs.reduce((s, c) => s + c.totalPaidHours, 0)),
  ];
  totals.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    styleTotalCell(cell);
  });
}

function buildEmployeeSheet(
  wb: ExcelJS.Workbook,
  calc: MonthlyCalculation,
  emp: Employee | undefined,
  agr: AgreementParams | null | undefined,
  periodLabel: string,
) {
  const empName = emp ? `${emp.firstName} ${emp.lastName}` : calc.employeeNumber;
  const ws = wb.addWorksheet(sanitizeSheetName(empName), { views: [{ rightToLeft: true }] });

  ws.columns = [
    { width: 12 }, { width: 9 }, { width: 9 }, { width: 8 }, { width: 8 },
    { width: 9 }, { width: 9 }, { width: 8 }, { width: 9 }, { width: 7 },
    { width: 7 }, { width: 7 }, { width: 7 }, { width: 7 }, { width: 7 },
    { width: 8 }, { width: 7 }, { width: 8 }, { width: 30 },
  ];

  let row = 1;

  const logoCell = ws.getCell(row, 17);
  logoCell.value = 'NEXUS GROUP';
  logoCell.font = { bold: true, size: 14, color: { argb: CYAN_DARK } };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
  logoCell.alignment = { horizontal: 'center' };
  ws.mergeCells(row, 17, row, 19);

  ws.mergeCells(row, 1, row, 4);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'דוח חישוב שעות עבודה';
  titleCell.font = { bold: true, size: 13, color: { argb: CYAN_DARK } };
  titleCell.alignment = { horizontal: 'right' };
  ws.getRow(row).height = 28;
  row++;

  ws.mergeCells(row, 1, row, 3);
  const periodCell = ws.getCell(row, 1);
  periodCell.value = `תקופה: ${periodLabel}`;
  periodCell.font = { size: 10, color: { argb: '64748B' } };
  row += 2;

  ws.mergeCells(row, 1, row, 3);
  const infoTitle = ws.getCell(row, 1);
  infoTitle.value = 'פרטי עובד';
  styleSectionTitle(infoTitle);
  ws.getRow(row).height = 22;
  row++;

  const infoRows: [string, unknown, string, unknown][] = [
    ['שם:', empName, 'מספר עובד:', calc.employeeNumber],
    ['הסכם:', agr?.name ?? '', 'אחוז משרה:', emp ? `${emp.workPercentage}%` : '100%'],
    ['תקן יומי:', agr?.dailyHoursStandard ?? 8.5, 'ימים/שבוע:', agr?.workDaysPerWeek ?? 5],
  ];

  for (const [l1, v1, l2, v2] of infoRows) {
    const c1 = ws.getCell(row, 1); c1.value = l1; styleInfoLabel(c1);
    const c2 = ws.getCell(row, 2); c2.value = v1 as string; styleInfoValue(c2);
    const c3 = ws.getCell(row, 4); c3.value = l2; styleInfoLabel(c3);
    const c4 = ws.getCell(row, 5); c4.value = v2 as string; styleInfoValue(c4);
    row++;
  }
  row++;

  ws.mergeCells(row, 1, row, 3);
  const balTitle = ws.getCell(row, 1);
  balTitle.value = 'מעקב יתרות';
  styleSectionTitle(balTitle);
  ws.getRow(row).height = 22;
  row++;

  const balHeaders = ['', 'יתרת פתיחה', 'צבירה', 'ניצול', 'יתרת סגירה'];
  balHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell, CYAN_LIGHT);
  });
  row++;

  const sickVals = ['מחלה', r2(calc.openingSickBalance), r2(calc.sickDaysAccrued), r2(calc.totalSickDaysUsed), r2(calc.endingSickBalance)];
  sickVals.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    styleDataCell(cell);
    if (i === 0) cell.font = { bold: true, size: 10 };
  });
  row++;

  const vacVals = ['חופשה', r2(calc.openingVacationBalance), r2(calc.vacationDaysAccrued), r2(calc.totalVacationDaysUsed), r2(calc.endingVacationBalance)];
  vacVals.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    styleDataCell(cell, true);
    if (i === 0) cell.font = { bold: true, size: 10 };
  });
  row += 2;

  ws.mergeCells(row, 1, row, 3);
  const dayTitle = ws.getCell(row, 1);
  dayTitle.value = 'פירוט יומי';
  styleSectionTitle(dayTitle);
  ws.getRow(row).height = 22;
  row++;

  const dayHeaders = [
    'תאריך', 'יום', 'סוג יום', 'כניסה', 'יציאה', 'מתוכנן', 'בפועל', 'הפסקה',
    'רגיל', '100%+', '125%', '150%', '150%', '175%', '200%',
    'חופשה', 'מחלה', 'היעדרות', 'הערות',
  ];
  dayHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 22;
  row++;

  let dayIdx = 0;
  for (const d of calc.days) {
    const hasActivity = d.actualHours > 0 || d.sickHours > 0 || d.vacationHours > 0
      || d.absenceHours > 0 || d.saturdayHours > 0 || d.unpaidHours > 0;
    const isWeekend = d.dayType === 'saturday' || d.dayType === 'friday' || d.dayType === 'rest_day';
    if (!hasActivity && !isWeekend && d.plannedHours <= 0) continue;

    const isEven = dayIdx % 2 === 1;
    const isSat = d.dayType === 'saturday' || d.dayType === 'rest_day';

    const vals: (string | number | null)[] = [
      d.date, DOW_LABELS[d.dayOfWeek] ?? '', DT[d.dayType] ?? d.dayType,
      d.clockIn ?? null, d.clockOut ?? null,
      d.plannedHours > 0 ? r2(d.plannedHours) : null,
      d.actualHours > 0 ? r2(d.actualHours) : null,
      d.breakDeductedHours > 0 ? r2(d.breakDeductedHours) : null,
      val(d.regularHours), val(d.regularExtendedHours),
      val(d.overtime125Hours), val(d.overtime150Hours),
      val(d.saturdayHours), val(d.saturdayOvertimeHours), val(d.saturdayOvertime2Hours),
      val(d.vacationHours), val(d.sickHours), val(d.absenceHours),
      d.notes.length > 0 ? d.notes.join(' | ') : null,
    ];

    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      styleDataCell(cell, isEven);
      if (isSat && v !== null) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } };
      }
      if (i >= 10 && i <= 11 && typeof v === 'number') {
        cell.font = { size: 10, color: { argb: 'D97706' } };
      }
      if (i >= 12 && i <= 14 && typeof v === 'number') {
        cell.font = { size: 10, color: { argb: '7C3AED' } };
      }
    });
    row++;
    dayIdx++;
  }

  row++;
  const totalVals: (string | number | null)[] = [
    'סה"כ', null, null, null, null,
    r2(calc.totalPlannedHours ?? 0),
    r2(calc.totalActualWorkHours),
    r2(calc.days.reduce((s, d) => s + d.breakDeductedHours, 0)),
    r2(calc.totalRegularHours), val(calc.totalRegularExtendedHours),
    val(calc.totalOvertime125Hours), val(calc.totalOvertime150Hours),
    val(calc.totalSaturdayHours), val(calc.totalSaturdayOvertimeHours),
    val(calc.totalSaturdayOvertime2Hours ?? 0),
    val(calc.totalVacationHours), val(calc.totalSickHours), val(calc.totalAbsenceHours), null,
  ];
  totalVals.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    styleTotalCell(cell);
  });
  ws.getRow(row).height = 22;
  row += 2;

  ws.mergeCells(row, 1, row, 3);
  const sumTitle = ws.getCell(row, 1);
  sumTitle.value = 'סיכום חודשי';
  styleSectionTitle(sumTitle);
  ws.getRow(row).height = 22;
  row++;

  const metrics: [string, unknown, string, unknown][] = [
    ['ימי עבודה בפועל:', calc.actualWorkDays, 'ימי עבודה למס:', calc.taxWorkDays],
    ['תקן חודשי:', r2(calc.totalPlannedHours ?? 0), 'שעות בפועל:', r2(calc.totalActualWorkHours)],
    ['שעות משולמות:', r2(calc.totalPaidHours), 'סה"כ קיזוז:', r2(calc.globalOvertimeOffsetTotal)],
    ['סה"כ שעות נוספות:', r2(calc.totalOvertime125Hours + calc.totalOvertime150Hours), 'סה"כ 150%+:', r2(calc.totalSaturdayHours + calc.totalSaturdayOvertimeHours + (calc.totalSaturdayOvertime2Hours ?? 0))],
  ];

  for (const [l1, v1, l2, v2] of metrics) {
    const c1 = ws.getCell(row, 1); c1.value = l1; styleInfoLabel(c1);
    const c2 = ws.getCell(row, 2); c2.value = v1 as number; styleInfoValue(c2);
    if (typeof c2.value === 'number') c2.numFmt = '#,##0.00';
    const c3 = ws.getCell(row, 4); c3.value = l2; styleInfoLabel(c3);
    const c4 = ws.getCell(row, 5); c4.value = v2 as number; styleInfoValue(c4);
    if (typeof c4.value === 'number') c4.numFmt = '#,##0.00';
    row++;
  }

  if (calc.compensatoryRestDays) {
    const c1 = ws.getCell(row, 1); c1.value = 'ימי מנוחת פיצוי:'; styleInfoLabel(c1);
    const c2 = ws.getCell(row, 2); c2.value = calc.compensatoryRestDays; styleInfoValue(c2);
    row++;
  }

  row += 2;
  ws.mergeCells(row, 1, row, 5);
  const footerCell = ws.getCell(row, 1);
  footerCell.value = `הופק ע"י מערכת NEXUS GROUP | ${new Date().toLocaleString('he-IL')}`;
  footerCell.font = { size: 8, italic: true, color: { argb: '94A3B8' } };
}
