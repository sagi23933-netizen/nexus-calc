import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { generateTamalDat, downloadTamalFile } from '../lib/tamalGenerator';
import { Download, Eye, AlertCircle, CheckCircle2, FileText, Users, Hash, HardDrive, Calculator } from 'lucide-react';
import { MONTH_NAMES } from '../lib/constants';
import Modal from '../components/Modal';

function estimateFileSize(lineCount: number): string {
  const bytes = lineCount * 80 + 200;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ExportPage() {
  const { state } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [preview, setPreview] = useState('');
  const [showPrev, setShowPrev] = useState(false);
  const [exported, setExported] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const calcs = state.calculations.filter(c=>c.year===year&&c.month===month);
  const inp = 'field-input';

  const totalRecordLines = calcs.reduce((sum, c) => sum + (c.days?.length ?? 0), 0);
  const fileEst = estimateFileSize(totalRecordLines);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  function doPreview() {
    const content = generateTamalDat(state.calculations, state.componentMappings, year, month, state.employees);
    setPreview(content);
    setShowPrev(true);
  }
  function doDownload() {
    const content = preview || generateTamalDat(state.calculations, state.componentMappings, year, month, state.employees);
    downloadTamalFile(content, year, month);
    setExported(true);
    setShowConfirm(false);
  }

  return (
    <div className="page-shell">

      <div className="surface-card mb-6 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">בחר חודש ליצוא</h3>
        <div className="flex gap-4 items-end">
          <div><label htmlFor="export-year" className="block text-sm font-medium text-gray-700 mb-1">שנה</label><input id="export-year" type="number" className={`${inp} w-24`} value={year} onChange={e=>{setYear(+e.target.value);setExported(false);setShowConfirm(false)}}/></div>
          <div><label htmlFor="export-month" className="block text-sm font-medium text-gray-700 mb-1">חודש</label><select id="export-month" className={inp} value={month} onChange={e=>{setMonth(+e.target.value);setExported(false);setShowConfirm(false)}}>{MONTH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{i+1} — {n}</option>)}</select></div>
        </div>

        <div className="mt-4">
          {!calcs.length
            ? <div className="notice notice-warning"><AlertCircle size={16}/>אין חישובים עבור חודש זה. <Link to="/calculation" className="underline font-semibold text-indigo-600">עבור לחישוב</Link></div>
            : <div className="notice notice-success font-medium"><CheckCircle2 size={16}/>{calcs.length} עובדים מוכנים ליצוא</div>
          }
        </div>
      </div>

      {!calcs.length && (
        <div className="table-shell mb-6">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100">
              <Calculator size={28} className="text-amber-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">אין נתונים ליצוא עבור {monthLabel}</p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">יש להריץ חישוב שכר לחודש זה לפני הפקת הקובץ.</p>
            </div>
            <Link
              to="/calculation"
              className="primary-btn mt-1"
            >
              <Calculator size={15} />
              עבור לחישוב שכר
            </Link>
          </div>
        </div>
      )}

      {calcs.length > 0 && (
        <>
          <div className="table-shell mb-6">
            <div className="border-b border-slate-200/70 bg-white/50 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">סיכום ליצוא</h3>
              <p className="text-xs text-gray-500 mt-0.5">הנתונים זהים לתוצאות החישוב</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-900">מס'</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-900">שם</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-900">ימים</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-900">בפועל</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-700">רגיל</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-amber-600">125%</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-orange-600">150%</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-purple-600">שבת</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-violet-600">שבת 175%</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-fuchsia-600">שבת 200%</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-red-600">מחלה</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-blue-600">חופשה</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-rose-600">היעדרות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {calcs.map(c=>{const em=state.employees.find(e=>e.id===c.employeeId);return(
                    <tr key={c.employeeId} className="hover:bg-cyan-50/20">
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-cyan-700">{c.employeeNumber}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-medium text-gray-900">{em?.firstName} {em?.lastName}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-gray-700">{c.actualWorkDays}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono font-bold text-gray-900">{c.totalActualWorkHours.toFixed(2)}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-gray-600">{c.totalRegularHours.toFixed(2)}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-amber-600">{c.totalOvertime125Hours>0?c.totalOvertime125Hours.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-orange-600">{c.totalOvertime150Hours>0?c.totalOvertime150Hours.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-purple-600">{c.totalSaturdayHours>0?c.totalSaturdayHours.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-violet-600">{c.totalSaturdayOvertimeHours>0?c.totalSaturdayOvertimeHours.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-fuchsia-600">{(c.totalSaturdayOvertime2Hours??0)>0?c.totalSaturdayOvertime2Hours!.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-red-600">{c.totalSickDays>0?c.totalSickDays.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-blue-600">{c.totalVacationDays>0?c.totalVacationDays.toFixed(2):'—'}</td>
                      <td className="whitespace-nowrap py-3 px-3 text-sm font-mono text-rose-600">{c.totalAbsenceHours>0?c.totalAbsenceHours.toFixed(2):'—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <button type="button" onClick={doPreview} className="secondary-btn">
              <Eye size={16}/> תצוגה מקדימה
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="cta-btn"
              style={{ minWidth: '180px' }}
            >
              <Download size={16}/> הורד TAMAL-5.DAT
            </button>
          </div>

          {exported && (
            <div className="notice notice-success mt-2 font-medium">
              <CheckCircle2 size={16}/> הקובץ הורד בהצלחה!
            </div>
          )}
        </>
      )}

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="אישור הורדת קובץ"
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setShowConfirm(false)} className="secondary-btn">ביטול</button>
            <button type="button" onClick={doDownload} className="cta-btn">
              <Download size={15} /> הורד
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">בדוק את פרטי הקובץ לפני ההורדה:</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText size={15} className="text-blue-500" />
              <span>חודש</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 font-mono">{monthLabel}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={15} className="text-blue-500" />
              <span>עובדים</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 font-mono">{calcs.length}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Hash size={15} className="text-blue-500" />
              <span>שורות נתונים</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 font-mono">{totalRecordLines}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <HardDrive size={15} className="text-blue-500" />
              <span>גודל משוער</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 font-mono">{fileEst}</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPrev}
        onClose={() => setShowPrev(false)}
        title={`TAMAL-5.DAT — ${preview.replace(/\r\n|\r/g, '\n').split('\n').filter(l => l.trim()).length} שורות`}
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setShowPrev(false)} className="secondary-btn">סגור</button>
            <button type="button" onClick={() => { doDownload(); setShowPrev(false); }} className="cta-btn"><Download size={14} /> הורד</button>
          </>
        }
      >
        <div className="max-h-[60vh] overflow-auto">
          <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-md whitespace-pre leading-6 overflow-x-auto">{preview || '(ריק)'}</pre>
        </div>
      </Modal>
    </div>
  );
}
