import { useState, useMemo, type ReactNode } from 'react';
import { useApp } from '../contexts/AppContext';
import { AlertTriangle, Clock, TrendingDown, Users, Activity, BarChart3, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { MONTH_NAMES } from '../lib/constants';
import { DOW_LABELS } from '../lib/calculationEngine';

type ReportTab = 'hours_anomalies' | 'below_threshold' | 'global_ot' | 'balance_anomalies' | 'balance_history' | 'absence_patterns';

const TABS: { k: ReportTab; l: string; icon: typeof AlertTriangle }[] = [
  { k: 'hours_anomalies', l: 'חריגות שעות', icon: Clock },
  { k: 'below_threshold', l: 'מתחת לסף', icon: TrendingDown },
  { k: 'global_ot', l: 'קיזוז ש"נ גלובלי', icon: Activity },
  { k: 'balance_anomalies', l: 'יתרות חריגות', icon: Users },
  { k: 'balance_history', l: 'היסטוריית יתרות', icon: CalendarDays },
  { k: 'absence_patterns', l: 'דפוסי היעדרות', icon: TrendingDown },
];

function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-auto max-h-[62vh]">
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { state } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<ReportTab>('hours_anomalies');
  const [minThresholdPct, setMinThresholdPct] = useState(80);
  const [expandedBalanceCards, setExpandedBalanceCards] = useState<Set<string>>(new Set());

  function toggleBalanceCard(empId: string) {
    setExpandedBalanceCards(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  const calcs = useMemo(() =>
    state.calculations.filter(c => c.year === year && c.month === month),
    [state.calculations, year, month]
  );

  const empMap = useMemo(() => {
    const m = new Map<string, typeof state.employees[0]>();
    for (const e of state.employees) {
      m.set(e.id, e);
    }
    return m;
  }, [state.employees]);

  const agrMap = useMemo(() => {
    const m = new Map<string, typeof state.agreements[0]>();
    for (const a of state.agreements) {
      m.set(a.id, a);
    }
    return m;
  }, [state.agreements]);

  const hoursAnomalies = useMemo(() => {
    const results: { empName: string; empNum: string; date: string; planned: number; actual: number; gap: number; dayType: string }[] = [];
    for (const calc of calcs) {
      const emp = empMap.get(calc.employeeId);
      if (!emp) continue;
      for (const day of calc.days) {
        if (day.plannedHours <= 0) continue;
        if (day.absenceType) continue;
        if (day.actualHours >= day.plannedHours) continue;
        const gap = day.plannedHours - day.actualHours;
        if (gap < 0.25) continue;
        results.push({
          empName: `${emp.firstName} ${emp.lastName}`,
          empNum: emp.employeeNumber,
          date: day.date,
          planned: day.plannedHours,
          actual: day.actualHours,
          gap,
          dayType: day.dayType,
        });
      }
    }
    return results.sort((a, b) => b.gap - a.gap);
  }, [calcs, empMap]);

  const hoursAnomaliesByEmployee = useMemo(() => {
    const grouped = new Map<string, { empName: string; empNum: string; totalGap: number; items: typeof hoursAnomalies }>();
    for (const r of hoursAnomalies) {
      const key = r.empNum;
      if (!grouped.has(key)) grouped.set(key, { empName: r.empName, empNum: r.empNum, totalGap: 0, items: [] });
      const g = grouped.get(key)!;
      g.totalGap += r.gap;
      g.items.push(r);
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalGap - a.totalGap);
  }, [hoursAnomalies]);

  const belowThreshold = useMemo(() => {
    const results: { empName: string; empNum: string; totalPlanned: number; totalActual: number; pct: number }[] = [];
    for (const calc of calcs) {
      const emp = empMap.get(calc.employeeId);
      if (!emp) continue;
      const totalPlanned = calc.days.reduce((s, d) => s + d.plannedHours, 0);
      if (totalPlanned <= 0) continue;
      const pct = (calc.totalActualWorkHours / totalPlanned) * 100;
      if (pct < minThresholdPct) {
        results.push({
          empName: `${emp.firstName} ${emp.lastName}`,
          empNum: emp.employeeNumber,
          totalPlanned,
          totalActual: calc.totalActualWorkHours,
          pct,
        });
      }
    }
    return results.sort((a, b) => a.pct - b.pct);
  }, [calcs, empMap, minThresholdPct]);

  const globalOTReport = useMemo(() => {
    const results: { empName: string; empNum: string; agrName: string; allocated: number; balance: number; offsetTotal: number; isNegative: boolean }[] = [];
    for (const calc of calcs) {
      const emp = empMap.get(calc.employeeId);
      if (!emp) continue;
      const agr = agrMap.get(emp.agreementId);
      if (!agr) continue;
      if (agr.type !== 'monthly_global_offset' && agr.type !== 'monthly_global_no_offset') continue;
      results.push({
        empName: `${emp.firstName} ${emp.lastName}`,
        empNum: emp.employeeNumber,
        agrName: agr.name,
        allocated: agr.globalOvertimeHours ?? 0,
        balance: calc.globalOvertimeBalance,
        offsetTotal: calc.globalOvertimeOffsetTotal,
        isNegative: calc.globalOvertimeBalance < 0,
      });
    }
    return results.sort((a, b) => a.balance - b.balance);
  }, [calcs, empMap, agrMap]);

  const balanceAnomalies = useMemo(() => {
    const results: { empName: string; empNum: string; type: string; balance: number; max: number; issue: string }[] = [];
    for (const emp of state.employees) {
      if (!emp.isActive) continue;
      const agr = agrMap.get(emp.agreementId);
      if (!agr) continue;

      if (emp.sickDaysBalance < 0) {
        results.push({ empName: `${emp.firstName} ${emp.lastName}`, empNum: emp.employeeNumber, type: 'מחלה', balance: emp.sickDaysBalance, max: agr.sickDayMaxAccrual, issue: 'יתרה שלילית' });
      }
      if (emp.sickDaysBalance > agr.sickDayMaxAccrual) {
        results.push({ empName: `${emp.firstName} ${emp.lastName}`, empNum: emp.employeeNumber, type: 'מחלה', balance: emp.sickDaysBalance, max: agr.sickDayMaxAccrual, issue: 'חריגת תקרה' });
      }
      if (emp.vacationDaysBalance < 0) {
        results.push({ empName: `${emp.firstName} ${emp.lastName}`, empNum: emp.employeeNumber, type: 'חופשה', balance: emp.vacationDaysBalance, max: agr.vacationMaxAccrual, issue: 'יתרה שלילית' });
      }
      if (emp.vacationDaysBalance > agr.vacationMaxAccrual) {
        results.push({ empName: `${emp.firstName} ${emp.lastName}`, empNum: emp.employeeNumber, type: 'חופשה', balance: emp.vacationDaysBalance, max: agr.vacationMaxAccrual, issue: 'חריגת תקרה' });
      }
    }
    return results;
  }, [state.employees, agrMap]);

  const negativeGlobalOT = useMemo(
    () => globalOTReport.filter(r => r.isNegative),
    [globalOTReport]
  );

  const balanceHistory = useMemo(() => {
    const grouped = new Map<string, {
      employeeId: string;
      empName: string;
      empNum: string;
      rows: {
        year: number; month: number;
        openingSickBalance: number; sickDaysAccrued: number; totalSickDaysUsed: number; endingSickBalance: number;
        openingVacationBalance: number; vacationDaysAccrued: number; totalVacationDaysUsed: number; endingVacationBalance: number;
      }[];
    }>();

    for (const calc of state.calculations) {
      const emp = empMap.get(calc.employeeId);
      if (!emp) continue;
      const key = calc.employeeId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          employeeId: calc.employeeId,
          empName: `${emp.firstName} ${emp.lastName}`,
          empNum: emp.employeeNumber,
          rows: [],
        });
      }
      grouped.get(key)!.rows.push({
        year: calc.year,
        month: calc.month,
        openingSickBalance: calc.openingSickBalance,
        sickDaysAccrued: calc.sickDaysAccrued,
        totalSickDaysUsed: calc.totalSickDaysUsed,
        endingSickBalance: calc.endingSickBalance,
        openingVacationBalance: calc.openingVacationBalance,
        vacationDaysAccrued: calc.vacationDaysAccrued,
        totalVacationDaysUsed: calc.totalVacationDaysUsed,
        endingVacationBalance: calc.endingVacationBalance,
      });
    }

    for (const entry of grouped.values()) {
      entry.rows.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.empNum.localeCompare(b.empNum, 'he')
    );
  }, [state.calculations, empMap]);

  const absencePatterns = useMemo(() => {
    const patterns: { empName: string; empNum: string; dayOfWeek: number; dayName: string; count: number; dates: string[] }[] = [];

    for (const emp of state.employees) {
      const empAttendance = state.attendance.filter(a => a.employeeId === emp.id);
      const dayCount: Record<number, string[]> = {};

      for (const rec of empAttendance) {
        if (!rec.absenceType) continue;
        const dow = new Date(rec.date + 'T12:00:00').getDay();
        if (!dayCount[dow]) dayCount[dow] = [];
        dayCount[dow].push(rec.date);
      }

      for (const [dow, dates] of Object.entries(dayCount)) {
        if (dates.length >= 3) {
          patterns.push({
            empName: `${emp.firstName} ${emp.lastName}`,
            empNum: emp.employeeNumber,
            dayOfWeek: +dow,
            dayName: DOW_LABELS[+dow],
            count: dates.length,
            dates,
          });
        }
      }
    }

    return patterns.sort((a, b) => b.count - a.count);
  }, [state.employees, state.attendance]);

  const tabCounts: Record<ReportTab, number> = {
    hours_anomalies: hoursAnomalies.length,
    below_threshold: belowThreshold.length,
    global_ot: negativeGlobalOT.length,
    balance_anomalies: balanceAnomalies.length,
    balance_history: balanceHistory.length,
    absence_patterns: absencePatterns.length,
  };

  const summaryCards = [
    {
      label: 'חריגות שעות',
      value: hoursAnomalies.length,
      icon: Clock,
      color: 'red' as const,
      sub: 'ימים ללא היעדרות מאושרת',
    },
    {
      label: 'מתחת לסף',
      value: belowThreshold.length,
      icon: TrendingDown,
      color: 'amber' as const,
      sub: `מתחת ל-${minThresholdPct}% מהמתוכנן`,
    },
    {
      label: 'ש"נ גלובלי שלילי',
      value: negativeGlobalOT.length,
      icon: Activity,
      color: 'orange' as const,
      sub: 'חריגת יתרה גלובלית',
    },
    {
      label: 'בעיות יתרה',
      value: balanceAnomalies.length,
      icon: Users,
      color: 'purple' as const,
      sub: 'חופשה / מחלה חריגה',
    },
  ] as const;

  const colorMap = {
    red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',    num: 'text-red-600',    ring: 'ring-red-200'    },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600', num: 'text-amber-600', ring: 'ring-amber-200'  },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', num: 'text-orange-600', ring: 'ring-orange-200' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', num: 'text-purple-600', ring: 'ring-purple-200' },
  };

  const inp = 'field-input';

  return (
    <div className="page-shell">
      <div className="surface-card mb-6 p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="rpt-year" className="block text-sm font-medium text-gray-700 mb-1">שנה</label>
            <input id="rpt-year" type="number" className={`${inp} w-24`} value={year} onChange={e => setYear(+e.target.value)} />
          </div>
          <div>
            <label htmlFor="rpt-month" className="block text-sm font-medium text-gray-700 mb-1">חודש</label>
            <select id="rpt-month" className={inp} value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{i + 1} — {n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 pb-1">
            <BarChart3 size={15} className="text-gray-400" />
            <span>{calcs.length} חישובים ל-{MONTH_NAMES[month - 1]} {year}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {summaryCards.map(({ label, value, icon: Icon, color, sub }) => {
          const c = colorMap[color];
          return (
            <div
              key={label}
              className={`rounded-[16px] border bg-white ring-1 ${c.ring} shadow-md p-4 flex items-start gap-3 transition-shadow hover:shadow-lg`}
            >
              <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${c.icon}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className={`text-2xl font-black font-mono leading-none ${value > 0 ? c.num : 'text-gray-300'}`}>
                  {value}
                </div>
                <div className="text-sm font-semibold text-gray-700 mt-0.5 leading-tight">{label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tab-shell mb-6 p-2">
        <nav className="flex flex-wrap gap-2" role="tablist" aria-label="דוחות בקרה">
          {TABS.map(({ k, l, icon: Icon }) => {
            const count = tabCounts[k];
            const isActive = tab === k;
            return (
              <button
                type="button"
                key={k}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(k)}
                className={`tab-button flex items-center gap-2 ${isActive ? 'tab-button--active' : 'tab-button--idle'}`}
              >
                <Icon size={15} />
                <span>{l}</span>
                {count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black leading-none
                      ${isActive
                        ? 'bg-white/25 text-white'
                        : k === 'below_threshold'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'hours_anomalies' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">חריגות שעות</h3>
              <p className="text-xs text-gray-500 mt-0.5">{hoursAnomaliesByEmployee.length} עובדים עם חריגות • {hoursAnomalies.length} ימים סה"כ</p>
            </div>
          </div>

          {hoursAnomaliesByEmployee.length === 0 && (
            <div className="surface-card text-center py-14 text-sm text-gray-400">אין חריגות שעות בתקופה</div>
          )}

          {hoursAnomaliesByEmployee.map(({ empName, empNum, totalGap, items }) => (
            <div key={empNum} className="surface-card !p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/50 bg-white/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 font-bold text-sm">
                    {empName.charAt(0)}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-900">{empName}</span>
                    <span className="text-xs font-mono text-gray-400 mr-2">#{empNum}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">חריגות</div>
                    <div className="text-sm font-bold font-mono text-red-600">{items.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">סה"כ פער</div>
                    <div className="text-sm font-bold font-mono text-red-600">{totalGap.toFixed(2)} שע'</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2 hover:bg-cyan-50/30 transition-colors text-sm">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-gray-500 w-24">{r.date}</span>
                      <span className="text-xs text-gray-400 w-16">{r.dayType === 'regular' ? 'רגיל' : r.dayType}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-xs">מתוכנן <b className="font-mono text-gray-600">{r.planned.toFixed(2)}</b></span>
                      <span className="text-gray-400 text-xs">בפועל <b className="font-mono text-gray-900">{r.actual.toFixed(2)}</b></span>
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 font-bold font-mono text-xs px-2 py-0.5 rounded-full border border-red-200">
                        <AlertTriangle size={10} />
                        {r.gap.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'below_threshold' && (
        <div className="table-shell">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600 mt-0.5">
                <TrendingDown size={15} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">עובדים מתחת לסף עבודה</h3>
                <p className="text-xs text-gray-500 mt-0.5">עובדים שעבדו פחות מ-{minThresholdPct}% מהשעות המתוכננות</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="threshold-pct" className="text-xs text-gray-500">סף %</label>
              <input id="threshold-pct" type="number" min={0} max={100} className={`${inp} w-16 text-center`}
                value={minThresholdPct} onChange={e => setMinThresholdPct(+e.target.value)} />
            </div>
          </div>
          {belowThreshold.length === 0 ? (
            <div className="text-center py-14 text-sm text-gray-400">כל העובדים מעל הסף</div>
          ) : (
            <TableWrapper>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">עובד</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">מס'</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">מתוכנן</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">בפועל</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-amber-600 bg-gradient-to-b from-blue-50 to-[#eef4ff]">אחוז</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {belowThreshold.map((r, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                      <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{r.empName}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-400">{r.empNum}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-500 font-mono">{r.totalPlanned.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-900 font-medium font-mono">{r.totalActual.toFixed(2)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-sm font-black font-mono ${r.pct < 50 ? 'text-red-600' : 'text-amber-600'}`}>
                          {r.pct < 50 && <AlertTriangle size={11} />}
                          {r.pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {tab === 'global_ot' && (
        <div className="table-shell">
          <div className="border-b border-slate-200/70 px-5 py-4 flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 text-orange-600 mt-0.5">
              <Activity size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">קיזוז שעות נוספות גלובליות</h3>
              <p className="text-xs text-gray-500 mt-0.5">עובדים עם הסכם גלובלי — שימוש ביתרת ש"נ לקיזוז היעדרויות</p>
            </div>
          </div>
          {globalOTReport.length === 0 ? (
            <div className="text-center py-14 text-sm text-gray-400">אין עובדים עם הסכם גלובלי בתקופה</div>
          ) : (
            <TableWrapper>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">עובד</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">הסכם</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">הקצאה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">קוזז</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">יתרה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {globalOTReport.map((r, i) => (
                    <tr key={i} className={r.isNegative ? 'bg-red-50/60' : i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                      <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{r.empName}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{r.agrName}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-500 font-mono">{r.allocated.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-sm text-orange-600 font-medium font-mono">{r.offsetTotal.toFixed(2)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-sm font-black font-mono ${r.isNegative ? 'text-red-600' : 'text-green-600'}`}>
                          {r.isNegative && <AlertTriangle size={11} />}
                          {r.balance.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {tab === 'balance_anomalies' && (
        <div className="table-shell">
          <div className="border-b border-slate-200/70 px-5 py-4 flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600 mt-0.5">
              <Users size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">יתרות חריגות</h3>
              <p className="text-xs text-gray-500 mt-0.5">עובדים עם יתרת חופשה או מחלה שלילית / חריגת תקרה</p>
            </div>
          </div>
          {balanceAnomalies.length === 0 ? (
            <div className="text-center py-14 text-sm text-gray-400">אין חריגות יתרות</div>
          ) : (
            <TableWrapper>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">עובד</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">מס'</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">סוג</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">יתרה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">תקרה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-red-600 bg-gradient-to-b from-blue-50 to-[#eef4ff]">בעיה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {balanceAnomalies.map((r, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-red-50/40' : 'bg-red-50/20'}>
                      <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{r.empName}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-400">{r.empNum}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-500">{r.type}</td>
                      <td className={`py-2.5 px-4 text-sm font-black font-mono ${r.balance < 0 ? 'text-red-600' : 'text-amber-600'}`}>{r.balance.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-500 font-mono">{r.max}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                          <AlertTriangle size={11} /> {r.issue}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {tab === 'balance_history' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
              <CalendarDays size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">היסטוריית יתרות</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {balanceHistory.length} עובדים — יתרות מחלה וחופשה לאורך כל החודשים המחושבים
              </p>
            </div>
          </div>

          {balanceHistory.length === 0 && (
            <div className="surface-card text-center py-14 text-sm text-gray-400">אין חישובים במערכת</div>
          )}

          {balanceHistory.map(({ employeeId, empName, empNum, rows }) => {
            const isOpen = expandedBalanceCards.has(employeeId);
            return (
              <div key={employeeId} className="surface-card !p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleBalanceCard(employeeId)}
                  className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-200/50 bg-white/40 hover:bg-blue-50/30 transition-colors text-right"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 font-bold text-sm flex-shrink-0">
                      {empName.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900">{empName}</span>
                      <span className="text-xs font-mono text-gray-400 mr-2">#{empNum}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span className="text-xs text-gray-500">{rows.length} חודשים</span>
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead>
                        <tr>
                          <th rowSpan={2} className="py-2 px-3 text-right font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff] border-l border-gray-200">חודש</th>
                          <th colSpan={4} className="py-1.5 px-3 text-center font-semibold text-blue-700 bg-gradient-to-b from-blue-50 to-[#eef4ff] border-l border-blue-200">מחלה (ימים)</th>
                          <th colSpan={4} className="py-1.5 px-3 text-center font-semibold text-teal-700 bg-gradient-to-b from-teal-50 to-[#edfdf8]">חופשה (ימים)</th>
                        </tr>
                        <tr>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-blue-50/70 border-l border-gray-100">פתיחה</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-blue-50/70">צבירה</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-blue-50/70">ניצול</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-blue-50/70 border-l border-blue-200">סגירה</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-teal-50/70">פתיחה</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-teal-50/70">צבירה</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-teal-50/70">ניצול</th>
                          <th className="py-1.5 px-3 text-right font-semibold text-gray-600 bg-teal-50/70">סגירה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {rows.map((r, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="py-2 px-3 font-medium text-gray-700 whitespace-nowrap border-l border-gray-200">
                              {MONTH_NAMES[r.month - 1]} {String(r.year).slice(2)}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-500 border-l border-gray-100">{r.openingSickBalance.toFixed(2)}</td>
                            <td className="py-2 px-3 font-mono text-green-600">{r.sickDaysAccrued.toFixed(2)}</td>
                            <td className="py-2 px-3 font-mono text-red-500">{r.totalSickDaysUsed.toFixed(2)}</td>
                            <td className={`py-2 px-3 font-mono font-semibold border-l border-blue-100 ${r.endingSickBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {r.endingSickBalance.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-500">{r.openingVacationBalance.toFixed(2)}</td>
                            <td className="py-2 px-3 font-mono text-green-600">{r.vacationDaysAccrued.toFixed(2)}</td>
                            <td className="py-2 px-3 font-mono text-red-500">{r.totalVacationDaysUsed.toFixed(2)}</td>
                            <td className={`py-2 px-3 font-mono font-semibold ${r.endingVacationBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {r.endingVacationBalance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'absence_patterns' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <TrendingDown size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">דפוסי היעדרות</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                עובדים שנעדרו ביום ספציפי בשבוע 3 פעמים ומעלה
              </p>
            </div>
          </div>

          {absencePatterns.length === 0 && (
            <div className="surface-card text-center py-14 text-sm text-gray-400">לא נמצאו דפוסי היעדרות חוזרים</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {absencePatterns.map((p, i) => (
              <div key={i} className="surface-card !p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 bg-amber-50/40">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 font-bold text-sm flex-shrink-0">
                    {p.empName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-900 block truncate">{p.empName}</span>
                    <span className="text-xs font-mono text-gray-400">#{p.empNum}</span>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      <AlertTriangle size={10} />
                      נעדר ביום {p.dayName}
                    </span>
                    <span className="text-sm font-black text-red-600 font-mono">{p.count}</span>
                    <span className="text-xs text-gray-500">פעמים</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {[...p.dates].sort().map((d, j) => (
                      <span key={j} className="text-[11px] font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {calcs.length === 0 && tab === 'hours_anomalies' && (
        <div className="surface-card py-16 text-center mt-4">
          <AlertTriangle size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">אין חישובים לתקופה זו</p>
          <p className="text-xs text-gray-400 mt-1">הרץ חישוב בעמוד החישוב כדי לראות דוחות בקרה</p>
        </div>
      )}
    </div>
  );
}
