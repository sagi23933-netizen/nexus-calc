import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { DayCalculation, MonthlyCalculation } from '../types';
import { calculateMonth, DOW_LABELS } from '../lib/calculationEngine';
import { filterHolidaysForEmployee, ensureHolidaysForYear, getHolidayNameForDate } from '../lib/holidayService';
import { Play, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Trash2, Moon, Thermometer, Sun, FileSpreadsheet, Pencil, CalendarDays, Users, Calculator } from 'lucide-react';
import { generateId } from '../lib/utils';
import { MONTH_NAMES } from '../lib/constants';
import { exportCalculationsToExcel } from '../lib/excelExporter';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
const DT: Record<string,string> = { regular:'רגיל', short:'מקוצר', friday:'שישי', saturday:'שבת', rest_day:'יום מנוחה', holiday:'חג', eve_holiday:'ע.חג', chol_hamoed:'חוה"מ' };

function roundBalance(value: number) {
  return Math.round(value * 100) / 100;
}


export default function CalculationPage() {
  const { state, dispatch } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [sel, setSel] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [exp, setExp] = useState<string|null>(null);
  const [done, setDone] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<{employeeId:string;month:number;year:number}|null>(null);
  const [calcWarnings, setCalcWarnings] = useState<string[]>([]);
  const [approvalTarget, setApprovalTarget] = useState<{employeeId:string;month:number;year:number}|null>(null);
  const [approverName, setApproverName] = useState('');

  const [editHoliday, setEditHoliday] = useState<{employeeId:string;date:string;clockIn:string;clockOut:string}|null>(null);

  const [showBulkHoliday, setShowBulkHoliday] = useState(false);
  const [bulkHolidayDate, setBulkHolidayDate] = useState('');
  const [bulkClockIn, setBulkClockIn] = useState('');
  const [bulkClockOut, setBulkClockOut] = useState('');
  const active = state.employees.filter(e=>e.isActive);
  const calcs = state.calculations.filter(c=>c.year===year&&c.month===month);
  const inp = 'field-input';

  async function run() {
    const list = sel.length ? active.filter(e => sel.includes(e.id)) : active;
    if (!list.length) { alert('אין עובדים'); return; }
    setRunning(true); setDone(false); setCalcWarnings([]);

    let holidays = state.holidays;
    try {
      holidays = await ensureHolidaysForYear(year, state.holidays, dispatch);
    } catch (err) {
      console.error('Failed to fetch holidays for year', year, err);
    }

    const results: MonthlyCalculation[] = [];
    const warnings: string[] = [];

    for (let emp of list) {
      const agr = state.agreements.find(a => a.id === emp.agreementId);
      if (!agr) continue;

      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const att = state.attendance.filter(r => r.employeeId === emp.id && r.date.startsWith(monthPrefix));

      if (att.length === 0) {
        warnings.push(`${emp.firstName} ${emp.lastName}: אין נתוני נוכחות לחודש זה — דילוג`);
        continue;
      }

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonthCalc = state.calculations.find(c =>
        c.employeeId === emp.id && c.month === prevMonth && c.year === prevYear
      );

      if (prevMonthCalc) {
        emp = {
          ...emp,
          sickDaysBalance: prevMonthCalc.endingSickBalance ?? emp.sickDaysBalance,
          vacationDaysBalance: prevMonthCalc.endingVacationBalance ?? emp.vacationDaysBalance,
          lastAccrualPeriod: undefined,
        };
      } else {
        const existingCalc = state.calculations.find(c =>
          c.employeeId === emp.id && c.month === month && c.year === year
        );
        if (existingCalc) {
          const allCalcs = state.calculations
            .filter(c => c.employeeId === emp.id)
            .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
          const firstCalc = allCalcs[0];
          emp = {
            ...emp,
            sickDaysBalance: firstCalc?.openingSickBalance ?? 0,
            vacationDaysBalance: firstCalc?.openingVacationBalance ?? 0,
            lastAccrualPeriod: undefined,
          };
        }
      }

      let prevGlobalOTBalance = 0;
      if (agr.type === 'monthly_global_offset' || agr.type === 'monthly_global_no_offset') {
        prevGlobalOTBalance = prevMonthCalc?.globalOvertimeBalance ?? 0;
      }

      try {
        const empHolidays = filterHolidaysForEmployee(holidays, emp.religion);
        const result = calculateMonth(emp, agr, att, empHolidays, year, month, prevGlobalOTBalance);
        result.agreementVersion = agr.version ?? 1;
        results.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`${emp.firstName} ${emp.lastName}: ${msg}`);
      }
    }

    const existingCalcs = state.calculations.filter(c => {
      return !results.some(r => r.employeeId === c.employeeId && r.month === c.month && r.year === c.year);
    });
    dispatch({ type: 'SET_CALCULATIONS', payload: [...existingCalcs, ...results] });

    for (const res of results) {
      const emp = list.find(e => e.id === res.employeeId);
      const agr = emp ? state.agreements.find(a => a.id === emp.agreementId) : null;
      if (!emp || !agr) continue;

      const period = `${year}-${String(month).padStart(2, '0')}`;
      const newGlobalOT = res.globalOvertimeBalance ?? emp.globalOvertimeBalance ?? 0;

      dispatch({
        type: 'UPDATE_EMPLOYEE',
        payload: {
          ...emp,
          sickDaysBalance: roundBalance(res.endingSickBalance),
          vacationDaysBalance: roundBalance(res.endingVacationBalance),
          globalOvertimeBalance: roundBalance(newGlobalOT),
          lastAccrualPeriod: period,
        },
      });
    }

    setCalcWarnings(warnings);
    setRunning(false); setDone(true);
  }

  function approveCalc() {
    if (!approvalTarget || !approverName.trim()) return;
    const calc = state.calculations.find(c =>
      c.employeeId === approvalTarget.employeeId && c.month === approvalTarget.month && c.year === approvalTarget.year
    );
    if (!calc) return;
    dispatch({ type: 'UPDATE_CALCULATION', payload: { ...calc, approvedBy: approverName.trim(), approvedAt: new Date().toISOString() } });
    setApprovalTarget(null); setApproverName('');
  }

  function saveHolidayEdit() {
    if (!editHoliday) return;
    const { employeeId, date, clockIn, clockOut } = editHoliday;
    const existing = state.attendance.find(r => r.employeeId === employeeId && r.date === date);
    if (existing) {
      dispatch({ type: 'UPDATE_ATTENDANCE', payload: { ...existing, clockIn, clockOut, actualHours: undefined, absenceType: 'holiday_work', isManual: true } });
    } else {
      dispatch({ type: 'ADD_ATTENDANCE_BATCH', payload: [{ id: generateId(), employeeId, date, clockIn, clockOut, isManual: true, absenceType: 'holiday_work' }] });
    }
    setEditHoliday(null);
  }

  function saveBulkHoliday() {
    if (!bulkHolidayDate || !bulkClockIn || !bulkClockOut) { alert('יש למלא תאריך, כניסה ויציאה'); return; }
    const records = active.map(emp => {
      const existing = state.attendance.find(r => r.employeeId === emp.id && r.date === bulkHolidayDate);
      if (existing) {
        return { ...existing, clockIn: bulkClockIn, clockOut: bulkClockOut, actualHours: undefined, absenceType: 'holiday_work' as const, isManual: true };
      }
      return { id: generateId(), employeeId: emp.id, date: bulkHolidayDate, clockIn: bulkClockIn, clockOut: bulkClockOut, isManual: true, absenceType: 'holiday_work' as const };
    });
    const toUpdate = records.filter(r => state.attendance.some(a => a.employeeId === r.employeeId && a.date === r.date));
    const toAdd = records.filter(r => !state.attendance.some(a => a.employeeId === r.employeeId && a.date === r.date));
    toUpdate.forEach(r => dispatch({ type: 'UPDATE_ATTENDANCE', payload: r }));
    if (toAdd.length > 0) dispatch({ type: 'ADD_ATTENDANCE_BATCH', payload: toAdd });
    setShowBulkHoliday(false); setBulkHolidayDate(''); setBulkClockIn(''); setBulkClockOut('');
  }

  const monthHolidayDates = state.holidays
    .filter(h => h.date.startsWith(`${year}-${String(month).padStart(2, '0')}`) && !h.isEveHoliday && !h.isCholHamoed)
    .map(h => ({ date: h.date, name: h.name }));

  return (
    <div className="page-shell">


      <div className="surface-card mb-6 p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label htmlFor="calc-year" className="block text-sm font-medium text-gray-700 mb-1">שנה</label><input id="calc-year" type="number" className={`${inp} w-24`} value={year} onChange={e=>{setYear(+e.target.value);setDone(false)}}/></div>
          <div><label htmlFor="calc-month" className="block text-sm font-medium text-gray-700 mb-1">חודש</label><select id="calc-month" className={inp} value={month} onChange={e=>{setMonth(+e.target.value);setDone(false)}}>{MONTH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{i+1} — {n}</option>)}</select></div>
          <div className="flex-1"><span className="block text-sm font-medium text-gray-700 mb-1">עובדים ({sel.length||'כולם'})</span><div className="flex gap-2"><button type="button" onClick={()=>setSel(active.map(e=>e.id))} className="text-xs text-indigo-600 font-medium hover:underline">בחר הכל</button><button type="button" onClick={()=>setSel([])} className="text-xs text-gray-400 font-medium hover:underline">נקה</button></div></div>
          <button type="button" onClick={run} disabled={running||!active.length} className="primary-btn disabled:opacity-50"><Play size={16}/>{running?<><Spinner size={16} className="text-white"/>מחשב...</>: `חשב ${MONTH_NAMES[month - 1]}`}</button>
          {calcs.length > 0 && (
            <button type="button" onClick={() => exportCalculationsToExcel(state.calculations, state.employees, state.agreements, year, month, 'all')} className="secondary-btn">
              <FileSpreadsheet size={16}/> יצוא Excel
            </button>
          )}
          {monthHolidayDates.length > 0 && (
            <button type="button" onClick={() => setShowBulkHoliday(true)} className="secondary-btn">
              <CalendarDays size={16}/> עריכת חגים קולקטיבית
            </button>
          )}
        </div>
        {active.length>0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {active.map(e=>(
              <button type="button" key={e.id} onClick={()=>setSel(p=>p.includes(e.id)?p.filter(x=>x!==e.id):[...p,e.id])}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${sel.includes(e.id)?'bg-teal-100 text-teal-700 ring-1 ring-inset ring-teal-700/10':'bg-white/70 text-gray-600 hover:bg-white'}`}>
                {e.firstName} {e.lastName}
              </button>
            ))}
          </div>
        )}
        {done && <div className="notice notice-success mt-4"><CheckCircle2 size={16}/> חישוב הושלם — {calcs.length} {calcs.length === 1 ? 'חישוב' : 'חישובים'}</div>}
        {calcWarnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {calcWarnings.map((w, i) => <div key={i} className="notice notice-warning text-xs py-1.5"><AlertCircle size={12}/> {w}</div>)}
          </div>
        )}
      </div>

      {calcs.length>0 && (
        <div className="space-y-4 anim-stagger">
          {calcs.map(c=>{
            const em=state.employees.find(e=>e.id===c.employeeId); const ag=state.agreements.find(a=>a.id===em?.agreementId); const isE=exp===c.employeeId;
            const hasWarnings = c.balanceWarnings && c.balanceWarnings.length > 0;
            const isApproved = !!c.approvedBy;
            const statusClass = isApproved ? 'calc-card--approved' : hasWarnings ? 'calc-card--warning' : '';
            return (
              <div key={c.employeeId} className={`calc-card ${statusClass}`}>

                <div className="calc-card__header">
                  <h4 className="text-sm font-bold text-gray-900">{em?.firstName} {em?.lastName}</h4>
                  <span className="text-xs font-mono text-gray-400">#{em?.employeeNumber}</span>
                  <span className="inline-flex items-center rounded-full bg-white/60 backdrop-blur px-2.5 py-0.5 text-[11px] font-medium text-cyan-700 border border-cyan-100">{ag?.name}</span>
                  <div className="flex-1"/>
                  <button type="button" onClick={() => exportCalculationsToExcel(state.calculations, state.employees, state.agreements, year, month, 'single', c.employeeId)} aria-label="יצוא Excel" className="p-1.5 text-gray-400 hover:text-green-600 rounded cursor-pointer"><FileSpreadsheet size={16}/></button>
                  <button type="button" onClick={()=>setDeleteCandidate({ employeeId:c.employeeId, month:c.month, year:c.year })} aria-label="מחק חישוב" className="p-1.5 text-gray-400 hover:text-red-500 rounded cursor-pointer"><Trash2 size={16}/></button>
                  <button type="button" onClick={()=>setExp(isE?null:c.employeeId)} aria-label={isE ? 'כיווץ' : 'הרחבה'} className="p-1.5 text-gray-400 hover:text-cyan-600 rounded cursor-pointer">{isE?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
                </div>

                <div className="calc-metrics" style={{gridTemplateColumns:`repeat(${3 + (c.totalOvertime125Hours>0?1:0) + (c.totalOvertime150Hours>0?1:0) + 2}, 1fr)`}}>
                  {[
                    { label: 'תקן חודשי', val: (c.totalPlannedHours ?? 0).toFixed(2), color: 'text-cyan-800' },
                    { label: 'בפועל', val: c.totalActualWorkHours.toFixed(2), color: 'text-gray-800' },
                    { label: 'רגיל', val: c.totalRegularHours.toFixed(2), color: 'text-gray-800' },
                    ...(c.totalOvertime125Hours > 0 ? [{ label: '125%', val: c.totalOvertime125Hours.toFixed(2), color: 'text-amber-700' }] : []),
                    ...((c.totalOvertime150Hours + c.totalSaturdayHours) > 0 ? [{ label: '150%', val: (c.totalOvertime150Hours + c.totalSaturdayHours).toFixed(2), color: 'text-orange-700' }] : []),
                    { label: 'משולמות', val: c.totalPaidHours.toFixed(2), color: 'text-teal-700' },
                    { label: 'ימי עבודה', val: String(c.actualWorkDays), color: 'text-gray-800' },
                  ].map((m, i) => (
                    <div key={i} className="calc-metric">
                      <div className={`calc-metric__val ${m.color}`}>{m.val}</div>
                      <div className="calc-metric__label">{m.label}</div>
                    </div>
                  ))}
                </div>

                {(c.totalSaturdayHours > 0 || c.totalSickHours > 0 || c.totalVacationHours > 0 || c.totalAbsenceHours > 0 || c.globalOvertimeOffsetTotal > 0 || c.totalUnpaidHours > 0) && (
                  <div className="calc-metrics" style={{gridTemplateColumns:`repeat(${[c.totalSaturdayOvertimeHours>0, (c.totalSaturdayOvertime2Hours??0)>0, c.totalSickHours>0, c.totalVacationHours>0, c.totalAbsenceHours>0, c.totalUnpaidHours>0, c.globalOvertimeOffsetTotal>0, c.globalOvertimeBalance>0, c.totalReserveDays>0].filter(Boolean).length}, 1fr)`}}>
                    {[
                      ...(c.totalSaturdayOvertimeHours > 0 ? [{ label: '175%', val: c.totalSaturdayOvertimeHours.toFixed(2), color: 'text-violet-700' }] : []),
                      ...((c.totalSaturdayOvertime2Hours ?? 0) > 0 ? [{ label: '200%', val: c.totalSaturdayOvertime2Hours!.toFixed(2), color: 'text-fuchsia-700' }] : []),
                      ...(c.totalSickHours > 0 ? [{ label: 'מחלה', val: c.totalSickHours.toFixed(2), color: 'text-red-600' }] : []),
                      ...(c.totalVacationHours > 0 ? [{ label: 'חופשה', val: c.totalVacationHours.toFixed(2), color: 'text-blue-600' }] : []),
                      ...(c.totalAbsenceHours > 0 ? [{ label: 'היעדרות', val: c.totalAbsenceHours.toFixed(2), color: 'text-rose-600' }] : []),
                      ...(c.totalUnpaidHours > 0 ? [{ label: 'ללא תשלום', val: c.totalUnpaidHours.toFixed(2), color: 'text-gray-500' }] : []),
                      ...(c.globalOvertimeOffsetTotal > 0 ? [{ label: 'סה"כ קיזוז', val: c.globalOvertimeOffsetTotal.toFixed(2), color: 'text-indigo-700' }] : []),
                      ...(c.globalOvertimeBalance > 0 ? [{ label: 'יתרת ש"נ', val: c.globalOvertimeBalance.toFixed(2), color: 'text-indigo-700' }] : []),
                      ...(c.totalReserveDays > 0 ? [{ label: 'מילואים', val: c.totalReserveDays.toFixed(2), color: 'text-green-700' }] : []),
                    ].map((m, i) => (
                      <div key={i} className="calc-metric">
                        <div className={`calc-metric__val ${m.color}`}>{m.val}</div>
                        <div className="calc-metric__label">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(c.endingSickBalance != null || c.endingVacationBalance != null) && (
                  <div className="calc-balance-bar space-y-1">
                    {c.endingSickBalance != null && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Thermometer size={12} className="text-red-400" aria-hidden="true"/>
                        <span className="font-semibold text-gray-600 w-12">מחלה</span>
                        <span className="font-mono text-gray-400">{(c.openingSickBalance??0).toFixed(2)}</span>
                        <span className="text-green-600 font-mono">+{c.sickDaysAccrued?.toFixed(2)}</span>
                        <span className="text-red-500 font-mono">-{c.totalSickDaysUsed?.toFixed(2)}</span>
                        <span className="text-gray-300">=</span>
                        <b className={`font-mono ${c.endingSickBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{c.endingSickBalance.toFixed(2)}</b>
                      </div>
                    )}
                    {c.endingVacationBalance != null && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Sun size={12} className="text-amber-400" aria-hidden="true"/>
                        <span className="font-semibold text-gray-600 w-12">חופשה</span>
                        <span className="font-mono text-gray-400">{(c.openingVacationBalance??0).toFixed(2)}</span>
                        <span className="text-green-600 font-mono">+{c.vacationDaysAccrued?.toFixed(2)}</span>
                        <span className="text-red-500 font-mono">-{c.totalVacationDaysUsed?.toFixed(2)}</span>
                        <span className="text-gray-300">=</span>
                        <b className={`font-mono ${c.endingVacationBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{c.endingVacationBalance.toFixed(2)}</b>
                      </div>
                    )}
                  </div>
                )}

                {c.balanceWarnings && c.balanceWarnings.length > 0 && (
                  <div className="px-5 py-2">
                    {c.balanceWarnings.map((w,i)=><div key={i} className="notice notice-warning text-xs py-1"><AlertCircle size={12}/>{w}</div>)}
                  </div>
                )}

                {c.calculatedAt && (
                  <div className="calc-footer">
                    <span>חושב: {new Date(c.calculatedAt).toLocaleString('he-IL')} | {c.agreementName}{c.agreementVersion ? ` v${c.agreementVersion}` : ''}</span>
                    {c.approvedBy ? (
                      <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={10}/> אושר ע"י {c.approvedBy}</span>
                    ) : (
                      <button type="button" onClick={() => setApprovalTarget({ employeeId: c.employeeId, month: c.month, year: c.year })}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer">
                        <CheckCircle2 size={10}/> אישור
                      </button>
                    )}
                  </div>
                )}

                {isE && (
                  <div className="calc-table-wrap overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead><tr>
                        <th className="text-right px-2 py-2 font-semibold text-gray-700">תאריך</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-500">יום</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-700">סוג</th>
                        <th className="text-right px-2 py-2 font-semibold text-teal-600">כניסה</th>
                        <th className="text-right px-2 py-2 font-semibold text-teal-600">יציאה</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-700">מתוכנן</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-700">בפועל</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-400">הפסקה</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-700">רגיל</th>
                        <th className="text-right px-2 py-2 font-semibold text-amber-600">125%</th>
                        <th className="text-right px-2 py-2 font-semibold text-orange-600">150%</th>
                        <th className="text-right px-2 py-2 font-semibold text-violet-600">175%</th>
                        <th className="text-right px-2 py-2 font-semibold text-fuchsia-600">200%</th>
                        <th className="text-right px-2 py-2 font-semibold text-blue-600">חופשה</th>
                        <th className="text-right px-2 py-2 font-semibold text-red-600">מחלה</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-500">הערות</th>
                        <th className="text-right px-2 py-2 font-semibold text-orange-500">חג/אירוע</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">{c.days.map((d:DayCalculation)=>{
                        const noActivity = d.actualHours === 0 && d.sickHours === 0 && d.vacationHours === 0 && d.absenceHours === 0 && d.saturdayHours === 0 && d.unpaidHours === 0;
                        const isWeekend = d.dayType === 'saturday' || d.dayType === 'friday' || d.dayType === 'rest_day';
                        if (noActivity && !isWeekend && d.plannedHours <= 0) return null;
                        const isHoliday = d.dayType === 'holiday';
                        const isEveHoliday = d.dayType === 'eve_holiday';
                        const holidayName = getHolidayNameForDate(state.holidays, d.date);
                        const rawNotes = d.notes.length > 0 ? d.notes.map(n => n.replace(/⚠\s*/g, '')).join(', ') : '';
                        const isEditing = editHoliday?.employeeId === c.employeeId && editHoliday?.date === d.date;
                        return (
                        <tr key={d.date} className={`hover:bg-blue-50/40 ${d.isNightShift ? 'bg-indigo-50/30' : ''} ${d.dayType === 'saturday' || d.dayType === 'rest_day' ? 'bg-purple-50/30' : ''} ${d.dayType === 'friday' ? 'bg-slate-50/50' : ''} ${isHoliday ? 'bg-gradient-to-l from-amber-100/70 via-orange-50/50 to-transparent border-r-2 border-orange-300' : ''} ${isEveHoliday ? 'bg-yellow-50/40' : ''}`}>
                          <td className="px-2 py-1.5 font-mono text-gray-500 text-[11px]">{d.date.slice(5)}</td>
                          <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                            {(() => { const dow = d.dayOfWeek != null ? d.dayOfWeek : new Date(d.date + 'T12:00:00').getDay(); return DOW_LABELS[dow]; })()}
                            {d.isNightShift && <Moon size={10} className="inline mr-1 text-indigo-400" aria-label="משמרת לילה"/>}
                          </td>
                          <td className={`px-2 py-1.5 ${isHoliday ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                            {DT[d.dayType]??d.dayType}
                            {isHoliday && !isEditing && (
                              <button type="button" onClick={() => setEditHoliday({ employeeId: c.employeeId, date: d.date, clockIn: d.clockIn ?? '', clockOut: d.clockOut ?? '' })}
                                className="inline-block mr-1 text-orange-400 hover:text-orange-600 cursor-pointer" aria-label="ערוך שעות חג">
                                <Pencil size={10}/>
                              </button>
                            )}
                          </td>
                          {isEditing ? (
                            <>
                              <td className="px-1 py-1"><input type="time" value={editHoliday.clockIn} onChange={e => setEditHoliday({...editHoliday, clockIn: e.target.value})} className="w-20 text-xs font-mono border border-orange-300 rounded px-1 py-0.5 bg-orange-50/50 focus:ring-1 focus:ring-orange-400"/></td>
                              <td className="px-1 py-1"><input type="time" value={editHoliday.clockOut} onChange={e => setEditHoliday({...editHoliday, clockOut: e.target.value})} className="w-20 text-xs font-mono border border-orange-300 rounded px-1 py-0.5 bg-orange-50/50 focus:ring-1 focus:ring-orange-400"/></td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-1.5 font-mono text-teal-600">{d.clockIn ?? '—'}</td>
                              <td className="px-2 py-1.5 font-mono text-teal-600">{d.clockOut ?? '—'}</td>
                            </>
                          )}
                          <td className="px-2 py-1.5 font-mono text-gray-400">{d.plannedHours > 0 ? d.plannedHours.toFixed(2) : '—'}</td>
                          <td className="px-2 py-1.5 font-mono font-medium text-gray-900">{d.actualHours > 0 ? d.actualHours.toFixed(2) : '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-400">{(d.breakDeductedHours??0)>0?d.breakDeductedHours!.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono">{d.regularHours>0?d.regularHours.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-amber-600">{d.overtime125Hours>0?d.overtime125Hours.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-orange-600">{(d.overtime150Hours + d.saturdayHours)>0?(d.overtime150Hours + d.saturdayHours).toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-violet-600">{d.saturdayOvertimeHours>0?d.saturdayOvertimeHours.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-fuchsia-600">{(d.saturdayOvertime2Hours??0)>0?d.saturdayOvertime2Hours!.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-blue-600">{d.vacationHours>0?d.vacationHours.toFixed(2):(d.vacationDeductedForAbsence??0)>0?<span className="text-sky-500">{d.vacationDeductedForAbsence!.toFixed(2)}*</span>:'—'}</td>
                          <td className="px-2 py-1.5 font-mono text-red-600">{d.sickHours>0?d.sickHours.toFixed(2):'—'}</td>
                          <td className="px-2 py-1.5 text-[10px] max-w-[200px] truncate text-gray-400" title={rawNotes}>
                            {isEditing ? (
                              <span className="flex gap-1">
                                <button type="button" onClick={saveHolidayEdit} className="px-1.5 py-0.5 rounded bg-orange-500 text-white text-[10px] font-semibold hover:bg-orange-600 cursor-pointer">שמור</button>
                                <button type="button" onClick={() => setEditHoliday(null)} className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold hover:bg-gray-300 cursor-pointer">ביטול</button>
                              </span>
                            ) : (rawNotes || '—')}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-orange-600 font-medium whitespace-nowrap max-w-[120px] truncate" title={holidayName ?? ''}>{holidayName || '—'}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!calcs.length && active.length>0 && !running && (
        <div className="surface-card empty-state">
          <div className="empty-state__icon"><Calculator size={32} /></div>
          <p className="empty-state__title">לחץ &quot;חשב&quot; להפעלת מנוע החישוב</p>
          <p className="empty-state__desc">{active.length} עובדים פעילים | {MONTH_NAMES[month - 1]} {year}</p>
        </div>
      )}
      {!active.length && (
        <div className="surface-card empty-state">
          <div className="empty-state__icon"><Users size={32} /></div>
          <p className="empty-state__title">אין עובדים פעילים</p>
          <p className="empty-state__desc">הוסף עובדים למערכת כדי להתחיל בחישוב שכר</p>
          <div className="empty-state__action"><Link to="/employees" className="primary-btn">הוסף עובדים</Link></div>
        </div>
      )}

      <Modal open={!!approvalTarget} onClose={() => setApprovalTarget(null)} title="אישור חישוב" size="sm"
        footer={<>
          <button type="button" onClick={() => setApprovalTarget(null)} className="secondary-btn">ביטול</button>
          <button type="button" onClick={approveCalc} disabled={!approverName.trim()} className="primary-btn disabled:opacity-50">אשר</button>
        </>}>
        <label htmlFor="approver-name" className="block text-sm font-medium text-gray-700 mb-1">שם המאשר</label>
        <input id="approver-name" className={inp} value={approverName} onChange={e => setApproverName(e.target.value)} placeholder="הכנס שם..." />
      </Modal>

      <Modal open={!!deleteCandidate} onClose={() => setDeleteCandidate(null)} title="אישור מחיקה" size="sm"
        footer={<>
          <button type="button" onClick={() => setDeleteCandidate(null)} className="secondary-btn">ביטול</button>
          <button type="button" onClick={() => { dispatch({ type: 'DELETE_CALCULATION', payload: deleteCandidate! }); setDeleteCandidate(null); }} className="primary-btn !bg-red-600 hover:!bg-red-700">מחק</button>
        </>}>
        <p className="text-sm text-gray-600">למחוק חישוב?</p>
      </Modal>

      <Modal open={showBulkHoliday} onClose={() => setShowBulkHoliday(false)}
        title="עריכת שעות חג — קולקטיבי"
        icon={<CalendarDays size={18} className="text-orange-500"/>}
        size="md"
        footer={<>
          <button type="button" onClick={() => setShowBulkHoliday(false)} className="secondary-btn">ביטול</button>
          <button type="button" onClick={saveBulkHoliday} disabled={!bulkHolidayDate || !bulkClockIn || !bulkClockOut}
            className="primary-btn !bg-orange-500 hover:!bg-orange-600 disabled:opacity-50">
            <CalendarDays size={14}/> החל על כל העובדים
          </button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">בחר תאריך חג והגדר שעות כניסה/יציאה. השעות יוחלו על <b>כל {active.length} העובדים הפעילים</b>.</p>
          <div>
            <label htmlFor="bulk-holiday-date" className="block text-sm font-medium text-gray-700 mb-1">תאריך חג</label>
            <select id="bulk-holiday-date" className={inp} value={bulkHolidayDate} onChange={e => setBulkHolidayDate(e.target.value)}>
              <option value="">— בחר חג —</option>
              {monthHolidayDates.map(h => (
                <option key={h.date} value={h.date}>{h.date} — {h.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bulk-clock-in" className="block text-sm font-medium text-gray-700 mb-1">שעת כניסה</label>
              <input id="bulk-clock-in" type="time" className={inp} value={bulkClockIn} onChange={e => setBulkClockIn(e.target.value)}/>
            </div>
            <div>
              <label htmlFor="bulk-clock-out" className="block text-sm font-medium text-gray-700 mb-1">שעת יציאה</label>
              <input id="bulk-clock-out" type="time" className={inp} value={bulkClockOut} onChange={e => setBulkClockOut(e.target.value)}/>
            </div>
          </div>
          {bulkHolidayDate && bulkClockIn && bulkClockOut && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
              יוחל על <b>{active.length}</b> עובדים: {bulkHolidayDate} | {bulkClockIn}–{bulkClockOut}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
