import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import type { AgreementParams, AgreementType } from '../types';
import { AGREEMENT_LABELS } from '../types';
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { generateId } from '../lib/utils';
const defaultAgreement = (): AgreementParams => ({
  id: generateId(),
  name: '',
  type: 'monthly_overtime',
  effectiveDate: '',
  weeklyHoursStandard: 42.5,
  dailyHoursStandard: 8.5,
  shortDayHours: 7.5,
  fridayHours: 7.5,
  eveHolidayHours: 7,
  eveHolidayPaidHours: 7,
  workDaysPerWeek: 5,
  cholHamoedHours: 8.5,
  overtimeBaseHours: undefined,
  overtimeRate1: 1.25,
  overtimeRate2: 1.50,
  overtimeThreshold1: 2,
  saturdayRate: 1.50,
  saturdayOvertimeThreshold: 0,
  saturdayOvertimeRate: 1.75,
  saturdayOvertime2Threshold: 0,
  saturdayOvertime2Rate: 2.00,
  calculateOvertimeDaily: true,
  calculateOvertimeWeekly: true,
  globalOvertimeHours: 20,
  minHoursForAbsenceOffset: 4,
  allowInterMonthCarry: false,
  globalOTTrackingMode: 'offset_only',
  allowNegativeGlobalOT: false,
  absenceCalculation: 'hourly',
  roundingMethod: 'quarter',
  regularExtendedBaseHours: undefined,
  nightShiftEnabled: false,
  nightShiftStandardHours: 7,
  absenceDeductFromVacation: false,
  sickOpeningBalance: 0,
  vacationOpeningBalance: 0,
  sickAccrualType: 'legal',
  sickDayAccrualPerMonth: 1.5,
  sickDayMaxAccrual: 90,
  sickDay1Payment: 0,
  sickDay2_3Payment: 0.5,
  sickDay4PlusPayment: 1.0,
  sickDayHoursEquivalent: 8.5,
  vacationAccrualType: 'legal',
  vacationDaysPerYear: 10,
  vacationUnit: 'days',
  vacationMaxAccrual: 30,
  vacationCarryOverPolicy: 'carry_all',
  vacationCarryOverMax: 10,
  vacationDistributionMethod: 'monthly_equal',
  vacation4PercentForHourly: false,
  requireCompensatoryRest: false,
  breakMinutes: 30,
  useWeeklyTemplate: false,
  weeklyTemplate: {
    0: 8.5,
    1: 8.5,
    2: 8.5,
    3: 8.5,
    4: 8.5,
    5: 7.5,
    6: 0,
  },
});

const typeColor: Record<AgreementType, string> = {
  hourly: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  monthly_overtime: 'bg-green-50 text-green-700 ring-green-600/20',
  monthly_global_offset: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  monthly_global_no_offset: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function getAgreementDetails(a: AgreementParams): [string, string | number][] {
  return [
    ['שבועי', a.weeklyHoursStandard], ['יומי', a.dailyHoursStandard], ['מקוצר', a.shortDayHours],
    ['ע.חג', a.eveHolidayHours], ['125%', a.overtimeThreshold1 + 'שע\''], ['שבת', `${(a.saturdayRate * 100).toFixed(0)}%`],
    ['מחלה/חוד', a.sickDayAccrualPerMonth], ['חופשה/שנה', a.vacationDaysPerYear],
    ['עיגול', a.roundingMethod === 'quarter' ? 'רבע' : a.roundingMethod === 'half' ? 'חצי' : 'ללא'],
    ['תקרת חופשה', a.vacationMaxAccrual], ['תקרת מחלה', a.sickDayMaxAccrual],
  ];
}

interface FieldDef {
  l: string;
  k: keyof AgreementParams;
  type: 'text' | 'num' | 'select' | 'check';
  span?: number;
  opts?: [string, string][];
  visible?: (record: AgreementParams) => boolean;
}

const WIZARD_STEPS = ['בסיס', 'שעות עבודה', 'שעות נוספות', 'מחלה וחופשה'];

interface WizardState {
  name: string;
  type: AgreementType;
  workDaysPerWeek: 5 | 6;
  dailyHoursStandard: number;
  weeklyHoursStandard: number;
  shortDayHours: number;
  fridayHours: number;
  eveHolidayHours: number;
  breakMinutes: number;
  overtimeThreshold1: number;
  saturdayRate: number;
  calculateOvertimeDaily: boolean;
  calculateOvertimeWeekly: boolean;
  globalOvertimeHours: number;
  minHoursForAbsenceOffset: number;
  sickDayAccrualPerMonth: number;
  sickDayMaxAccrual: number;
  vacationDaysPerYear: number;
  vacationMaxAccrual: number;
}

const defaultWizard = (): WizardState => ({
  name: '',
  type: 'monthly_overtime',
  workDaysPerWeek: 5,
  dailyHoursStandard: 8.5,
  weeklyHoursStandard: 42.5,
  shortDayHours: 7.5,
  fridayHours: 7.5,
  eveHolidayHours: 7,
  breakMinutes: 30,
  overtimeThreshold1: 2,
  saturdayRate: 1.5,
  calculateOvertimeDaily: true,
  calculateOvertimeWeekly: true,
  globalOvertimeHours: 20,
  minHoursForAbsenceOffset: 4,
  sickDayAccrualPerMonth: 1.5,
  sickDayMaxAccrual: 90,
  vacationDaysPerYear: 10,
  vacationMaxAccrual: 30,
});

export default function AgreementsPage() {
  const { state, dispatch } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgreementParams | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [useWizard, setUseWizard] = useState(true);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(defaultWizard());

  function startAdd() {
    setWizard(defaultWizard());
    setWizardStep(1);
    setForm(defaultAgreement());
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(a: AgreementParams) {
    setForm({ ...a });
    setEditingId(a.id);
    setShowForm(true);
  }

  function cloneAgreement(a: AgreementParams) {
    const clone: AgreementParams = {
      ...a,
      id: generateId(),
      name: `${a.name} (העתק)`,
    };
    setForm(clone);
    setEditingId(null);
    setShowForm(true);
  }

  function save() {
    if (!form?.name.trim()) { alert('נא להזין שם הסכם'); return; }
    if (form.vacationCarryOverPolicy === 'carry_limited' && (form.vacationCarryOverMax ?? 0) <= 0) {
      alert('מדיניית ניוד מוגבל דורשת ערך מקסימלי גדול מאפס בשדה "מקס\' ניוד ימים"'); return;
    }
    dispatch({ type: editingId ? 'UPDATE_AGREEMENT' : 'ADD_AGREEMENT', payload: form! }); setShowForm(false); setForm(null);
  }

  function wizardFinish() {
    if (!wizard.name.trim()) { alert('נא להזין שם הסכם'); return; }
    const base = defaultAgreement();
    const final: AgreementParams = {
      ...base,
      name: wizard.name,
      type: wizard.type,
      workDaysPerWeek: wizard.workDaysPerWeek,
      dailyHoursStandard: wizard.dailyHoursStandard,
      weeklyHoursStandard: wizard.weeklyHoursStandard,
      shortDayHours: wizard.shortDayHours,
      fridayHours: wizard.fridayHours,
      eveHolidayHours: wizard.eveHolidayHours,
      eveHolidayPaidHours: wizard.eveHolidayHours,
      breakMinutes: wizard.breakMinutes,
      overtimeThreshold1: wizard.overtimeThreshold1,
      saturdayRate: wizard.saturdayRate,
      calculateOvertimeDaily: wizard.calculateOvertimeDaily,
      calculateOvertimeWeekly: wizard.calculateOvertimeWeekly,
      globalOvertimeHours: wizard.globalOvertimeHours,
      minHoursForAbsenceOffset: wizard.minHoursForAbsenceOffset,
      sickDayAccrualPerMonth: wizard.sickDayAccrualPerMonth,
      sickDayMaxAccrual: wizard.sickDayMaxAccrual,
      sickDayHoursEquivalent: wizard.dailyHoursStandard,
      vacationDaysPerYear: wizard.vacationDaysPerYear,
      vacationMaxAccrual: wizard.vacationMaxAccrual,
    };
    dispatch({ type: 'ADD_AGREEMENT', payload: final });
    setShowForm(false);
    setForm(null);
  }

  function del(id: string) { if (state.employees.some(e => e.agreementId === id)) { alert('משויך לעובדים'); return; } if (confirm('למחוק?')) dispatch({ type: 'DELETE_AGREEMENT', payload: id }); }

  const closeModal = useCallback(() => setShowForm(false), []);
  useEffect(() => {
    if (!showForm) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showForm, closeModal]);

  const inp = 'field-input';
  const isGlobal = form?.type === 'monthly_global_offset' || form?.type === 'monthly_global_no_offset';
  const isWizardGlobal = wizard.type === 'monthly_global_offset' || wizard.type === 'monthly_global_no_offset';

  const showWizardMode = !editingId && useWizard;

  function wizardNext() {
    if (wizardStep === 1 && !wizard.name.trim()) { alert('נא להזין שם הסכם'); return; }
    if (wizardStep < 4) setWizardStep(s => s + 1);
  }

  function wizardPrev() {
    if (wizardStep > 1) setWizardStep(s => s - 1);
  }

  return (
    <div className="page-shell">
      <div className="flex flex-wrap gap-2 mb-5">
        <button type="button" onClick={startAdd} className="primary-btn">
          <Plus size={15} /> הוסף הסכם
        </button>
      </div>

      <div className="space-y-3">
        {state.agreements.map(a => {
          const empCount = state.employees.filter(e => e.agreementId === a.id).length;
          const isExp = expandedId === a.id;
          const isG = a.type === 'monthly_global_offset' || a.type === 'monthly_global_no_offset';
          return (
            <div key={a.id} className="surface-card !p-0 overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900">{a.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${typeColor[a.type]}`}>{AGREEMENT_LABELS[a.type]}</span>
                    {a.version && <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">v{a.version}</span>}
                    <span className="text-xs text-gray-400">{empCount} עובדים</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">שבועי: {a.weeklyHoursStandard}שע' | יומי: {a.dailyHoursStandard}שע' | {a.workDaysPerWeek} ימים{isG ? ` | גלובלי: ${a.globalOvertimeHours}שע'` : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                      מחלה {a.sickDayAccrualPerMonth}/חודש
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                      חופשה {a.vacationDaysPerYear} ימים/שנה
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                      ש"נ אחרי {a.overtimeThreshold1} שע'
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 mt-0.5">
                  <button type="button" onClick={() => setExpandedId(isExp ? null : a.id)} aria-label={isExp ? 'כיווץ' : 'הרחבה'} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">{isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  <button type="button" onClick={() => cloneAgreement(a)} aria-label="שכפול" title="שכפל הסכם" className="p-1.5 text-gray-400 hover:text-indigo-500 rounded"><Copy size={14} /></button>
                  <button type="button" onClick={() => startEdit(a)} aria-label="עריכה" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"><Edit2 size={14} /></button>
                  <button type="button" onClick={() => del(a.id)} aria-label="מחיקה" className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
              {isExp && (
                <div className="border-t border-slate-200/70 px-5 pb-5 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    {getAgreementDetails(a).map(([l, v]) =>
                      <div key={String(l)} className="rounded-[18px] bg-white/60 px-3 py-2"><span className="text-gray-400">{l}: </span><span className="font-medium text-gray-700">{v}</span></div>
                    )}
                  </div>
                  {a.versionHistory && a.versionHistory.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-gray-600 mb-2">היסטוריית גרסאות ({a.versionHistory.length})</h5>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {a.versionHistory.slice(0, 20).map(v => (
                          <div key={v.version} className="flex items-center gap-3 text-[11px] text-gray-500 bg-white/50 rounded-lg px-3 py-1.5">
                            <span className="font-mono font-medium text-gray-700">v{v.version}</span>
                            <span>{new Date(v.modifiedAt).toLocaleString('he-IL')}</span>
                            {v.modifiedBy && <span className="text-gray-400">ע"י {v.modifiedBy}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {state.agreements.length === 0 && <div className="surface-card text-center py-14 text-sm text-gray-400">אין הסכמים — לחץ "הוסף הסכם"</div>}
      </div>

      {showForm && form && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <button type="button" className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={closeModal} aria-label="סגור חלון" />
            <div className="modal-panel relative max-h-[90vh] max-w-3xl overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-[rgba(255,251,245,0.92)] px-6 py-4 rounded-t-[30px]">
                <h3 className="text-base font-semibold text-gray-900">{editingId ? 'עריכת הסכם' : 'הסכם חדש'}</h3>
                <div className="flex items-center gap-4">
                  {!editingId && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        checked={!useWizard}
                        onChange={e => {
                          const advanced = e.target.checked;
                          setUseWizard(!advanced);
                          if (!advanced) {
                            setWizard(prev => ({
                              ...prev,
                              name: form.name,
                              type: form.type,
                              workDaysPerWeek: form.workDaysPerWeek,
                              dailyHoursStandard: form.dailyHoursStandard,
                              weeklyHoursStandard: form.weeklyHoursStandard,
                              shortDayHours: form.shortDayHours,
                              fridayHours: form.fridayHours,
                              eveHolidayHours: form.eveHolidayHours,
                              breakMinutes: form.breakMinutes ?? 30,
                              overtimeThreshold1: form.overtimeThreshold1,
                              saturdayRate: form.saturdayRate,
                              calculateOvertimeDaily: form.calculateOvertimeDaily,
                              calculateOvertimeWeekly: form.calculateOvertimeWeekly,
                              globalOvertimeHours: form.globalOvertimeHours ?? 0,
                              minHoursForAbsenceOffset: form.minHoursForAbsenceOffset ?? 4,
                              sickDayAccrualPerMonth: form.sickDayAccrualPerMonth,
                              sickDayMaxAccrual: form.sickDayMaxAccrual,
                              vacationDaysPerYear: form.vacationDaysPerYear,
                              vacationMaxAccrual: form.vacationMaxAccrual,
                            }));
                            setWizardStep(1);
                          } else {
                            setForm(prev => prev ? {
                              ...prev,
                              name: wizard.name,
                              type: wizard.type,
                              workDaysPerWeek: wizard.workDaysPerWeek,
                              dailyHoursStandard: wizard.dailyHoursStandard,
                              weeklyHoursStandard: wizard.weeklyHoursStandard,
                              shortDayHours: wizard.shortDayHours,
                              fridayHours: wizard.fridayHours,
                              eveHolidayHours: wizard.eveHolidayHours,
                              breakMinutes: wizard.breakMinutes,
                              overtimeThreshold1: wizard.overtimeThreshold1,
                              saturdayRate: wizard.saturdayRate,
                              calculateOvertimeDaily: wizard.calculateOvertimeDaily,
                              calculateOvertimeWeekly: wizard.calculateOvertimeWeekly,
                              globalOvertimeHours: wizard.globalOvertimeHours,
                              minHoursForAbsenceOffset: wizard.minHoursForAbsenceOffset,
                              sickDayAccrualPerMonth: wizard.sickDayAccrualPerMonth,
                              sickDayMaxAccrual: wizard.sickDayMaxAccrual,
                              vacationDaysPerYear: wizard.vacationDaysPerYear,
                              vacationMaxAccrual: wizard.vacationMaxAccrual,
                            } : prev);
                          }
                        }}
                      />
                      <span className="text-xs text-gray-500">מצב מתקדם</span>
                    </label>
                  )}
                  <button type="button" onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-500 rounded"><X size={18} /></button>
                </div>
              </div>

              {showWizardMode ? (
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-6">
                    {WIZARD_STEPS.map((label, idx) => {
                      const step = idx + 1;
                      const isActive = step === wizardStep;
                      const isDone = step < wizardStep;
                      return (
                        <div key={step} className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => step < wizardStep && setWizardStep(step)}
                            className={[
                              'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors',
                              isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer' : 'bg-slate-100 text-slate-400 cursor-default'
                            ].join(' ')}
                          >
                            <span className={[
                              'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                              isActive ? 'bg-white text-indigo-600' : isDone ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-white'
                            ].join(' ')}>{isDone ? '✓' : step}</span>
                            <span className="hidden sm:inline">{label}</span>
                          </button>
                          {idx < WIZARD_STEPS.length - 1 && (
                            <div className={['h-px flex-1', isDone ? 'bg-indigo-300' : 'bg-slate-200'].join(' ')} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {wizardStep === 1 && (
                    <section className="rounded-xl bg-slate-50/60 border border-slate-200 px-4 pt-4 pb-5 space-y-4">
                      <h4 className="text-sm font-bold text-gray-800 pb-2 border-b-2 border-slate-300/70">שלב 1: בסיס</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">שם ההסכם *</label>
                        <input
                          type="text"
                          className={inp}
                          value={wizard.name}
                          onChange={e => setWizard(w => ({ ...w, name: e.target.value }))}
                          placeholder="לדוגמה: עובד שעתי בסיסי"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">סוג הסכם *</label>
                        <select
                          className={inp}
                          value={wizard.type}
                          onChange={e => setWizard(w => ({ ...w, type: e.target.value as AgreementType }))}
                        >
                          {(Object.entries(AGREEMENT_LABELS) as [AgreementType, string][]).map(([v, t]) => (
                            <option key={v} value={v}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ימים/שבוע</label>
                        <select
                          className={inp}
                          value={wizard.workDaysPerWeek}
                          onChange={e => setWizard(w => ({ ...w, workDaysPerWeek: +e.target.value as 5 | 6 }))}
                        >
                          <option value={5}>5</option>
                          <option value={6}>6</option>
                        </select>
                      </div>
                    </section>
                  )}

                  {wizardStep === 2 && (
                    <section className="rounded-xl bg-slate-50/60 border border-slate-200 px-4 pt-4 pb-5">
                      <h4 className="text-sm font-bold text-gray-800 pb-2 mb-4 border-b-2 border-slate-300/70">שלב 2: שעות עבודה</h4>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {([
                          { l: 'תקן יומי (שע\')', k: 'dailyHoursStandard' as const },
                          { l: 'תקן שבועי (שע\')', k: 'weeklyHoursStandard' as const },
                          { l: 'יום מקוצר (שע\')', k: 'shortDayHours' as const },
                          { l: 'שישי (שע\')', k: 'fridayHours' as const },
                          { l: 'ערב חג עבודה (שע\')', k: 'eveHolidayHours' as const },
                          { l: 'הפסקה (דקות)', k: 'breakMinutes' as const },
                        ] as { l: string; k: keyof WizardState }[]).map(({ l, k }) => (
                          <div key={k}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                            <input
                              type="number"
                              step="0.5"
                              className={inp}
                              value={String(wizard[k])}
                              onChange={e => setWizard(w => ({ ...w, [k]: +e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {wizardStep === 3 && (
                    <section className="rounded-xl bg-slate-50/60 border border-slate-200 px-4 pt-4 pb-5">
                      <h4 className="text-sm font-bold text-gray-800 pb-2 mb-4 border-b-2 border-slate-300/70">שלב 3: שעות נוספות</h4>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">סף 125% (שע')</label>
                          <input
                            type="number"
                            step="0.5"
                            className={inp}
                            value={String(wizard.overtimeThreshold1)}
                            onChange={e => setWizard(w => ({ ...w, overtimeThreshold1: +e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">שבת בסיס (x)</label>
                          <input
                            type="number"
                            step="0.25"
                            className={inp}
                            value={String(wizard.saturdayRate)}
                            onChange={e => setWizard(w => ({ ...w, saturdayRate: +e.target.value }))}
                          />
                        </div>
                        {isWizardGlobal && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">שעות גלובלי/חודש</label>
                              <input
                                type="number"
                                step="1"
                                className={inp}
                                value={String(wizard.globalOvertimeHours)}
                                onChange={e => setWizard(w => ({ ...w, globalOvertimeHours: +e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">מינ' שעות לקיזוז</label>
                              <input
                                type="number"
                                step="0.5"
                                className={inp}
                                value={String(wizard.minHoursForAbsenceOffset)}
                                onChange={e => setWizard(w => ({ ...w, minHoursForAbsenceOffset: +e.target.value }))}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="mt-4 flex gap-6">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            checked={wizard.calculateOvertimeDaily}
                            onChange={e => setWizard(w => ({ ...w, calculateOvertimeDaily: e.target.checked }))}
                          />
                          <span className="text-sm text-gray-600">חישוב יומי</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            checked={wizard.calculateOvertimeWeekly}
                            onChange={e => setWizard(w => ({ ...w, calculateOvertimeWeekly: e.target.checked }))}
                          />
                          <span className="text-sm text-gray-600">חישוב שבועי</span>
                        </label>
                      </div>
                    </section>
                  )}

                  {wizardStep === 4 && (
                    <section className="rounded-xl bg-slate-50/60 border border-slate-200 px-4 pt-4 pb-5">
                      <h4 className="text-sm font-bold text-gray-800 pb-2 mb-4 border-b-2 border-slate-300/70">שלב 4: מחלה וחופשה</h4>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {([
                          { l: 'צבירת מחלה/חודש', k: 'sickDayAccrualPerMonth' as const, step: '0.5' },
                          { l: 'תקרת מחלה (ימים)', k: 'sickDayMaxAccrual' as const, step: '1' },
                          { l: 'ימי חופשה/שנה', k: 'vacationDaysPerYear' as const, step: '1' },
                          { l: 'תקרת חופשה (ימים)', k: 'vacationMaxAccrual' as const, step: '1' },
                        ] as { l: string; k: keyof WizardState; step: string }[]).map(({ l, k, step }) => (
                          <div key={k}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                            <input
                              type="number"
                              step={step}
                              className={inp}
                              value={String(wizard[k])}
                              onChange={e => setWizard(w => ({ ...w, [k]: +e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="px-6 py-5 space-y-6">
                  {([
                    { title: 'פרטי הסכם', fields: [
                      { l:'שם *',k:'name',span:2,type:'text' }, { l:'סוג *',k:'type',type:'select',opts:Object.entries(AGREEMENT_LABELS) as [string,string][] }, { l:'ימים/שבוע',k:'workDaysPerWeek',type:'select',opts:[['5','5'],['6','6']] }, { l:'תחילת תוקף',k:'effectiveDate',type:'text' }
                    ] as FieldDef[]},
                    { title: 'תקני שעות', fields: [
                      { l:'שבועי',k:'weeklyHoursStandard',type:'num' }, { l:'יומי',k:'dailyHoursStandard',type:'num' }, { l:'מקוצר',k:'shortDayHours',type:'num' }, { l:'שישי',k:'fridayHours',type:'num' }, { l:'ערב חג (עבודה)',k:'eveHolidayHours',type:'num' }, { l:'ערב חג (תשלום)',k:'eveHolidayPaidHours',type:'num' }, { l:'חוה"מ',k:'cholHamoedHours',type:'num' }, { l:'הפסקה (דקות)',k:'breakMinutes',type:'num' }, { l:'הפסקה כלולה בתקן',k:'breakIncludedInStandard',type:'check' }, { l:'עיגול',k:'roundingMethod',type:'select',opts:[['none','ללא'],['quarter','רבע'],['half','חצי']] }, { l:'היעדרות',k:'absenceCalculation',type:'select',opts:[['hourly','שעתי'],['daily','יומי']] }
                    ] as FieldDef[]},
                    { title: 'תבנית שבועית', fields: [
                      { l:'השתמש בתבנית שבועית',k:'useWeeklyTemplate',type:'check',span:2 }
                    ] as FieldDef[]},
                    { title: 'שעות נוספות', fields: [
                      { l:'סף 125%',k:'overtimeThreshold1',type:'num' }, { l:'125%',k:'overtimeRate1',type:'num' }, { l:'150%',k:'overtimeRate2',type:'num' }, { l:'שבת בסיס',k:'saturdayRate',type:'num' }, { l:'סף ש"נ שבת (175%)',k:'saturdayOvertimeThreshold',type:'num' }, { l:'תעריף ש"נ שבת 175%',k:'saturdayOvertimeRate',type:'num' }, { l:'סף ש"נ שבת 200%',k:'saturdayOvertime2Threshold',type:'num' }, { l:'תעריף ש"נ שבת 200%',k:'saturdayOvertime2Rate',type:'num' }, { l:'בסיס ש"נ',k:'overtimeBaseHours',type:'num' }, { l:'סף שעות רגיל מורחב (100%)',k:'regularExtendedBaseHours',type:'num' }, { l:'חישוב יומי',k:'calculateOvertimeDaily',type:'check' }, { l:'חישוב שבועי',k:'calculateOvertimeWeekly',type:'check' }, { l:'מנוחת פיצוי',k:'requireCompensatoryRest',type:'check' }
                    ] as FieldDef[]},
                    { title: 'משמרת לילה', fields: [
                      { l:'הפעל זיהוי לילה',k:'nightShiftEnabled',type:'check' }, { l:'תקן לילה (שע\')',k:'nightShiftStandardHours',type:'num',visible:r=>!!r.nightShiftEnabled }
                    ] as FieldDef[]},
                    ...(isGlobal ? [{ title: 'גלובלי', fields: [
                      { l:'מכסה',k:'globalOvertimeHours',type:'num' }, { l:'מינ\' קיזוז',k:'minHoursForAbsenceOffset',type:'num' }, { l:'מעקב',k:'globalOTTrackingMode',type:'select',opts:[['offset_only','קיזוז בלבד'],['offset_and_audit','קיזוז + בקרה']] }, { l:'ניוד בין חודשים',k:'allowInterMonthCarry',type:'check' }, { l:'התר מינוס',k:'allowNegativeGlobalOT',type:'check' }
                    ] as FieldDef[]}] : []),
                    { title: 'מחלה', fields: [
                      { l:'בסיס צבירה',k:'sickAccrualType',type:'select',opts:[['legal','חוקי'],['agreement','הסכמי']] }, { l:'צבירה/חודש',k:'sickDayAccrualPerMonth',type:'num' }, { l:'תקרה',k:'sickDayMaxAccrual',type:'num' }, { l:'יום 1',k:'sickDay1Payment',type:'num' }, { l:'ימים 2-3',k:'sickDay2_3Payment',type:'num' }, { l:'4+',k:'sickDay4PlusPayment',type:'num' }, { l:'שעות ליום מחלה',k:'sickDayHoursEquivalent',type:'num' }, { l:'יתרת פתיחה ברירת מחדל (ימים)',k:'sickOpeningBalance',type:'num' }
                    ] as FieldDef[]},
                    { title: 'חופשה', fields: [
                      { l:'בסיס',k:'vacationAccrualType',type:'select',opts:[['legal','חוקי'],['agreement','הסכמי']] }, { l:'ימים/שנה',k:'vacationDaysPerYear',type:'num' }, { l:'יחידה',k:'vacationUnit',type:'select',opts:[['days','ימים'],['hours','שעות']] }, { l:'תקרה',k:'vacationMaxAccrual',type:'num' }, { l:'מדיניות העברה',k:'vacationCarryOverPolicy',type:'select',opts:[['carry_all','ניוד מלא'],['carry_limited','ניוד מוגבל'],['delete','מחיקה']] }, { l:'מקס\' ניוד ימים',k:'vacationCarryOverMax',type:'num',visible:r=>r.vacationCarryOverPolicy==='carry_limited' }, { l:'שיטת פריסה',k:'vacationDistributionMethod',type:'select',opts:[['monthly_equal','חודשית שווה'],['monthly_proportional','יחסית לעבודה'],['annual','שנתית']] }, { l:'4% תחליף (שעתי)',k:'vacation4PercentForHourly',type:'check' }, { l:'יתרת פתיחה ברירת מחדל (ימים)',k:'vacationOpeningBalance',type:'num' }, { l:'קיזוז חוסר שעות מחופשה',k:'absenceDeductFromVacation',type:'check',span:2 }
                    ] as FieldDef[]},
                  ] as { title: string; fields: FieldDef[] }[]).map(({ title, fields }) => (
                    <section key={title} className="rounded-xl bg-slate-50/60 border border-slate-200 px-4 pt-4 pb-3">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 pb-2.5 border-b-2 border-slate-300/70 tracking-tight">{title}</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {fields.filter(({ visible }) => !visible || visible(form)).map(({ l, k, type, span, opts }) => (
                          <div key={k} className={span === 2 ? 'col-span-2' : ''}>
                            {type === 'check' ? (
                              <label htmlFor={`agr-${k}`} className="flex items-center gap-2 pt-3"><input id={`agr-${k}`} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={!!form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /><span className="text-sm text-gray-600">{l}</span></label>
                            ) : (
                              <><label htmlFor={`agr-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                              {type === 'select' ? <select id={`agr-${k}`} className={inp} value={String(form[k])} onChange={e => setForm({ ...form, [k]: k === 'workDaysPerWeek' ? +e.target.value : e.target.value })}>{opts!.map(([v,t]) => <option key={v} value={v}>{t}</option>)}</select>
                              : <input id={`agr-${k}`} type={type === 'text' ? 'text' : 'number'} step={type === 'text' ? undefined : '0.1'} className={inp} value={String(form[k] ?? '')} onChange={e => setForm({ ...form, [k]: type === 'text' ? e.target.value : e.target.value === '' ? undefined : +e.target.value })} />}</>
                            )}
                          </div>
                        ))}
                      </div>
                      {title === 'תבנית שבועית' && form.useWeeklyTemplate && (
                        <div className="grid grid-cols-7 gap-2 mt-3">
                          {([['א',0],['ב',1],['ג',2],['ד',3],['ה',4],['ו',5],['ש',6]] as [string,number][]).map(([name,day])=>(
                            <div key={day}>
                              <label htmlFor={`wt-${day}`} className="block text-xs font-medium text-gray-500 mb-1 text-center">{name}</label>
                              <input id={`wt-${day}`} type="number" step="0.1" min="0" className={`${inp} text-center text-sm`}
                                value={(form.weeklyTemplate as Record<number, number | undefined> | undefined)?.[day] ?? (day === 5 ? form.fridayHours : day === 6 ? 0 : form.dailyHoursStandard)}
                                onChange={e => setForm({...form, weeklyTemplate: {...(form.weeklyTemplate || {}), [day]: +e.target.value}})}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}

              <div className="sticky bottom-0 z-10 flex justify-between gap-2 border-t border-slate-200/70 bg-[rgba(255,251,245,0.95)] px-6 py-4 rounded-b-[30px] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
                {showWizardMode ? (
                  <>
                    <div>
                      {wizardStep > 1 && (
                        <button type="button" onClick={wizardPrev} className="secondary-btn">
                          הקודם
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={closeModal} className="secondary-btn">ביטול</button>
                      {wizardStep < 4 ? (
                        <button type="button" onClick={wizardNext} className="primary-btn">
                          הבא
                        </button>
                      ) : (
                        <button type="button" onClick={wizardFinish} className="primary-btn">
                          סיים
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div />
                    <div className="flex gap-2">
                      <button type="button" onClick={closeModal} className="secondary-btn">ביטול</button>
                      <button type="button" onClick={save} className="primary-btn">שמור</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
