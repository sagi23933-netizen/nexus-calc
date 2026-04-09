export type AgreementType =
  | 'hourly'
  | 'monthly_overtime'
  | 'monthly_global_offset'
  | 'monthly_global_no_offset';

export const AGREEMENT_LABELS: Record<AgreementType, string> = {
  hourly: 'א. עובד שעתי',
  monthly_overtime: 'ב. חודשי עם ש"נ לתשלום',
  monthly_global_offset: 'ג. חודשי עם ש"נ גלובליות + קיזוז',
  monthly_global_no_offset: 'ד. חודשי עם ש"נ גלובליות - ללא קיזוז',
};


export interface AgreementParams {
  id: string;
  name: string;
  type: AgreementType;
  effectiveDate?: string;

  weeklyHoursStandard: number;
  dailyHoursStandard: number;
  shortDayHours: number;
  fridayHours: number;
  eveHolidayHours: number;
  eveHolidayPaidHours?: number;
  workDaysPerWeek: 5 | 6;
  cholHamoedHours?: number;
  overtimeBaseHours?: number;

  overtimeRate1: number;
  overtimeRate2: number;
  overtimeThreshold1: number;
  saturdayRate: number;
  saturdayOvertimeThreshold?: number;
  saturdayOvertimeRate?: number;
  calculateOvertimeDaily: boolean;
  calculateOvertimeWeekly: boolean;

  globalOvertimeHours?: number;
  minHoursForAbsenceOffset?: number;
  allowInterMonthCarry?: boolean;
  globalOTTrackingMode?: 'offset_only' | 'offset_and_audit';
  allowNegativeGlobalOT?: boolean;

  breakMinutes?: number;
  breakIncludedInStandard?: boolean;

  regularExtendedBaseHours?: number;

  saturdayOvertime2Threshold?: number;
  saturdayOvertime2Rate?: number;

  nightShiftEnabled?: boolean;
  nightShiftStandardHours?: number;

  absenceDeductFromVacation?: boolean;

  sickOpeningBalance?: number;
  vacationOpeningBalance?: number;

  absenceCalculation: 'daily' | 'hourly';
  roundingMethod: 'none' | 'quarter' | 'half';

  sickAccrualType: 'legal' | 'agreement';
  sickDayAccrualPerMonth: number;
  sickDayMaxAccrual: number;
  sickDay1Payment: number;
  sickDay2_3Payment: number;
  sickDay4PlusPayment: number;
  sickDayHoursEquivalent?: number;

  vacationAccrualType: 'legal' | 'agreement';
  vacationDaysPerYear: number;
  vacationUnit: 'days' | 'hours';
  vacationMaxAccrual: number;
  vacationCarryOverPolicy: 'carry_all' | 'carry_limited' | 'delete';
  vacationCarryOverMax?: number;
  vacationDistributionMethod: 'monthly_equal' | 'monthly_proportional' | 'annual';
  vacation4PercentForHourly?: boolean;
  requireCompensatoryRest?: boolean;

  weeklyTemplate?: {
    [day in 0 | 1 | 2 | 3 | 4 | 5 | 6]?: number;
  };
  useWeeklyTemplate?: boolean;

  version?: number;
  versionHistory?: AgreementVersion[];
}


export interface AgreementVersion {
  version: number;
  snapshot: Omit<AgreementParams, 'versionHistory' | 'version'>;
  modifiedAt: string;
  modifiedBy?: string;
}


export type Religion = 'jewish' | 'muslim' | 'christian' | 'druze';


export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  agreementId: string;
  employmentType: 'hourly' | 'monthly';
  startDate: string;
  workPercentage: number;
  department?: string;
  isActive: boolean;
  restDay?: number;
  religion?: Religion;

  sickDaysBalance: number;
  sickHoursBalance?: number;
  vacationDaysBalance: number;
  vacationHoursBalance?: number;
  globalOvertimeBalance?: number;
  lastAccrualPeriod?: string;
}


export type AbsenceType =
  | 'vacation'
  | 'sick'
  | 'sick_half'
  | 'vacation_partial'
  | 'unpaid'
  | 'holiday_work'
  | 'reserve'
  | 'maternity'
  | 'bereavement'
  | 'pregnancy_hours'
  | 'parental_hour'
  | 'authorized'
  | 'sick_no_pay'
  | 'work_accident'
  | 'offset_overtime'
  | 'leave_unpaid'
  | 'parental_leave'
  | 'collective_vacation'
  | 'personal_day'
  | 'break_deduction'
  | 'other';

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  vacation: 'חופשה',
  sick: 'מחלה',
  sick_half: 'חצי יום מחלה',
  vacation_partial: 'חופשה חלקית',
  unpaid: 'היעדרות ללא תשלום',
  holiday_work: 'עבודה בחג',
  reserve: 'מילואים',
  maternity: 'לידה/חלד',
  bereavement: 'ימי אבל',
  pregnancy_hours: 'שעות הריון',
  parental_hour: 'שעת הורות',
  authorized: 'היעדרות מאושרת',
  sick_no_pay: 'מחלה ללא תשלום',
  work_accident: 'תאונת עבודה',
  offset_overtime: 'קיזוז מש"נ גלובלי',
  leave_unpaid: 'חל"ת',
  parental_leave: 'חל"ד',
  collective_vacation: 'חופשה מרוכזת',
  personal_day: 'יום בחירה',
  break_deduction: 'ניכוי הפסקה',
  other: 'אחר',
};

export type DayType =
  | 'regular'
  | 'short'
  | 'friday'
  | 'saturday'
  | 'rest_day'
  | 'holiday'
  | 'eve_holiday'
  | 'chol_hamoed';

export type WorkLocation = 'office' | 'home' | 'external' | 'abroad';

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  office: 'משרד',
  home: 'עבודה מהבית',
  external: 'מחוץ למשרד',
  abroad: 'חו"ל',
};

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  actualHours?: number;
  absenceType?: AbsenceType;
  absenceHours?: number;
  notes?: string;
  isManual: boolean;
  workLocation?: WorkLocation;
  breakStart?: string;
  breakEnd?: string;
  breakMinutesActual?: number;
  isApproved?: boolean;
  approvalNote?: string;
}


export interface Holiday {
  id: string;
  date: string;
  name: string;
  isEveHoliday: boolean;
  isCholHamoed?: boolean;
  isHolidayWork?: boolean;
  religion?: Religion;
}


export interface DayCalculation {
  date: string;
  dayOfWeek: number;
  dayType: DayType;
  isHolidayOnSaturday: boolean;
  clockIn?: string;
  clockOut?: string;
  plannedHours: number;
  actualHours: number;
  breakDeductedHours: number;
  regularHours: number;
  regularExtendedHours: number;
  overtime125Hours: number;
  overtime150Hours: number;
  saturdayHours: number;
  saturdayOvertimeHours: number;
  saturdayOvertime2Hours: number;
  eveHolidayBonusHours: number;
  absenceHours: number;
  absenceType?: AbsenceType;
  sickHours: number;
  sickPayHours: number;
  vacationHours: number;
  vacationDeductedForAbsence: number;
  globalOvertimeOffsetHours: number;
  unpaidHours: number;
  reserveHours: number;
  isNightShift: boolean;
  notes: string[];
  ruleApplied?: string;
}

export interface MonthlyCalculation {
  employeeId: string;
  employeeNumber: string;
  month: number;
  year: number;
  days: DayCalculation[];

  agreementId?: string;
  agreementName?: string;
  agreementVersion?: number;
  calculatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  balanceWarnings?: string[];

  totalRegularHours: number;
  totalRegularExtendedHours: number;
  totalOvertime125Hours: number;
  totalOvertime150Hours: number;
  totalSaturdayHours: number;
  totalSaturdayOvertimeHours: number;
  totalSaturdayOvertime2Hours: number;
  totalEveHolidayBonusHours: number;
  totalSickHours: number;
  totalSickDays: number;
  totalVacationHours: number;
  totalVacationDays: number;
  totalReserveDays: number;
  totalAbsenceHours: number;
  totalUnpaidHours: number;
  totalPlannedHours: number;
  totalActualWorkHours: number;
  totalPaidHours: number;
  actualWorkDays: number;
  paidWorkDays: number;
  taxWorkDays: number;
  globalOvertimeBalance: number;
  globalOvertimeOffsetTotal: number;
  totalSickDaysUsed: number;
  totalVacationDaysUsed: number;
  totalVacationDeductedForAbsence: number;
  totalSickPayHours: number;
  sickDaysAccrued: number;
  vacationDaysAccrued: number;
  openingSickBalance: number;
  openingVacationBalance: number;
  endingSickBalance: number;
  endingVacationBalance: number;
  compensatoryRestDays?: number;
  vacation4PercentAmount?: number;
}


export interface ComponentMapping {
  internalKey: string;
  label: string;
  componentNumber: string;
  recordType: '0' | '1' | '2' | '4' | '5' | '6' | '7';
  unit: 'hours' | 'days' | 'amount';
  enabled: boolean;
  isTaxable: boolean;
  isPensionable: boolean;
  valueType: 'quantity' | 'rate' | 'amount';
}

export const DEFAULT_COMPONENT_MAPPINGS: ComponentMapping[] = [
  { internalKey: 'overtime125',     label: 'שעות נוספות 125%',          componentNumber: '110', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'overtimeExtended', label: 'שעות נוספות 100% (מורחב)', componentNumber: '109', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'overtime150',     label: 'שעות נוספות 150%',          componentNumber: '111', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'saturdayHours',   label: 'עבודה בשבת/חג 150%',        componentNumber: '112', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'absenceDeduct',   label: 'ניכוי היעדרות',              componentNumber: '120', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: false, valueType: 'quantity' },
  { internalKey: 'sickPay',         label: 'תשלום מחלה',                 componentNumber: '130', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'vacationPay',     label: 'תשלום חופשה',               componentNumber: '140', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'reservePay',      label: 'מילואים',                   componentNumber: '150', recordType: '1', unit: 'days',   enabled: true, isTaxable: true, isPensionable: false, valueType: 'quantity' },
  { internalKey: 'unpaidDeduct',    label: 'ניכוי ללא תשלום',           componentNumber: '160', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: false, valueType: 'quantity' },
  { internalKey: 'globalOTBalance', label: 'יתרת ש"נ גלובלי לקיזוז',   componentNumber: '170', recordType: '1', unit: 'hours',  enabled: true, isTaxable: false, isPensionable: false, valueType: 'quantity' },
  { internalKey: 'saturdayOvertime', label: 'ש"נ בשבת 175%',           componentNumber: '113', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'saturdayOvertime2', label: 'ש"נ בשבת 200%',          componentNumber: '115', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'eveHolidayBonus', label: 'בונוס ערב חג',             componentNumber: '114', recordType: '1', unit: 'hours',  enabled: true, isTaxable: true, isPensionable: true,  valueType: 'quantity' },
  { internalKey: 'vacation4Percent', label: 'תחליף חופשה 4%',          componentNumber: '141', recordType: '1', unit: 'amount', enabled: true, isTaxable: true, isPensionable: false, valueType: 'amount' },
];


export interface AttendanceColumnMapping {
  employeeNumber: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  actualHours?: string;
  absenceType?: string;
  absenceHours?: string;
  notes?: string;
}


export interface AppState {
  employees: Employee[];
  agreements: AgreementParams[];
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  componentMappings: ComponentMapping[];
  calculations: MonthlyCalculation[];
}
