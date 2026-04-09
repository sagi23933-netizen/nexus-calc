import type { AgreementParams, Holiday } from '../types';
import { generatePayrollYearHolidays } from './holidayGenerator';

export function defaultAgreements(): AgreementParams[] {
  const base = {
    weeklyHoursStandard: 42.5,
    dailyHoursStandard: 8.5,
    shortDayHours: 7.5,
    fridayHours: 7.5,
    eveHolidayHours: 7,
    breakMinutes: 30,
    overtimeRate1: 1.25,
    overtimeRate2: 1.50,
    overtimeThreshold1: 2,
    saturdayRate: 1.50,
    calculateOvertimeDaily: true,
    calculateOvertimeWeekly: true,
    absenceCalculation: 'hourly' as const,
    roundingMethod: 'quarter' as const,
    sickAccrualType: 'legal' as const,
    sickDayAccrualPerMonth: 1.5,
    sickDayMaxAccrual: 90,
    sickDay1Payment: 0,
    sickDay2_3Payment: 0.5,
    sickDay4PlusPayment: 1.0,
    vacationAccrualType: 'legal' as const,
    vacationDaysPerYear: 10,
    vacationUnit: 'days' as const,
    vacationMaxAccrual: 30,
    vacationCarryOverPolicy: 'carry_all' as const,
    vacationDistributionMethod: 'monthly_equal' as const,
    cholHamoedHours: 8.5,
    vacation4PercentForHourly: false,
    requireCompensatoryRest: false,
    useWeeklyTemplate: false,
  };

  return [
    { ...base, id: 'agreement-hourly', name: 'עובד שעתי (ברירת מחדל)', type: 'hourly' as const, workDaysPerWeek: 5 as const },
    { ...base, id: 'agreement-monthly-ot', name: 'חודשי עם ש"נ לתשלום (ברירת מחדל)', type: 'monthly_overtime' as const, workDaysPerWeek: 5 as const },
    { ...base, id: 'agreement-monthly-global-offset', name: 'חודשי גלובלי + קיזוז (ברירת מחדל)', type: 'monthly_global_offset' as const, workDaysPerWeek: 5 as const, globalOvertimeHours: 20, minHoursForAbsenceOffset: 4, allowInterMonthCarry: false },
    { ...base, id: 'agreement-monthly-global-no-offset', name: 'חודשי גלובלי ללא קיזוז (ברירת מחדל)', type: 'monthly_global_no_offset' as const, workDaysPerWeek: 5 as const, globalOvertimeHours: 20, minHoursForAbsenceOffset: 4, allowInterMonthCarry: false },
  ];
}

export function defaultHolidays(year?: number): Holiday[] {
  const targetYear = year ?? new Date().getFullYear();
  return generatePayrollYearHolidays(targetYear, ['jewish']);
}
