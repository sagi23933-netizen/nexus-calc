import { useState, useRef, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import type { AttendanceRecord, AttendanceColumnMapping, AbsenceType, WorkLocation } from '../types';
import { ABSENCE_LABELS, WORK_LOCATION_LABELS } from '../types';
import { Upload, Plus, Trash2, X, AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { readExcelFile, convertRowsToAttendance, detectAndParseReport } from '../lib/excelParser';
import type { ParsedRow } from '../lib/excelParser';
import { generateId } from '../lib/utils';
import { DOW_LABELS } from '../lib/calculationEngine';

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return DOW_LABELS[d.getDay()];
}

function isMissingData(r: AttendanceRecord): boolean {
  return !r.clockIn && !r.clockOut && !r.absenceType;
}

export default function AttendancePage() {
  const { state, dispatch } = useApp();
  const [filterMonth, setFilterMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [filterEmployee, setFilterEmployee] = useState('');
  const [step, setStep] = useState<'list'|'upload'|'map'|'preview'>('list');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<AttendanceColumnMapping>({ employeeNumber:'', date:'', clockIn:'', clockOut:'', actualHours:'', absenceType:'', absenceHours:'', notes:'' });
  const [previewRecords, setPreviewRecords] = useState<AttendanceRecord[]>([]);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualRecord, setManualRecord] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], isManual: true });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => state.attendance.filter(r => (!filterMonth || r.date.startsWith(filterMonth)) && (!filterEmployee || r.employeeId === filterEmployee)), [state.attendance, filterMonth, filterEmployee]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const missingCount = useMemo(() => filtered.filter(isMissingData).length, [filtered]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) { setStep('list'); return; }
    try {
      const reportResult = await detectAndParseReport(file, state.employees);
      if (reportResult) {
        if (reportResult.records.length === 0) {
          setImportMsg(`זוהה דו"ח נוכחות עבור עובד ${reportResult.employeeNumber} (${reportResult.employeeName}), אך העובד לא נמצא במערכת. הוסף אותו תחילה.`);
          setStep('list');
        } else {
          setPreviewRecords(reportResult.records);
          setImportMsg(`זוהה דו"ח נוכחות אוטומטית — עובד ${reportResult.employeeNumber} (${reportResult.employeeName})`);
          setStep('preview');
        }
        if (fileRef.current) fileRef.current.value='';
        return;
      }

      const result = await readExcelFile(file);
      if (result.headers.length === 0) {
        setImportMsg('הקובץ ריק או שלא נמצאו כותרות עמודות');
        setStep('list');
        return;
      }
      setHeaders(result.headers);
      setRows(result.rows);
      setMapping({
        employeeNumber: result.headers.find(h=>h.includes('עובד')||h.includes('מס')||h.toLowerCase().includes('emp')||h.toLowerCase().includes('id'))??'',
        date: result.headers.find(h=>h.includes('תאריך')||h.toLowerCase().includes('date'))??'',
        clockIn: result.headers.find(h=>h.includes('כניסה')||h.includes('התחלה'))??'',
        clockOut: result.headers.find(h=>h.includes('יציאה')||h.includes('סיום'))??'',
        actualHours: result.headers.find(h=>h.includes('שעות')&&!h.includes('היעדרות'))??'',
        absenceType: result.headers.find(h=>h.includes('היעדרות')||h.includes('סוג'))??'',
        absenceHours: result.headers.find(h=>h.includes('שעות היעדרות'))??'',
        notes: result.headers.find(h=>h.includes('הערות')||h.includes('הערה'))??''
      });
      setStep('map');
    } catch (err) {
      console.error('Excel import error:', err);
      setImportMsg(`שגיאה בקריאת הקובץ: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
      setStep('list');
    }
    if (fileRef.current) fileRef.current.value='';
  }
  function genPreview() { if(!mapping.employeeNumber||!mapping.date){alert('חובה: עובד + תאריך');return;} setPreviewRecords(convertRowsToAttendance(rows,mapping,state.employees)); setStep('preview'); }
  function confirmImport() { dispatch({type:'ADD_ATTENDANCE_BATCH',payload:previewRecords}); setImportMsg(`${previewRecords.length} רשומות יובאו בהצלחה`); setStep('list'); setPreviewRecords([]); }
  function saveManual() { if(!manualRecord.employeeId||!manualRecord.date){alert('חובה');return;} dispatch({type:'ADD_ATTENDANCE_BATCH',payload:[{...manualRecord,id:generateId(),isManual:true} as AttendanceRecord]}); setShowAddManual(false); setManualRecord({date:new Date().toISOString().split('T')[0],isManual:true}); }

  const inp = 'field-input';
  const ColSel = ({label,value,onChange,req=false}:{label:string;value:string;onChange:(v:string)=>void;req?:boolean}) => {
    const id = `col-${label.replace(/\s/g,'-')}`;
    return <div><label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}{req&&<span className="text-red-500 mr-1">*</span>}</label><select id={id} className={inp} value={value} onChange={e=>onChange(e.target.value)}><option value="">— לא למפות —</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></div>;
  };

  return (
    <div className="page-shell">
      <div className="flex flex-wrap gap-2 mb-5">
        {step==='list' && <>
          <button type="button" onClick={()=>setShowAddManual(true)} className="secondary-btn"><Plus size={15}/> הוספה ידנית</button>
          <button type="button" onClick={()=>fileRef.current?.click()} className="primary-btn"><Upload size={15}/> ייבוא Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile}/>
        </>}
        {step!=='list' && <button type="button" onClick={()=>setStep('list')} className="secondary-btn"><X size={15}/> ביטול</button>}
      </div>

      {importMsg && <div className={`notice mb-4 ${importMsg.includes('שגיאה')||importMsg.includes('ריק') ? 'notice-warning' : 'notice-success'}`}>{importMsg.includes('שגיאה')||importMsg.includes('ריק') ? <AlertCircle size={16}/> : <Check size={16}/>}{importMsg}<button type="button" onClick={()=>setImportMsg('')} aria-label="סגירה" className="mr-auto opacity-60 hover:opacity-100"><X size={14}/></button></div>}

      {step==='list' && (
        <div className="surface-card mb-4 flex flex-wrap items-center gap-3 p-4">
          <input type="month" className={`${inp} w-auto`} value={filterMonth} onChange={e=>{setFilterMonth(e.target.value);setPage(0)}}/>
          <select className={`${inp} w-48`} value={filterEmployee} onChange={e=>{setFilterEmployee(e.target.value);setPage(0)}}>
            <option value="">כל העובדים</option>
            {state.employees.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </div>
      )}

      {step==='list' && filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-xs font-semibold text-gray-500">סה"כ רשומות</span>
            <span className="font-mono text-base font-bold text-blue-700">{filtered.length}</span>
          </div>
          {missingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 shadow-sm">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700">רשומות חסרות נתוני שעון</span>
              <span className="font-mono text-base font-bold text-amber-700">{missingCount}</span>
            </div>
          )}
        </div>
      )}

      {step==='map' && (
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">מיפוי עמודות</h3>
          <p className="text-sm text-gray-500 mb-5">{rows.length} שורות נמצאו בקובץ</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <ColSel label="מספר עובד" req value={mapping.employeeNumber} onChange={v=>setMapping({...mapping,employeeNumber:v})}/>
            <ColSel label="תאריך" req value={mapping.date} onChange={v=>setMapping({...mapping,date:v})}/>
            <ColSel label="כניסה" value={mapping.clockIn??''} onChange={v=>setMapping({...mapping,clockIn:v})}/>
            <ColSel label="יציאה" value={mapping.clockOut??''} onChange={v=>setMapping({...mapping,clockOut:v})}/>
            <ColSel label="שעות בפועל" value={mapping.actualHours??''} onChange={v=>setMapping({...mapping,actualHours:v})}/>
            <ColSel label="סוג היעדרות" value={mapping.absenceType??''} onChange={v=>setMapping({...mapping,absenceType:v})}/>
            <ColSel label="שעות היעדרות" value={mapping.absenceHours??''} onChange={v=>setMapping({...mapping,absenceHours:v})}/>
            <ColSel label="הערות" value={mapping.notes??''} onChange={v=>setMapping({...mapping,notes:v})}/>
          </div>
          <div className="mb-5 overflow-x-auto rounded-[22px] border border-slate-200/80">
            <table className="min-w-full text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>{headers.map(h=><th key={h} className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">{rows.slice(0,3).map((r,i)=><tr key={i}>{headers.map(h=><td key={h} className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{String(r[h]??'')}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <button type="button" onClick={genPreview} className="primary-btn">תצוגה מקדימה</button>
        </div>
      )}

      {step==='preview' && (
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{previewRecords.length} רשומות מוכנות לייבוא</h3>
          {previewRecords.length===0 && <div className="notice notice-warning mb-4"><AlertCircle size={16}/>לא נמצאו רשומות תואמות</div>}
          <div className="mb-5 overflow-x-auto rounded-[22px] border border-slate-200/80">
            <table className="min-w-full text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-right font-semibold text-gray-700">עובד</th><th className="px-3 py-2 text-right font-semibold text-gray-700">תאריך</th><th className="px-3 py-2 text-right font-semibold text-gray-700">כניסה</th><th className="px-3 py-2 text-right font-semibold text-gray-700">יציאה</th><th className="px-3 py-2 text-right font-semibold text-gray-700">שעות</th><th className="px-3 py-2 text-right font-semibold text-gray-700">היעדרות</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{previewRecords.slice(0,20).map(r=>{const emp=state.employees.find(e=>e.id===r.employeeId);return(
                <tr key={r.id}><td className="px-3 py-1.5 text-gray-700">{emp?.firstName} {emp?.lastName}</td><td className="px-3 py-1.5 font-mono text-gray-500">{r.date}</td><td className="px-3 py-1.5 text-gray-500">{r.clockIn??'—'}</td><td className="px-3 py-1.5 text-gray-500">{r.clockOut??'—'}</td><td className="px-3 py-1.5 text-gray-600">{r.actualHours?.toFixed(2)??'—'}</td><td className="px-3 py-1.5 text-gray-500">{r.absenceType?ABSENCE_LABELS[r.absenceType]:'—'}</td></tr>
              )})}</tbody>
            </table>
          </div>
          <div className="flex gap-2">
            {headers.length > 0 && <button onClick={()=>setStep('map')} className="secondary-btn">חזרה למיפוי</button>}
            <button onClick={confirmImport} disabled={!previewRecords.length} className="primary-btn disabled:opacity-50">אישור ייבוא ({previewRecords.length})</button>
          </div>
        </div>
      )}

      {step==='list' && (
        <div className="table-shell">
          <div className="border-b border-slate-200/70 bg-white/50 px-4 py-3 text-xs font-medium text-gray-500">{filtered.length} רשומות</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">עובד</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">תאריך</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500">יום</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">כניסה</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">יציאה</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">שעות</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">היעדרות</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">מיקום</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-900">הערות</th>
                  <th className="relative py-3 px-4"><span className="sr-only">מחק</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {!paginated.length && <tr><td colSpan={10} className="text-center py-14 text-sm text-gray-400">אין רשומות</td></tr>}
                {paginated.map(r => {
                  const emp = state.employees.find(e => e.id === r.employeeId);
                  const missing = isMissingData(r);
                  return (
                    <tr
                      key={r.id}
                      className={missing
                        ? 'bg-amber-50/60 hover:bg-amber-100/70'
                        : 'hover:bg-blue-50/40'
                      }
                    >
                      <td className="whitespace-nowrap py-3 px-4 text-sm font-medium text-gray-900">
                        {emp?.firstName} {emp?.lastName}
                      </td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm font-mono text-gray-500">{r.date}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-xs text-gray-400">{getDayLabel(r.date)}</td>
                      <td className={`whitespace-nowrap py-3 px-4 text-sm ${missing ? 'text-amber-500 font-semibold' : 'text-gray-500'}`}>
                        {r.clockIn ?? (missing ? <span className="inline-flex items-center gap-1"><AlertCircle size={12} className="text-amber-400"/>—</span> : '—')}
                      </td>
                      <td className={`whitespace-nowrap py-3 px-4 text-sm ${missing ? 'text-amber-500 font-semibold' : 'text-gray-500'}`}>
                        {r.clockOut ?? (missing ? <span className="inline-flex items-center gap-1"><AlertCircle size={12} className="text-amber-400"/>—</span> : '—')}
                      </td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm text-gray-700">{r.actualHours?.toFixed(2)??'—'}</td>
                      <td className="whitespace-nowrap py-3 px-4">{r.absenceType && <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">{ABSENCE_LABELS[r.absenceType]}</span>}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-xs text-gray-500">{r.workLocation ? WORK_LOCATION_LABELS[r.workLocation] : '—'}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-xs text-gray-400">{r.notes}</td>
                      <td className="whitespace-nowrap py-3 px-4"><button type="button" onClick={()=>dispatch({type:'DELETE_ATTENDANCE',payload:r.id})} aria-label="מחיקה" className="p-1 text-gray-300 hover:text-red-600"><Trash2 size={14}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200/70 bg-white/50 px-4 py-3">
              <span className="text-xs text-gray-500">
                מציג {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} מתוך {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="עמוד קודם"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i).map(i => {
                  const isActive = i === page;
                  const isNearby = Math.abs(i - page) <= 2;
                  const isEdge = i === 0 || i === totalPages - 1;
                  if (!isNearby && !isEdge) {
                    if (i === 1 || i === totalPages - 2) {
                      return <span key={i} className="text-xs text-gray-400 px-1">…</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                        isActive
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'border-slate-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="עמוד הבא"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddManual && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <button type="button" className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={()=>setShowAddManual(false)} aria-label="סגור חלון" />
            <div className="modal-panel relative max-w-lg w-full">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
                <h3 className="text-base font-semibold text-gray-900">הוספה ידנית</h3>
                <button type="button" onClick={()=>setShowAddManual(false)} className="p-1 text-gray-400 hover:text-gray-500 rounded"><X size={18}/></button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label htmlFor="manual-employee" className="block text-sm font-medium text-gray-700 mb-1">עובד *</label>
                    <select id="manual-employee" className={inp} value={manualRecord.employeeId??''} onChange={e=>setManualRecord({...manualRecord,employeeId:e.target.value})}>
                      <option value="">— בחר עובד —</option>
                      {state.employees.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="manual-date" className="block text-sm font-medium text-gray-700 mb-1">תאריך *</label>
                    <input id="manual-date" type="date" className={inp} value={manualRecord.date??''} onChange={e=>setManualRecord({...manualRecord,date:e.target.value})}/>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2.5">שעות נוכחות</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="manual-clockIn" className="block text-sm font-medium text-gray-700 mb-1">כניסה</label>
                      <input id="manual-clockIn" type="time" className={inp} value={manualRecord.clockIn??''} onChange={e=>setManualRecord({...manualRecord,clockIn:e.target.value})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-clockOut" className="block text-sm font-medium text-gray-700 mb-1">יציאה</label>
                      <input id="manual-clockOut" type="time" className={inp} value={manualRecord.clockOut??''} onChange={e=>setManualRecord({...manualRecord,clockOut:e.target.value})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-breakMin" className="block text-sm font-medium text-gray-700 mb-1">דקות הפסקה</label>
                      <input id="manual-breakMin" type="number" step="1" min="0" className={inp} value={manualRecord.breakMinutesActual??''} onChange={e=>setManualRecord({...manualRecord,breakMinutesActual:+e.target.value||undefined})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-hours" className="block text-sm font-medium text-gray-700 mb-1">שעות בפועל</label>
                      <input id="manual-hours" type="number" step="0.25" className={inp} value={manualRecord.actualHours??''} onChange={e=>setManualRecord({...manualRecord,actualHours:+e.target.value})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-breakStart" className="block text-sm font-medium text-gray-700 mb-1">תחילת הפסקה</label>
                      <input id="manual-breakStart" type="time" className={inp} value={manualRecord.breakStart??''} onChange={e=>setManualRecord({...manualRecord,breakStart:e.target.value||undefined})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-breakEnd" className="block text-sm font-medium text-gray-700 mb-1">סיום הפסקה</label>
                      <input id="manual-breakEnd" type="time" className={inp} value={manualRecord.breakEnd??''} onChange={e=>setManualRecord({...manualRecord,breakEnd:e.target.value||undefined})}/>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2.5">היעדרות</p>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label htmlFor="manual-absence" className="block text-sm font-medium text-gray-700 mb-1">סוג היעדרות</label>
                      <select id="manual-absence" className={inp} value={manualRecord.absenceType??''} onChange={e=>{const val=e.target.value;setManualRecord({...manualRecord,absenceType:val===''?undefined:val as AbsenceType})}}>
                        <option value="">— ללא —</option>
                        {Object.entries(ABSENCE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="manual-absenceHrs" className="block text-sm font-medium text-gray-700 mb-1">שעות היעדרות</label>
                      <input id="manual-absenceHrs" type="number" step="0.25" className={inp} value={manualRecord.absenceHours??''} onChange={e=>setManualRecord({...manualRecord,absenceHours:+e.target.value||undefined})}/>
                    </div>
                    <div>
                      <label htmlFor="manual-location" className="block text-sm font-medium text-gray-700 mb-1">מיקום עבודה</label>
                      <select id="manual-location" className={inp} value={manualRecord.workLocation??''} onChange={e=>{const val=e.target.value;setManualRecord({...manualRecord,workLocation:val===''?undefined:val as WorkLocation})}}>
                        <option value="">— ללא —</option>
                        {Object.entries(WORK_LOCATION_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="manual-notes" className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                  <input id="manual-notes" className={inp} value={manualRecord.notes??''} onChange={e=>setManualRecord({...manualRecord,notes:e.target.value})}/>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200/70 bg-white/50 px-6 py-4 rounded-b-[30px]">
                <button type="button" onClick={()=>setShowAddManual(false)} className="secondary-btn">ביטול</button>
                <button type="button" onClick={saveManual} className="primary-btn">שמור</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
