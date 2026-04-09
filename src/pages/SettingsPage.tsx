import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Holiday, ComponentMapping } from '../types';
import Modal from '../components/Modal';
import {
  Plus, Edit2, Trash2, Save, X, AlertCircle,
  Settings, CalendarDays, Database, ShieldAlert,
  Download, Upload,
} from 'lucide-react';
import { RELIGION_LABELS, type Religion } from '../lib/holidayGenerator';
import { fetchHolidaysFromAPI } from '../lib/holidayService';

function gid() { return crypto.randomUUID(); }

function validateState(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.employees) && Array.isArray(d.agreements) &&
         Array.isArray(d.attendance) && Array.isArray(d.holidays) &&
         Array.isArray(d.componentMappings) && Array.isArray(d.calculations);
}

const ALL_RELIGIONS: Religion[] = ['jewish', 'muslim', 'christian', 'druze'];

function SectionHeader({ icon: Icon, title, subtitle, color = 'blue' }: {
  icon: typeof Settings;
  title: string;
  subtitle?: string;
  color?: 'blue' | 'amber' | 'red' | 'green';
}) {
  const colorMap = {
    blue:  'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red:   'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
  };
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${colorMap[color]}`}>
        <Icon size={16} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </div>
  );
}

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<'components'|'holidays'|'data'>('components');
  const [editingMapping, setEditingMapping] = useState<ComponentMapping|null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday|null>(null);
  const [holidayErrors, setHolidayErrors] = useState<Record<string, string>>({});
  const [holidayForm, setHolidayForm] = useState<Holiday>({ id: gid(), date: '', name: '', isEveHoliday: false, isCholHamoed: false });
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [apiFetching, setApiFetching] = useState(false);
  const [apiFetchMsg, setApiFetchMsg] = useState('');
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);

  const inp = 'field-input';

  function saveM() { if(!editingMapping)return; dispatch({type:'UPDATE_COMPONENT_MAPPING',payload:editingMapping}); setEditingMapping(null); }
  function addH() { setHolidayForm({id:gid(),date:'',name:'',isEveHoliday:false,isCholHamoed:false}); setEditingHoliday(null); setHolidayErrors({}); setShowHolidayModal(true); }
  function editH(h:Holiday) { setHolidayForm({...h}); setEditingHoliday(h); setHolidayErrors({}); setShowHolidayModal(true); }
  function saveH() {
    const errors: Record<string, string> = {};
    if (!holidayForm.date) errors.date = 'נא להזין תאריך';
    if (!holidayForm.name) errors.name = 'נא להזין שם חג';
    if (Object.keys(errors).length > 0) { setHolidayErrors(errors); return; }
    setHolidayErrors({});
    dispatch({type:editingHoliday?'UPDATE_HOLIDAY':'ADD_HOLIDAY',payload:holidayForm});
    setShowHolidayModal(false);
  }
  async function handleApiFetch() {
    if (!confirm('פעולה זו תחליף את כל החגים הקיימים בנתונים מ-Calendarific API. להמשיך?')) return;
    setApiFetching(true); setApiFetchMsg('');
    try {
      const holidays = await fetchHolidaysFromAPI(generateYear);
      dispatch({ type: 'SET_HOLIDAYS', payload: holidays });
      setApiFetchMsg(`נטענו ${holidays.length} חגים לשנת ${generateYear} (כל העדות)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiFetchMsg(`שגיאה: ${msg}`);
    } finally {
      setApiFetching(false);
    }
  }
  function expData() { const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u); }
  function impData(e:React.ChangeEvent<HTMLInputElement>) { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>{try{const p=JSON.parse(ev.target?.result as string);if(!validateState(p)){alert('מבנה הקובץ לא תקין');return;}if(confirm('להחליף את כל הנתונים?')){dispatch({type:'LOAD_STATE',payload:p});import('../lib/api').then(m=>m.api.loadState(p).catch(err=>console.error('Restore sync error:',err)))}}catch{alert('קובץ לא תקין')}}; r.readAsText(f); e.target.value=''; }

  function handleResetClick() {
    if (resetStep === 0) {
      setResetStep(1);
    } else if (resetStep === 1) {
      setResetStep(2);
    } else {
      localStorage.removeItem('attendance_system_v1');
      window.location.reload();
    }
  }
  function cancelReset() { setResetStep(0); }

  const resetLabels: Record<0|1|2, string> = {
    0: 'מחק את כל הנתונים',
    1: 'בטוח? לחץ שוב לאישור',
    2: 'אישור אחרון — מחק הכל',
  };
  const resetColors: Record<0|1|2, string> = {
    0: 'bg-red-600 hover:bg-red-700 text-white',
    1: 'bg-red-700 hover:bg-red-800 text-white ring-2 ring-red-400 ring-offset-1',
    2: 'bg-red-900 hover:bg-red-950 text-white ring-2 ring-red-600 ring-offset-2 animate-pulse',
  };

  const sortedHolidays = useMemo(
    () => [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [state.holidays]
  );

  return (
    <div className="page-shell">

      <div className="tab-shell mb-6 p-2">
        <nav className="flex flex-wrap gap-2" role="tablist" aria-label="הגדרות">
          {[
            { k: 'components' as const, l: 'רכיבי שכר', icon: Settings },
            { k: 'holidays'   as const, l: 'חגים',       icon: CalendarDays },
            { k: 'data'       as const, l: 'נתונים',     icon: Database },
          ].map(({ k, l, icon: Icon }) => (
            <button type="button" key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`tab-button flex items-center gap-2 ${tab === k ? 'tab-button--active' : 'tab-button--idle'}`}>
              <Icon size={15} />
              {l}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'components' && (
        <div className="space-y-0">
          <SectionHeader icon={Settings} title="מיפוי רכיבים לשיקלולית" subtitle="התאם את מספרי הרכיבים לשיקלולית שלך" color="blue" />
          <div className="table-shell">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">תיאור</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">מפתח</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">רכיב</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">סוג רשומה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">יחידה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">סוג ערך</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">מס</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">פנסיה</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">סטטוס</th>
                    <th className="relative py-3 px-4 bg-gradient-to-b from-blue-50 to-[#eef4ff]"><span className="sr-only">פעולות</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {state.componentMappings.map((m, idx) => (
                    <tr key={m.internalKey} className={`${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-blue-50/40 transition-colors`}>
                      {editingMapping?.internalKey === m.internalKey ? <>
                        <td className="py-2 px-4"><input className={inp} value={editingMapping.label} onChange={e=>setEditingMapping({...editingMapping,label:e.target.value})}/></td>
                        <td className="py-2 px-4 font-mono text-xs text-gray-400">{m.internalKey}</td>
                        <td className="py-2 px-4"><input className={`${inp} w-20`} maxLength={3} value={editingMapping.componentNumber} onChange={e=>setEditingMapping({...editingMapping,componentNumber:e.target.value})}/></td>
                        <td className="py-2 px-4"><select className={inp} value={editingMapping.recordType} onChange={e=>setEditingMapping({...editingMapping,recordType:e.target.value as ComponentMapping['recordType']})}>{['0','1','2','4','5','6','7'].map(t=><option key={t}>{t}</option>)}</select></td>
                        <td className="py-2 px-4"><select className={inp} value={editingMapping.unit} onChange={e=>setEditingMapping({...editingMapping,unit:e.target.value as ComponentMapping['unit']})}><option value="hours">שעות</option><option value="days">ימים</option><option value="amount">סכום</option></select></td>
                        <td className="py-2 px-4"><select className={inp} value={editingMapping.valueType ?? 'quantity'} onChange={e=>setEditingMapping({...editingMapping,valueType:e.target.value as ComponentMapping['valueType']})}><option value="quantity">כמות</option><option value="rate">תעריף</option><option value="amount">סכום</option></select></td>
                        <td className="py-2 px-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={editingMapping.isTaxable ?? true} onChange={e=>setEditingMapping({...editingMapping,isTaxable:e.target.checked})}/></td>
                        <td className="py-2 px-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={editingMapping.isPensionable ?? false} onChange={e=>setEditingMapping({...editingMapping,isPensionable:e.target.checked})}/></td>
                        <td className="py-2 px-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={editingMapping.enabled} onChange={e=>setEditingMapping({...editingMapping,enabled:e.target.checked})}/></td>
                        <td className="py-2 px-4"><div className="flex gap-1 justify-end"><button type="button" onClick={saveM} aria-label="שמירה" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={14}/></button><button type="button" onClick={()=>setEditingMapping(null)} aria-label="ביטול" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14}/></button></div></td>
                      </> : <>
                        <td className="whitespace-nowrap py-3.5 px-4 text-sm font-medium text-gray-900">{m.label}</td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-xs font-mono text-gray-400">{m.internalKey}</td>
                        <td className="whitespace-nowrap py-3.5 px-4"><span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-mono font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">{m.componentNumber}</span></td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{m.recordType}</td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{m.unit==='hours'?'שעות':m.unit==='days'?'ימים':'סכום'}</td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{(m.valueType ?? 'quantity')==='quantity'?'כמות':(m.valueType)==='rate'?'תעריף':'סכום'}</td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-center">{(m.isTaxable ?? true) ? <span className="text-green-600 text-xs font-bold">V</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="whitespace-nowrap py-3.5 px-4 text-center">{(m.isPensionable ?? false) ? <span className="text-green-600 text-xs font-bold">V</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="whitespace-nowrap py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.enabled?'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20':'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10'}`}>{m.enabled?'פעיל':'כבוי'}</span>
                        </td>
                        <td className="whitespace-nowrap py-3.5 px-4"><button type="button" onClick={()=>setEditingMapping({...m})} aria-label="עריכה" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"><Edit2 size={14}/></button></td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-1.5 border-t border-slate-200/70 bg-white/50 px-5 py-3 text-xs text-gray-500">
              <AlertCircle size={12}/> מספרי הרכיבים תלויים בהגדרות שיקלולית שלך
            </div>
          </div>
        </div>
      )}

      {tab === 'holidays' && (
        <div className="space-y-4">
          <SectionHeader icon={CalendarDays} title="חגים ומועדים" subtitle="הגדר חגים לחישוב שכר תקין" color="amber" />

          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">טען חגים מ-API (כולל כל העדות)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Calendarific — חגים יהודיים, מוסלמיים, נוצריים ודרוזיים</p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <input id="gen-year" type="number" min={2020} max={2040} className={`${inp} w-24 text-center`}
                    value={generateYear} onChange={e => setGenerateYear(Number(e.target.value))}/>
                </div>
                <button type="button" onClick={handleApiFetch} disabled={apiFetching}
                  className="primary-btn disabled:opacity-50">
                  <Download size={14}/> {apiFetching ? 'טוען...' : `טען חגים (${generateYear})`}
                </button>
              </div>
            </div>
            {apiFetchMsg && (
              <p className={`text-xs mt-3 flex items-center gap-1 ${apiFetchMsg.startsWith('שגיאה') ? 'text-red-600' : 'text-green-600'}`}>
                <AlertCircle size={12}/> {apiFetchMsg}
              </p>
            )}
          </div>

          <SectionDivider />

          <div className="table-shell">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">חגים ומועדים</h3>
                <p className="text-xs text-gray-500 mt-0.5">{state.holidays.length} ימים מוגדרים</p>
              </div>
              <button type="button" onClick={addH} className="primary-btn"><Plus size={14}/> הוסף חג</button>
            </div>
            <div className="overflow-auto max-h-[55vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">תאריך</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">שם</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">דת</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-700 bg-gradient-to-b from-blue-50 to-[#eef4ff]">סוג</th>
                    <th className="relative py-3 px-4 bg-gradient-to-b from-blue-50 to-[#eef4ff]"><span className="sr-only">פעולות</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {state.holidays.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-14 text-sm text-gray-400">אין חגים מוגדרים – השתמש בכפתור למעלה כדי להוסיף חגים</td></tr>
                  )}
                  {sortedHolidays.map((h, idx) => (
                    <tr key={h.id} className={`${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-blue-50/30 transition-colors`}>
                      <td className="whitespace-nowrap py-3 px-4 text-sm font-mono text-gray-500">{h.date}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm font-medium text-gray-900">{h.name}</td>
                      <td className="whitespace-nowrap py-3 px-4">
                        {h.religion ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          h.religion === 'jewish' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                          h.religion === 'muslim' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                          'bg-purple-50 text-purple-700 ring-purple-600/20'
                        }`}>{RELIGION_LABELS[h.religion]}</span> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${h.isCholHamoed?'bg-teal-50 text-teal-700 ring-teal-600/20':h.isEveHoliday?'bg-amber-50 text-amber-700 ring-amber-600/20':'bg-red-50 text-red-700 ring-red-600/20'}`}>{h.isCholHamoed?'חוה"מ':h.isEveHoliday?'ערב חג':'חג'}</span>
                      </td>
                      <td className="whitespace-nowrap py-3 px-4">
                        <div className="flex gap-1 justify-end">
                          <button type="button" onClick={() => editH(h)} aria-label="עריכה" className="p-1 text-gray-400 hover:text-indigo-600 rounded"><Edit2 size={14}/></button>
                          <button type="button" onClick={() => dispatch({type:'DELETE_HOLIDAY',payload:h.id})} aria-label="מחיקה" className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Modal open={showHolidayModal} onClose={() => setShowHolidayModal(false)}
              title={editingHoliday ? 'עריכת חג' : 'חג חדש'} size="sm"
              footer={<>
                <button type="button" onClick={() => setShowHolidayModal(false)} className="secondary-btn">ביטול</button>
                <button type="button" onClick={saveH} className="primary-btn">שמור</button>
              </>}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700 mb-1">תאריך *</label>
                  <input id="holiday-date" type="date" className={inp} value={holidayForm.date} onChange={e=>setHolidayForm({...holidayForm,date:e.target.value})}/>
                  {holidayErrors.date && <p className="text-xs text-red-600 mt-1">{holidayErrors.date}</p>}
                </div>
                <div>
                  <label htmlFor="holiday-name" className="block text-sm font-medium text-gray-700 mb-1">שם *</label>
                  <input id="holiday-name" className={inp} value={holidayForm.name} onChange={e=>setHolidayForm({...holidayForm,name:e.target.value})}/>
                  {holidayErrors.name && <p className="text-xs text-red-600 mt-1">{holidayErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="holiday-religion" className="block text-sm font-medium text-gray-700 mb-1">דת</label>
                  <select id="holiday-religion" className={inp} value={holidayForm.religion || ''} onChange={e=>setHolidayForm({...holidayForm,religion:(e.target.value||undefined) as Holiday['religion']})}>
                    <option value="">— ללא —</option>
                    {ALL_RELIGIONS.map(r=><option key={r} value={r}>{RELIGION_LABELS[r]}</option>)}
                  </select>
                </div>
                <label htmlFor="holiday-eve" className="flex items-center gap-2">
                  <input id="holiday-eve" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={holidayForm.isEveHoliday} onChange={e=>setHolidayForm({...holidayForm,isEveHoliday:e.target.checked})}/>
                  <span className="text-sm text-gray-700">ערב חג (יום מקוצר)</span>
                </label>
                <label htmlFor="holiday-chol" className="flex items-center gap-2">
                  <input id="holiday-chol" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={holidayForm.isCholHamoed ?? false} onChange={e=>setHolidayForm({...holidayForm,isCholHamoed:e.target.checked})}/>
                  <span className="text-sm text-gray-700">חול המועד</span>
                </label>
              </div>
            </Modal>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-5">
          <SectionHeader icon={Database} title="ניהול נתונים" subtitle="גיבוי, שחזור ואיפוס מערכת" color="green" />

          <div className="surface-card p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-700 mt-0.5">
                <Database size={15} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-0.5">גיבוי ושחזור</h3>
                <p className="text-xs text-gray-500">כל הנתונים נשמרים ב-localStorage של הדפדפן. מומלץ לגבות לפני עדכונים.</p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={expData} className="primary-btn">
                <Download size={15}/> ייצוא גיבוי JSON
              </button>
              <label className="secondary-btn cursor-pointer">
                <Upload size={15}/> טעינת גיבוי
                <input type="file" accept=".json" className="hidden" onChange={impData}/>
              </label>
            </div>
          </div>

          <SectionDivider />

          <div className="rounded-[16px] border-2 border-red-300 bg-gradient-to-br from-red-50 via-white to-red-50/60 p-6 shadow-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 text-red-700 mt-0.5">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-700 mb-0.5 flex items-center gap-1.5">
                  אזור מסוכן — איפוס מערכת
                </h3>
                <p className="text-xs text-red-600/80">
                  מחיקה מוחלטת של כל הנתונים: עובדים, נוכחות, הסכמים, חישובים. פעולה זו בלתי הפיכה לחלוטין.
                </p>
              </div>
            </div>

            {resetStep === 0 ? (
              <button
                type="button"
                onClick={handleResetClick}
                className={`inline-flex items-center justify-center gap-2 min-h-[42px] px-5 rounded-[10px] text-sm font-bold transition-all ${resetColors[0]}`}
              >
                <Trash2 size={15} /> {resetLabels[0]}
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleResetClick}
                  className={`inline-flex items-center justify-center gap-2 min-h-[42px] px-5 rounded-[10px] text-sm font-bold transition-all ${resetColors[resetStep]}`}
                >
                  <ShieldAlert size={15} /> {resetLabels[resetStep]}
                </button>
                <button
                  type="button"
                  onClick={cancelReset}
                  className="secondary-btn text-sm"
                >
                  <X size={14} /> ביטול
                </button>
                <span className="text-xs text-red-500 font-medium">
                  {resetStep === 1 ? 'לחץ שוב לאישור ראשון' : 'אישור אחרון נדרש — כל הנתונים יימחקו'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
