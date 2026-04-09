import type {
  Employee, AgreementParams, AttendanceRecord, Holiday,
  DayCalculation, MonthlyCalculation, DayType, AbsenceType
} from '../types';


function parseHHMM(time: string): number {
  const parts = time.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

function roundHours(hours: number, method: AgreementParams['roundingMethod']): number {
  if (method === 'quarter') return Math.round(hours * 4) / 4;
  if (method === 'half') return Math.round(hours * 2) / 2;
  return Math.round(hours * 100) / 100;
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay();
}

export const DOW_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getSundayWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dow);
  const year = sunday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((sunday.getTime() - jan1.getTime()) / 86400000);
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function calcNightHours(clockIn: string, clockOut: string): number {
  const inH = parseHHMM(clockIn);
  let outH = parseHHMM(clockOut);
  if (outH < inH) outH += 24; 

  const nightStart = 22;
  const nightEnd = 30; 

  const segStart = Math.max(inH, nightStart);
  const segEnd = Math.min(outH, nightEnd);
  return Math.max(0, segEnd - segStart);
}

function isNightShift(clockIn: string | undefined, clockOut: string | undefined): boolean {
  if (!clockIn || !clockOut) return false;
  return calcNightHours(clockIn, clockOut) >= 2;
}


function getDayType(dateStr: string, holidays: Holiday[], agreement: AgreementParams, restDay: number = 6): DayType {
  const dow = getDayOfWeek(dateStr);

  if (dow === restDay) return restDay === 6 ? 'saturday' : 'rest_day';


  const holiday = holidays.find(h => h.date === dateStr);
  if (holiday) {
    if (holiday.isCholHamoed) return 'chol_hamoed';
    if (holiday.isEveHoliday) return 'eve_holiday';
    return 'holiday';
  }


  if (dow === 5) {
    if (agreement.workDaysPerWeek === 5) return 'friday'; 
    return 'short'; 
  }

  return 'regular';
}

function checkHolidayOnSaturday(dateStr: string, holidays: Holiday[]): boolean {
  const dow = getDayOfWeek(dateStr);
  if (dow !== 6) return false;
  return holidays.some(h => h.date === dateStr);
}

function getPlannedHours(dayType: DayType, agreement: AgreementParams, dayOfWeek?: number): number {
  switch (dayType) {
    case 'saturday': case 'rest_day': return 0;
    case 'holiday': return 0;
    case 'eve_holiday': return agreement.eveHolidayHours;
    case 'chol_hamoed': return agreement.cholHamoedHours ?? agreement.dailyHoursStandard;
    case 'friday':
      return agreement.workDaysPerWeek === 5 ? 0 : agreement.fridayHours;
    case 'short': return agreement.shortDayHours;
    default:
      if (agreement.useWeeklyTemplate && agreement.weeklyTemplate && dayOfWeek !== undefined) {
        const templateHours = (agreement.weeklyTemplate as Record<number, number | undefined>)[dayOfWeek];
        if (templateHours !== undefined && templateHours >= 0) return templateHours;
      }
      return agreement.dailyHoursStandard;
  }
}

function isWorkDay(dayType: DayType, agreement: AgreementParams): boolean {
  if (dayType === 'saturday' || dayType === 'rest_day') return false;
  if (dayType === 'holiday') return false;
  if (dayType === 'friday' && agreement.workDaysPerWeek === 5) return false;
  return true;
}

function getSickPayRate(
  consecutiveSickDay: number,
  agreement: AgreementParams
): number {
  if (consecutiveSickDay <= 1) return agreement.sickDay1Payment;      
  if (consecutiveSickDay <= 3) return agreement.sickDay2_3Payment;   
  return agreement.sickDay4PlusPayment;
}

interface WeeklyGroup {
  weekKey: string;
  dayIndices: number[];
  totalActualHours: number;
  totalPlannedRegular: number;
}

function groupByWeek(days: { dateStr: string; actualHours: number; plannedHours: number; isWork: boolean }[]): WeeklyGroup[] {
  const map = new Map<string, WeeklyGroup>();
  days.forEach((d, i) => {
    const wk = getSundayWeekKey(d.dateStr);
    if (!map.has(wk)) map.set(wk, { weekKey: wk, dayIndices: [], totalActualHours: 0, totalPlannedRegular: 0 });
    const g = map.get(wk)!;
    g.dayIndices.push(i);
    g.totalActualHours += d.actualHours;
    if (d.isWork) g.totalPlannedRegular += d.plannedHours;
  });
  return Array.from(map.values());
}

function calcMonthlyAccrual(
  employee: Employee,
  agreement: AgreementParams,
  sickDaysUsed: number,
  vacationDaysUsed: number
): {
  sickDaysAccrued: number;
  vacationDaysAccrued: number;
  endingSickBalance: number;
  endingVacationBalance: number;
} {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sickDaysAccrued = agreement.sickDayAccrualPerMonth;
  const rawSick = (employee.sickDaysBalance ?? 0) + sickDaysAccrued - sickDaysUsed;
  const endingSickBalance = Math.min(rawSick, agreement.sickDayMaxAccrual);

  const vacationDaysAccrued = agreement.vacationDaysPerYear / 12;
  const rawVac = (employee.vacationDaysBalance ?? 0) + vacationDaysAccrued - vacationDaysUsed;
  const endingVacationBalance = Math.min(rawVac, agreement.vacationMaxAccrual);

  return {
    sickDaysAccrued: r2(sickDaysAccrued),
    vacationDaysAccrued: r2(vacationDaysAccrued),
    endingSickBalance: r2(endingSickBalance),
    endingVacationBalance: r2(endingVacationBalance),
  };
}

export function calculateMonth(
  employee: Employee,
  agreement: AgreementParams,
  attendanceRecords: AttendanceRecord[],
  holidays: Holiday[],
  year: number,
  month: number,
  prevGlobalOTBalance: number = 0
): MonthlyCalculation {
  if (agreement.effectiveDate) {
    const effDate = new Date(agreement.effectiveDate + 'T00:00:00');
    const calcStart = new Date(year, month - 1, 1);
    if (effDate > calcStart) {
      throw new Error(
        `הסכם "${agreement.name}" תקף החל מ-${agreement.effectiveDate}, אך החישוב הוא עבור ${month}/${year}`
      );
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayCalculation[] = [];
  const workPercentage = employee.workPercentage / 100;
  const restDay = employee.restDay ?? 6;

  const balanceWarnings: string[] = [];

  let globalOTBalance = prevGlobalOTBalance;
  if (agreement.type === 'monthly_global_offset' || agreement.type === 'monthly_global_no_offset') {
    if (agreement.allowInterMonthCarry === false) {
      globalOTBalance = 0;
    }
    globalOTBalance += (agreement.globalOvertimeHours ?? 0);
  }

  let consecutiveSickDayCount = 0;

  let totalRegularHours = 0;
  let totalRegularExtendedHours = 0;
  let totalOvertime125 = 0;
  let totalOvertime150 = 0;
  let totalSaturdayHours = 0;
  let totalSaturdayOvertimeHours = 0;
  let totalSaturdayOvertime2Hours = 0;
  let totalEveHolidayBonusHours = 0;
  let totalSickHours = 0;
  let totalSickPayHours = 0; 
  let totalSickDays = 0;
  let totalVacationHours = 0;
  let totalVacationDeductedForAbsence = 0;
  let totalVacationDays = 0;
  let totalReserveDays = 0;
  let totalAbsenceHours = 0;
  let totalUnpaidHours = 0;
  let totalPlannedHours = 0;
  let totalActualWorkHours = 0;
  let totalPaidHours = 0;
  let actualWorkDays = 0;
  let paidWorkDays = 0;
  let taxWorkDays = 0;
  let totalGlobalOTOffset = 0;
  let compensatoryRestDays = 0;
  let vacation4PercentAmount = 0;

  let consecutiveWorkDays = 0;

  
  const attendanceMap = new Map<string, AttendanceRecord>();
  for (const rec of attendanceRecords) {
    if (rec.employeeId !== employee.id) continue;
    const existing = attendanceMap.get(rec.date);
    if (!existing) {
      attendanceMap.set(rec.date, { ...rec });
    } else {
     
      const addHours = (r: AttendanceRecord): number => {
        if (r.actualHours !== undefined && r.actualHours > 0) return r.actualHours;
        if (r.clockIn && r.clockOut) {
          let raw = parseHHMM(r.clockOut) - parseHHMM(r.clockIn);
          if (raw < 0) raw += 24;
          return raw;
        }
        return 0;
      };
      const mergedHours = addHours(existing) + addHours(rec);
    
      let mergedClockIn: string | undefined;
      if (existing.clockIn && rec.clockIn) {
        mergedClockIn = parseHHMM(existing.clockIn) <= parseHHMM(rec.clockIn) ? existing.clockIn : rec.clockIn;
      } else {
        mergedClockIn = existing.clockIn ?? rec.clockIn;
      }
      let mergedClockOut: string | undefined;
      if (existing.clockOut && rec.clockOut) {
        mergedClockOut = parseHHMM(existing.clockOut) >= parseHHMM(rec.clockOut) ? existing.clockOut : rec.clockOut;
      } else {
        mergedClockOut = rec.clockOut ?? existing.clockOut;
      }
      const merged: AttendanceRecord = {
        ...existing,
        actualHours: mergedHours,
        clockIn: mergedClockIn,
        clockOut: mergedClockOut,
        workLocation: rec.workLocation ?? existing.workLocation,
        notes: [existing.notes, rec.notes].filter(Boolean).join(' | ') || undefined,
        absenceType: existing.absenceType ?? rec.absenceType,
        absenceHours: (existing.absenceHours ?? 0) + (rec.absenceHours ?? 0) || undefined,
      };
      attendanceMap.set(rec.date, merged);
    }
  }

  const dailyData: { dateStr: string; actualHours: number; plannedHours: number; isWork: boolean }[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayType = getDayType(dateStr, holidays, agreement, restDay);
    const dow = getDayOfWeek(dateStr);
    let plannedHours = getPlannedHours(dayType, agreement, dow);
    plannedHours *= workPercentage;
    const isWork = isWorkDay(dayType, agreement);

    const isHolidayOnSaturday = checkHolidayOnSaturday(dateStr, holidays);
    const rec = attendanceMap.get(dateStr);

    let actualHours = 0;
    let breakDeductedHours = 0;
    let nightShift = false;
    if (rec) {
      if (rec.actualHours !== undefined && rec.actualHours > 0) {
        actualHours = rec.actualHours;
        if (agreement.nightShiftEnabled) {
          nightShift = isNightShift(rec.clockIn, rec.clockOut);
        }
       
        if (rec.breakMinutesActual !== undefined && rec.breakMinutesActual > 0) {
          breakDeductedHours = rec.breakMinutesActual / 60;
        } else {
          const breakMinutes = agreement.breakMinutes ?? 30;
          if (actualHours > 6) {
            breakDeductedHours = breakMinutes / 60;
          }
        }

        actualHours = roundHours(actualHours, agreement.roundingMethod);
      } else if (rec.clockIn && rec.clockOut) {
        let raw = parseHHMM(rec.clockOut) - parseHHMM(rec.clockIn);
        if (raw < 0) raw += 24;

        if (agreement.nightShiftEnabled) {
          nightShift = isNightShift(rec.clockIn, rec.clockOut);
        }

        if (rec.breakStart && rec.breakEnd) {
          let breakDuration = parseHHMM(rec.breakEnd) - parseHHMM(rec.breakStart);
          if (breakDuration < 0) breakDuration += 24;
          breakDeductedHours = breakDuration;
        } else if (rec.breakMinutesActual !== undefined && rec.breakMinutesActual > 0) {
          breakDeductedHours = rec.breakMinutesActual / 60;
        } else {
          const breakMinutes = agreement.breakMinutes ?? 30;
          if (raw > 6) {
            breakDeductedHours = breakMinutes / 60;
          }
        }
        actualHours = roundHours(Math.max(0, raw), agreement.roundingMethod);
      }
    }

    dailyData.push({ dateStr, actualHours, plannedHours, isWork });

    const absenceType: AbsenceType | undefined = rec?.absenceType;
    const absenceHoursInput = rec?.absenceHours ?? 0;
    let sickHours = 0;
    let sickPayHours = 0;
    let vacationHours = 0;
    let vacationAutoDeducted = 0;
    let reserveHours = 0;
    let unpaidHours = 0;
    let globalOTOffsetHours = 0;
    let paidAbsenceHours = 0;
    const notes: string[] = [];

    if (rec?.workLocation === 'home') notes.push('עבודה מהבית');
    else if (rec?.workLocation === 'abroad') notes.push('עבודה מחו"ל');
    else if (rec?.workLocation === 'external') notes.push('עבודה מחוץ למשרד');

   
    let ruleApplied: string | undefined;

    if (absenceType === 'sick' || absenceType === 'sick_half') {
      const sickDayBase = agreement.sickDayHoursEquivalent
        ?? (agreement.dailyHoursStandard * workPercentage);
      const plannedForSick = agreement.absenceCalculation === 'daily' && sickDayBase > 0
        ? sickDayBase
        : (plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard);
      sickHours = absenceHoursInput > 0 ? absenceHoursInput : plannedForSick;
      if (absenceType === 'sick_half') sickHours = plannedForSick / 2;

      
      consecutiveSickDayCount += absenceType === 'sick_half' ? 0.5 : 1;
      const sickPayPercent = getSickPayRate(consecutiveSickDayCount, agreement);
      sickPayHours = sickHours * sickPayPercent;

      const sickDayUsed = absenceType === 'sick_half' ? 0.5 : 1;
      if (employee.sickDaysBalance - totalSickDays - sickDayUsed < 0) {
        notes.push(`⚠ חריגת יתרת מחלה`);
        if (!balanceWarnings.some(w => w.includes('מחלה'))) {
          balanceWarnings.push(`יתרת ימי מחלה לא מספיקה (יתרה: ${employee.sickDaysBalance}, שימוש: ${(totalSickDays + sickDayUsed).toFixed(1)})`);
        }
      }

      ruleApplied = `sick_graduated_day_${consecutiveSickDayCount}_${(sickPayPercent * 100).toFixed(0)}pct`;
      if (sickPayPercent < 1) {
        notes.push(`מחלה יום ${consecutiveSickDayCount}: ${(sickPayPercent * 100).toFixed(0)}% תשלום`);
      }
    } else if (absenceType === 'sick_no_pay') {
      consecutiveSickDayCount += 1;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
      ruleApplied = 'sick_no_pay';
    } else if (absenceType === 'vacation' || absenceType === 'vacation_partial') {
      consecutiveSickDayCount = 0;
      const dailyBase = agreement.dailyHoursStandard * workPercentage;
      const plannedForVac = agreement.absenceCalculation === 'daily' && dailyBase > 0
        ? dailyBase
        : (plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard);

      if (agreement.vacationUnit === 'hours' && absenceHoursInput > 0) {
        vacationHours = absenceHoursInput;
      } else {
        vacationHours = absenceHoursInput > 0 ? absenceHoursInput : plannedForVac;
      }

      const vacDayUsed = absenceType === 'vacation_partial' && dailyBase > 0
        ? vacationHours / dailyBase
        : 1;
      ruleApplied = agreement.vacationUnit === 'hours' ? 'vacation_hours' : 'vacation_days';
      if (employee.vacationDaysBalance - totalVacationDays - vacDayUsed < 0) {
        notes.push(`⚠ חריגת יתרת חופשה`);
        if (!balanceWarnings.some(w => w.includes('חופשה'))) {
          balanceWarnings.push(`יתרת ימי חופשה לא מספיקה (יתרה: ${employee.vacationDaysBalance}, שימוש: ${(totalVacationDays + vacDayUsed).toFixed(1)})`);
        }
      }
    } else if (absenceType === 'reserve') {
      consecutiveSickDayCount = 0;
      reserveHours = plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard;
      ruleApplied = 'reserve_duty';
    } else if (absenceType === 'unpaid') {
      consecutiveSickDayCount = 0;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
    } else if (absenceType === 'maternity') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard;
      notes.push('חופשת לידה');
    } else if (absenceType === 'bereavement') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard;
      notes.push('ימי אבל');
    } else if (absenceType === 'work_accident') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard;
      notes.push('תאונת עבודה');
    } else if (absenceType === 'pregnancy_hours') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = 1;
      notes.push('שעת הריון');
    } else if (absenceType === 'parental_hour') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = 1;
      notes.push('שעת הורות');
    } else if (absenceType === 'holiday_work') {
      consecutiveSickDayCount = 0;
      notes.push('עבודה בחג');
    } else if (absenceType === 'authorized') {
      consecutiveSickDayCount = 0;
      paidAbsenceHours = absenceHoursInput > 0 ? absenceHoursInput : (plannedHours > 0 ? plannedHours : agreement.dailyHoursStandard);
      notes.push('היעדרות מאושרת');
    } else if (absenceType === 'offset_overtime') {
      consecutiveSickDayCount = 0;
      const offsetHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
      const canOffset = Math.min(offsetHours, globalOTBalance);
      if (canOffset > 0) {
        globalOTOffsetHours = canOffset;
        globalOTBalance -= canOffset;
        totalGlobalOTOffset += canOffset;
        notes.push(`קוזז ${canOffset.toFixed(2)} שע' מש"נ גלובלי (סוג היעדרות)`);
      }
      if (offsetHours > canOffset) {
        unpaidHours = offsetHours - canOffset;
      }
    } else if (absenceType === 'leave_unpaid') {
      consecutiveSickDayCount = 0;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
      notes.push('חל"ת');
    } else if (absenceType === 'parental_leave') {
      consecutiveSickDayCount = 0;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
      notes.push('חל"ד');
    } else if (absenceType === 'collective_vacation') {
      consecutiveSickDayCount = 0;
      const dailyBase = agreement.dailyHoursStandard * workPercentage;
      vacationHours = absenceHoursInput > 0 ? absenceHoursInput
        : (plannedHours > 0 ? plannedHours : dailyBase);
      notes.push('חופשה מרוכזת');
    } else if (absenceType === 'personal_day') {
      consecutiveSickDayCount = 0;
      const dailyBase = agreement.dailyHoursStandard * workPercentage;
      vacationHours = absenceHoursInput > 0 ? absenceHoursInput
        : (plannedHours > 0 ? plannedHours : dailyBase);
      notes.push('יום בחירה');
    } else if (absenceType === 'break_deduction') {
      consecutiveSickDayCount = 0;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : 0;
      notes.push('ניכוי הפסקה');
    } else if (absenceType === 'other') {
      consecutiveSickDayCount = 0;
      unpaidHours = absenceHoursInput > 0 ? absenceHoursInput : plannedHours;
    } else {
      consecutiveSickDayCount = 0;
    }

    const approvedAbsenceHours = sickHours + vacationHours + reserveHours + paidAbsenceHours;
    const coveredHours = actualHours + approvedAbsenceHours + unpaidHours;
    let uncoveredAbsence = isWork ? Math.max(0, plannedHours - coveredHours) : 0;

    if (
      (agreement.type === 'monthly_global_offset' || agreement.type === 'monthly_global_no_offset') &&
      uncoveredAbsence > 0 && isWork
    ) {
      const minHours = agreement.minHoursForAbsenceOffset ?? 4;

      if (agreement.type === 'monthly_global_offset') {
        ruleApplied = `global_ot_offset_type_c_min${minHours}h`;
        if (actualHours >= minHours) {
          const canOffset = agreement.allowNegativeGlobalOT
            ? uncoveredAbsence
            : Math.min(uncoveredAbsence, Math.max(0, globalOTBalance));
          if (canOffset > 0) {
            globalOTOffsetHours = canOffset;
            globalOTBalance -= canOffset;
            uncoveredAbsence -= canOffset;
            totalGlobalOTOffset += canOffset;
            notes.push(`קוזז ${canOffset.toFixed(2)} שע' מיתרת ש"נ גלובלי`);
            if (globalOTBalance < 0) {
              notes.push(`⚠ יתרת ש"נ גלובלי שלילית: ${globalOTBalance.toFixed(2)}`);
            }
          }
          if (uncoveredAbsence > 0) {
            notes.push(`${uncoveredAbsence.toFixed(2)} שע' היעדרות לקיזוז`);
          }
        }
      } else {
        ruleApplied = `global_ot_no_offset_type_d_min${minHours}h`;
        if (actualHours >= minHours) {
          const canOffset = agreement.allowNegativeGlobalOT
            ? uncoveredAbsence
            : Math.min(uncoveredAbsence, Math.max(0, globalOTBalance));
          if (canOffset > 0) {
            globalOTOffsetHours = canOffset;
            globalOTBalance -= canOffset;
            uncoveredAbsence -= canOffset;
            totalGlobalOTOffset += canOffset;
            notes.push(`קוזז ${canOffset.toFixed(2)} שע' מיתרת ש"נ גלובלי`);
            if (globalOTBalance < 0) {
              notes.push(`⚠ יתרת ש"נ גלובלי שלילית: ${globalOTBalance.toFixed(2)}`);
            }
          }
          if (uncoveredAbsence > 0) {
            notes.push(`${uncoveredAbsence.toFixed(2)} שע' היעדרות לקיזוז`);
          }
        }

        const isVacationOrSick = absenceType === 'vacation' || absenceType === 'vacation_partial'
          || absenceType === 'sick' || absenceType === 'sick_half';
        if (uncoveredAbsence > 0 && !isVacationOrSick) {
          notes.push(`דיווח משרד: ${actualHours.toFixed(2)} שע' (${uncoveredAbsence.toFixed(2)} שע' היעדרות ללא ניכוי בשכר)`);
          uncoveredAbsence = 0;
        }
      }
    }

    let regularHours = 0;
    let regularExtendedHours = 0;
    let overtime125 = 0;
    let overtime150 = 0;
    let saturdayHours = 0;
    let saturdayOvertimeHours = 0;
    let saturdayOvertime2Hours = 0;
    let eveHolidayBonusHours = 0;

    const overtimeBase = agreement.overtimeBaseHours != null
      ? agreement.overtimeBaseHours * workPercentage
      : plannedHours;

    const nightStandardHours = (agreement.nightShiftStandardHours ?? 7) * workPercentage;
    const effectiveOTBase = (nightShift && agreement.nightShiftEnabled) ? nightStandardHours : overtimeBase;

    const extendedBase = agreement.regularExtendedBaseHours != null
      ? agreement.regularExtendedBaseHours * workPercentage
      : null;

    if (dayType === 'saturday' || dayType === 'rest_day') {
      ruleApplied = ruleApplied ?? 'saturday_work';
      const satThr1 = agreement.saturdayOvertimeThreshold;
      const satThr2 = agreement.saturdayOvertime2Threshold;

      if (satThr2 != null && satThr2 > 0 && actualHours > satThr2) {
        saturdayHours = satThr1 ?? satThr2;
        saturdayOvertimeHours = (satThr1 != null && satThr1 > 0) ? satThr2 - satThr1 : 0;
        saturdayOvertime2Hours = actualHours - satThr2;
        notes.push(`${saturdayOvertime2Hours.toFixed(2)} שע' נוספות בשבת 200%`);
      } else if (satThr1 != null && satThr1 > 0 && actualHours > satThr1) {
        saturdayHours = satThr1;
        saturdayOvertimeHours = actualHours - satThr1;
        notes.push(`${saturdayOvertimeHours.toFixed(2)} שע' נוספות בשבת 175%`);
      } else {
        saturdayHours = actualHours;
      }
      if (actualHours > 0 && agreement.requireCompensatoryRest) {
        compensatoryRestDays += 1;
        notes.push('זכאות למנוחת פיצוי');
      }
    } else if ((dayType === 'holiday' && actualHours > 0) || absenceType === 'holiday_work') {
      const satThr1 = agreement.saturdayOvertimeThreshold;
      const satThr2 = agreement.saturdayOvertime2Threshold;
      if (satThr2 != null && satThr2 > 0 && actualHours > satThr2) {
        saturdayHours = satThr1 ?? satThr2;
        saturdayOvertimeHours = (satThr1 != null && satThr1 > 0) ? satThr2 - satThr1 : 0;
        saturdayOvertime2Hours = actualHours - satThr2;
      } else if (satThr1 != null && satThr1 > 0 && actualHours > satThr1) {
        saturdayHours = satThr1;
        saturdayOvertimeHours = actualHours - satThr1;
      } else {
        saturdayHours = actualHours;
      }
    } else if (dayType === 'eve_holiday' && agreement.eveHolidayPaidHours && agreement.eveHolidayPaidHours > agreement.eveHolidayHours) {
      if (actualHours > 0) {
        if (actualHours <= effectiveOTBase) {
          regularHours = actualHours;
        } else {
          regularHours = effectiveOTBase;
          const extraHours = actualHours - effectiveOTBase;
          if (agreement.calculateOvertimeDaily) {
            const threshold1 = agreement.overtimeThreshold1;
            if (extraHours <= threshold1) {
              overtime125 = extraHours;
            } else {
              overtime125 = threshold1;
              overtime150 = extraHours - threshold1;
            }
          }
        }
        const scheduledHours = agreement.eveHolidayHours * workPercentage;
        const bonusBase = Math.min(actualHours, scheduledHours);
        if (bonusBase > 0 && scheduledHours > 0) {
          const paidHoursDiff = (agreement.eveHolidayPaidHours - agreement.eveHolidayHours) * workPercentage;
          eveHolidayBonusHours = paidHoursDiff * (bonusBase / scheduledHours);
          notes.push(`בונוס ערב חג: ${eveHolidayBonusHours.toFixed(2)} שע'`);
        }
      }
    } else if (isWork && actualHours > 0) {
      if (nightShift && agreement.nightShiftEnabled) {
        if (actualHours <= nightStandardHours) {
          regularHours = actualHours;
          ruleApplied = ruleApplied ?? 'night_shift_regular';
        } else {
          regularHours = nightStandardHours;
          const extraHours = actualHours - nightStandardHours;
          ruleApplied = ruleApplied ?? 'night_shift_overtime';
          if (agreement.calculateOvertimeDaily) {
            const threshold1 = agreement.overtimeThreshold1;
            if (extraHours <= threshold1) {
              overtime125 = extraHours;
            } else {
              overtime125 = threshold1;
              overtime150 = extraHours - threshold1;
            }
          }
        }
      } else if (actualHours <= effectiveOTBase) {
        regularHours = actualHours;
        ruleApplied = ruleApplied ?? 'regular_hours';
      } else {
        regularHours = effectiveOTBase;
        const extraHours = actualHours - effectiveOTBase;
        ruleApplied = ruleApplied ?? 'daily_overtime';

        if (agreement.calculateOvertimeDaily) {
          if (extendedBase != null && extendedBase > effectiveOTBase) {
            const extendedZone = extendedBase - effectiveOTBase;
            if (extraHours <= extendedZone) {
              regularExtendedHours = extraHours;
              ruleApplied = 'regular_extended_100pct';
            } else {
              regularExtendedHours = extendedZone;
              const overtimeExtra = extraHours - extendedZone;
              const threshold1 = agreement.overtimeThreshold1;
              if (overtimeExtra <= threshold1) {
                overtime125 = overtimeExtra;
              } else {
                overtime125 = threshold1;
                overtime150 = overtimeExtra - threshold1;
              }
              ruleApplied = 'regular_extended_then_overtime';
            }
          } else {
            const threshold1 = agreement.overtimeThreshold1;
            if (extraHours <= threshold1) {
              overtime125 = extraHours;
            } else {
              overtime125 = threshold1;
              overtime150 = extraHours - threshold1;
            }
          }
        }
      }
    }

    if (actualHours > 12) {
      notes.push(`⚠ חוק שע"מ: ${actualHours.toFixed(2)} שע' ביום — חריגת 12 שעות`);
    }

    const eligibleForVacDeduct = agreement.absenceDeductFromVacation
      && agreement.type !== 'hourly'
      && agreement.type !== 'monthly_global_no_offset';
    if (eligibleForVacDeduct && uncoveredAbsence > 0 && isWork) {
      const deductionBase = agreement.dailyHoursStandard ?? 8.5;
      vacationAutoDeducted = roundHours(uncoveredAbsence / deductionBase, agreement.roundingMethod);
      const availableVacation = Math.max(0, employee.vacationDaysBalance - totalVacationDays);
      if (vacationAutoDeducted > availableVacation) {
        vacationAutoDeducted = availableVacation;
      }
      if (vacationAutoDeducted > 0) {
        notes.push(`קוזז ${vacationAutoDeducted.toFixed(2)} ימי חופשה בגין חוסר ${uncoveredAbsence.toFixed(2)} שע'`);
        uncoveredAbsence = 0;
      }
    }

    if (isWork && actualHours > 0) {
      consecutiveWorkDays += 1;
      if (consecutiveWorkDays >= 7) {
        notes.push(`⚠ חוק שע"מ: יום עבודה ${consecutiveWorkDays} ברצף — נדרש יום מנוחת פיצוי`);
      }
    } else if (dayType === 'saturday' || dayType === 'rest_day') {
      consecutiveWorkDays = 0;
    }

    days.push({
      date: dateStr, dayOfWeek: dow, dayType, isHolidayOnSaturday,
      clockIn: rec?.clockIn, clockOut: rec?.clockOut,
      plannedHours, actualHours,
      breakDeductedHours,
      regularHours, regularExtendedHours,
      overtime125Hours: overtime125, overtime150Hours: overtime150,
      saturdayHours, saturdayOvertimeHours, saturdayOvertime2Hours,
      eveHolidayBonusHours,
      absenceHours: uncoveredAbsence, absenceType,
      sickHours, sickPayHours, vacationHours, vacationDeductedForAbsence: vacationAutoDeducted,
      globalOvertimeOffsetHours: globalOTOffsetHours,
      unpaidHours, reserveHours, isNightShift: nightShift, notes, ruleApplied,
    });

    totalRegularHours += regularHours;
    totalRegularExtendedHours += regularExtendedHours;
    totalOvertime125 += overtime125;
    totalOvertime150 += overtime150;
    totalSaturdayHours += saturdayHours;
    totalSaturdayOvertimeHours += saturdayOvertimeHours;
    totalSaturdayOvertime2Hours += saturdayOvertime2Hours;
    totalEveHolidayBonusHours += eveHolidayBonusHours;
    totalSickHours += sickHours;
    totalSickPayHours += sickPayHours;
    totalVacationHours += vacationHours;
    totalVacationDeductedForAbsence += vacationAutoDeducted;
    totalAbsenceHours += uncoveredAbsence;
    totalUnpaidHours += unpaidHours;

    if (reserveHours > 0) totalReserveDays += 1;
    if (sickHours > 0 || absenceType === 'sick' || absenceType === 'sick_half' || absenceType === 'sick_no_pay') {
      totalSickDays += absenceType === 'sick_half' ? 0.5 : 1;
    }
    if (vacationHours > 0) {
      const dailyBase = agreement.dailyHoursStandard * workPercentage;
      totalVacationDays += absenceType === 'vacation_partial' && dailyBase > 0
        ? vacationHours / dailyBase
        : 1;
    }

    if (isWork && (actualHours > 0 || approvedAbsenceHours > 0)) {
      actualWorkDays += 1;
      paidWorkDays += 1;
      taxWorkDays += 1;
    } else if (isWork && unpaidHours > 0) {
      taxWorkDays += 1;
    }

    totalPlannedHours += plannedHours;
    totalActualWorkHours += actualHours;
    totalPaidHours += regularHours + regularExtendedHours + sickPayHours + vacationHours + reserveHours + paidAbsenceHours + eveHolidayBonusHours;
  }

  if (agreement.calculateOvertimeWeekly) {
    const weeklyStandard = agreement.weeklyHoursStandard * workPercentage;
    const weeklyOTLawLimit = 16;
    const weeks = groupByWeek(dailyData);

    for (const week of weeks) {
      let weekWorkHours = 0;
      for (const idx of week.dayIndices) {
        const d = days[idx];
        if (d.dayType !== 'saturday' && d.dayType !== 'rest_day' && d.dayType !== 'holiday') {
          weekWorkHours += d.actualHours;
        }
      }

      if (weekWorkHours > weeklyStandard) {
        const weeklyOvertime = weekWorkHours - weeklyStandard;

        if (weeklyOvertime > weeklyOTLawLimit) {
          const lastWorkIdx = [...week.dayIndices].reverse().find(idx =>
            days[idx].dayType !== 'saturday' && days[idx].dayType !== 'holiday'
          );
          if (lastWorkIdx !== undefined) {
            days[lastWorkIdx].notes.push(`⚠ חוק שע"מ: ${weeklyOvertime.toFixed(2)} שע' נוספות שבועיות — חריגת 16 שעות`);
          }
        }

        let dailyOTTotal = 0;
        for (const idx of week.dayIndices) {
          dailyOTTotal += days[idx].overtime125Hours + days[idx].overtime150Hours;
        }

        if (weeklyOvertime > dailyOTTotal) {
          const additionalOT = roundHours(weeklyOvertime - dailyOTTotal, agreement.roundingMethod);
          if (additionalOT > 0) {
            const lastWorkIdx = [...week.dayIndices].reverse().find(idx =>
              days[idx].dayType !== 'saturday' && days[idx].dayType !== 'holiday'
            );
            if (lastWorkIdx !== undefined) {
              const threshold1 = agreement.overtimeThreshold1;
              const existOT125 = days[lastWorkIdx].overtime125Hours;

              if (existOT125 + additionalOT <= threshold1) {
                days[lastWorkIdx].overtime125Hours += additionalOT;
                totalOvertime125 += additionalOT;
              } else {
                const to125 = Math.max(0, threshold1 - existOT125);
                const to150 = additionalOT - to125;
                days[lastWorkIdx].overtime125Hours += to125;
                days[lastWorkIdx].overtime150Hours += to150;
                totalOvertime125 += to125;
                totalOvertime150 += to150;
              }

              days[lastWorkIdx].ruleApplied = 'weekly_overtime_redistribution';
              days[lastWorkIdx].notes.push(`ש"נ שבועי: +${additionalOT.toFixed(2)}`);
              totalRegularHours = Math.max(0, totalRegularHours - additionalOT);
              days[lastWorkIdx].regularHours = Math.max(0, days[lastWorkIdx].regularHours - additionalOT);
            }
          }
        }
      }
    }
  }


  const r = (n: number) => Math.round(n * 100) / 100;

  if (agreement.type === 'hourly' && agreement.vacation4PercentForHourly && actualWorkDays < 75) {
    vacation4PercentAmount = r(totalActualWorkHours * 0.04);
  }

  const accrual = calcMonthlyAccrual(employee, agreement, totalSickDays, totalVacationDays);

  return {
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    month, year, days,

    agreementId: agreement.id,
    agreementName: agreement.name,
    agreementVersion: agreement.version,
    calculatedAt: new Date().toISOString(),
    balanceWarnings: balanceWarnings.length > 0 ? balanceWarnings : undefined,

    totalRegularHours: r(Math.max(0, totalRegularHours)),
    totalRegularExtendedHours: r(totalRegularExtendedHours),
    totalOvertime125Hours: r(totalOvertime125),
    totalOvertime150Hours: r(totalOvertime150),
    totalSaturdayHours: r(totalSaturdayHours),
    totalSaturdayOvertimeHours: r(totalSaturdayOvertimeHours),
    totalSaturdayOvertime2Hours: r(totalSaturdayOvertime2Hours),
    totalEveHolidayBonusHours: r(totalEveHolidayBonusHours),
    totalSickHours: r(totalSickHours),
    totalSickPayHours: r(totalSickPayHours),
    totalSickDays: r(totalSickDays),
    totalVacationHours: r(totalVacationHours),
    totalVacationDays: r(totalVacationDays),
    totalReserveDays,
    totalAbsenceHours: r(totalAbsenceHours),
    totalUnpaidHours: r(totalUnpaidHours),
    totalPlannedHours: r(totalPlannedHours),
    totalActualWorkHours: r(totalActualWorkHours),
    totalPaidHours: r(totalPaidHours),
    actualWorkDays, paidWorkDays, taxWorkDays,
    globalOvertimeBalance: r(globalOTBalance),
    globalOvertimeOffsetTotal: r(totalGlobalOTOffset),
    totalSickDaysUsed: r(totalSickDays),
    totalVacationDaysUsed: r(totalVacationDays + totalVacationDeductedForAbsence),
    totalVacationDeductedForAbsence: r(totalVacationDeductedForAbsence),
    sickDaysAccrued: accrual.sickDaysAccrued,
    vacationDaysAccrued: accrual.vacationDaysAccrued,
    openingSickBalance: r(employee.sickDaysBalance ?? 0),
    openingVacationBalance: r(employee.vacationDaysBalance ?? 0),
    endingSickBalance: accrual.endingSickBalance,
    endingVacationBalance: accrual.endingVacationBalance,
    compensatoryRestDays: compensatoryRestDays > 0 ? compensatoryRestDays : undefined,
    vacation4PercentAmount: vacation4PercentAmount > 0 ? vacation4PercentAmount : undefined,
  };
}
