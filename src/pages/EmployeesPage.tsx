import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { Employee } from '../types';
import { Plus, Upload, Edit2, Trash2, Search, X, Check, AlertCircle, Users, ChevronDown } from 'lucide-react';
import { readEmployeesFromExcel } from '../lib/excelParser';
import { generateId } from '../lib/utils';
import Modal from '../components/Modal';

const emptyEmployee = (): Employee => ({
  id: generateId(), employeeNumber: '', firstName: '', lastName: '', agreementId: '',
  employmentType: 'monthly', startDate: '', workPercentage: 100, department: '',
  isActive: true, sickDaysBalance: 0, vacationDaysBalance: 0, globalOvertimeBalance: 0,
  restDay: 6, religion: undefined,
});

interface BulkBalancesForm {
  vacation: string;
  sick: string;
  globalOT: string;
}

export default function EmployeesPage() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [bulkAgreementOpen, setBulkAgreementOpen] = useState(false);
  const [bulkAgreementId, setBulkAgreementId] = useState('');
  const [pendingAgreementApply, setPendingAgreementApply] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [balancesForm, setBalancesForm] = useState<BulkBalancesForm>({ vacation: '', sick: '', globalOT: '' });
  const [pendingBalancesApply, setPendingBalancesApply] = useState(false);

  const filtered = useMemo(() => state.employees.filter(e => !search || e.firstName.includes(search) || e.lastName.includes(search) || e.employeeNumber.includes(search) || e.department?.includes(search)), [state.employees, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(e => next.add(e.id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAgreementOpen(false);
    setBulkAgreementId('');
    setPendingAgreementApply(false);
    setPendingBalancesApply(false);
  }

  function handleBulkAgreementApply() {
    if (!bulkAgreementId) return;
    const agr = state.agreements.find(a => a.id === bulkAgreementId);
    if (!agr) return;
    if (!pendingAgreementApply) {
      setPendingAgreementApply(true);
      return;
    }
    const updated = state.employees.map(e =>
      selectedIds.has(e.id) ? { ...e, agreementId: bulkAgreementId } : e
    );
    dispatch({ type: 'SET_EMPLOYEES', payload: updated });
    setBulkAgreementOpen(false);
    setBulkAgreementId('');
    setPendingAgreementApply(false);
    clearSelection();
  }

  function cancelAgreementPending() {
    setPendingAgreementApply(false);
  }

  function openBalancesModal() {
    setBalancesForm({ vacation: '', sick: '', globalOT: '' });
    setPendingBalancesApply(false);
    setShowBalancesModal(true);
  }

  function handleBulkBalancesApply() {
    const hasAny = balancesForm.vacation !== '' || balancesForm.sick !== '' || balancesForm.globalOT !== '';
    if (!hasAny) { alert('יש למלא לפחות שדה אחד'); return; }
    if (!pendingBalancesApply) {
      setPendingBalancesApply(true);
      return;
    }
    state.employees
      .filter(e => selectedIds.has(e.id))
      .forEach(e => {
        const updated = { ...e };
        if (balancesForm.vacation !== '') { const v = parseFloat(balancesForm.vacation); if (Number.isFinite(v)) updated.vacationDaysBalance = v; }
        if (balancesForm.sick !== '') { const v = parseFloat(balancesForm.sick); if (Number.isFinite(v)) updated.sickDaysBalance = v; }
        if (balancesForm.globalOT !== '') { const v = parseFloat(balancesForm.globalOT); if (Number.isFinite(v)) updated.globalOvertimeBalance = v; }
        dispatch({ type: 'UPDATE_EMPLOYEE', payload: updated });
      });
    setShowBalancesModal(false);
    setBalancesForm({ vacation: '', sick: '', globalOT: '' });
    setPendingBalancesApply(false);
    clearSelection();
  }

  function startAdd() { const emp = emptyEmployee(); if (state.agreements.length > 0) emp.agreementId = state.agreements[0].id; setFormData(emp); setEditingId(null); setFormErrors({}); setShowForm(true); }
  function startEdit(emp: Employee) { setFormData({ ...emp }); setEditingId(emp.id); setFormErrors({}); setShowForm(true); }
  function saveEmployee() {
    if (!formData) return;
    const errors: Record<string, string> = {};
    if (!formData.employeeNumber.trim()) errors.employeeNumber = 'נא להזין מספר עובד';
    if (!formData.firstName.trim() && !formData.lastName.trim()) errors.name = 'נא להזין שם';
    if (!formData.agreementId) errors.agreementId = 'נא לבחור הסכם';
    const duplicate = state.employees.find(e => e.employeeNumber.trim() === formData.employeeNumber.trim() && e.id !== formData.id);
    if (duplicate) errors.employeeNumber = 'מספר עובד כבר קיים במערכת';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    dispatch({ type: editingId ? 'UPDATE_EMPLOYEE' : 'ADD_EMPLOYEE', payload: formData });
    setShowForm(false); setFormData(null);
  }
  function deleteEmployee(id: string) { if (confirm('למחוק עובד?')) dispatch({ type: 'DELETE_EMPLOYEE', payload: id }); }
  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setImportMsg('');
    try {
      if (state.agreements.length === 0) { alert('אין הסכמים מוגדרים — יש להגדיר הסכם לפני ייבוא עובדים'); return; }
      const partials = await readEmployeesFromExcel(file);
      const newEmployees: Employee[] = [];
      const seenNumbers = new Set<string>();
      const existingNumbers = new Set(state.employees.map(e => e.employeeNumber?.trim() || ''));
      for (const p of partials) {
        if (!p.employeeNumber) continue;
        const num = p.employeeNumber.trim();
        if (existingNumbers.has(num)) continue;
        if (seenNumbers.has(num)) continue;
        seenNumbers.add(num);
        newEmployees.push({ ...emptyEmployee(), ...p, id: generateId(), agreementId: state.agreements[0]?.id ?? '' } as Employee);
      }
      if (newEmployees.length > 0) { dispatch({ type: 'SET_EMPLOYEES', payload: [...state.employees, ...newEmployees] }); }
      setImportMsg(`יובאו ${newEmployees.length} עובדים מתוך ${partials.length}`);
    } catch { setImportMsg('שגיאה בקריאת הקובץ'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  const inp = 'field-input';
  const selectedCount = selectedIds.size;
  const bulkAgreementName = state.agreements.find(a => a.id === bulkAgreementId)?.name;

  return (
    <div className="page-shell" style={{ paddingBottom: someSelected ? '88px' : undefined }}>
      <div className="flex flex-wrap gap-2 mb-5">
        <button type="button" onClick={() => fileRef.current?.click()} className="secondary-btn">
          <Upload size={15} /> ייבוא Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
        <button type="button" onClick={startAdd} className="primary-btn">
          <Plus size={15} /> הוסף עובד
        </button>
      </div>

      {importMsg && (
        <div className="notice notice-success mb-4">
          <Check size={16} /> {importMsg}
          <button type="button" onClick={() => setImportMsg('')} aria-label="סגירה" className="mr-auto opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      {state.agreements.length === 0 && (
        <div className="notice notice-warning mb-4">
          <AlertCircle size={16} /> אין הסכמים מוגדרים — <Link to="/agreements" className="underline font-semibold">הגדר הסכם</Link> לפני הוספת עובדים
        </div>
      )}

      <div className="surface-card mb-4 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="חיפוש לפי שם, מספר, מחלקה..." value={search} onChange={e => setSearch(e.target.value)} className="field-input pr-11" />
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20 tabular-nums whitespace-nowrap">
            {filtered.length} עובדים
          </span>
          {someSelected && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-600/25 tabular-nums whitespace-nowrap animate-pulse-once">
              <Users size={13} />
              {selectedCount} נבחרו
            </span>
          )}
        </div>
      </div>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-white/65">
              <tr>
                <th className="py-3.5 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={el => { if (el) el.indeterminate = !allFilteredSelected && filtered.some(e => selectedIds.has(e.id)); }}
                    onChange={toggleSelectAll}
                    aria-label="בחר הכל"
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3 text-right text-xs font-semibold text-gray-900 w-24">מס' עובד</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900 min-w-[160px]">שם</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">מחלקה</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">הסכם</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">משרה</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">חופשה</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">מחלה</th>
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-gray-900">סטטוס</th>
                <th className="relative py-3.5 px-4"><span className="sr-only">פעולות</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-transparent">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-14 text-sm text-gray-400">{state.employees.length === 0 ? 'אין עובדים — לחץ "הוסף עובד"' : 'לא נמצאו תוצאות'}</td></tr>
              )}
              {filtered.map(emp => {
                const isSelected = selectedIds.has(emp.id);
                const agr = state.agreements.find(a => a.id === emp.agreementId);
                const vacationColor = emp.vacationDaysBalance < 0
                  ? 'text-red-600 font-semibold'
                  : emp.vacationDaysBalance > 0
                    ? 'text-green-600 font-semibold'
                    : 'text-gray-400';
                const sickColor = emp.sickDaysBalance < 0
                  ? 'text-red-600 font-semibold'
                  : emp.sickDaysBalance > 0
                    ? 'text-green-600 font-semibold'
                    : 'text-gray-400';
                return (
                  <tr
                    key={emp.id}
                    className={`transition-colors duration-100 ${isSelected ? 'bg-cyan-50/40 hover:bg-cyan-50/60' : 'hover:bg-white/50'}`}
                  >
                    <td className="py-3.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(emp.id)}
                        aria-label={`בחר ${emp.firstName} ${emp.lastName}`}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="whitespace-nowrap py-3.5 px-3 text-sm font-mono text-indigo-600 w-24">{emp.employeeNumber}</td>
                    <td className="whitespace-nowrap py-3.5 px-4 text-sm font-medium text-gray-900 min-w-[160px]">{emp.firstName} {emp.lastName}</td>
                    <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{emp.department || '—'}</td>
                    <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{agr?.name || <span className="text-red-500">לא שויך</span>}</td>
                    <td className="whitespace-nowrap py-3.5 px-4 text-sm text-gray-500">{emp.workPercentage}%</td>
                    <td className={`whitespace-nowrap py-3.5 px-4 text-sm tabular-nums ${vacationColor}`}>{emp.vacationDaysBalance}</td>
                    <td className={`whitespace-nowrap py-3.5 px-4 text-sm tabular-nums ${sickColor}`}>{emp.sickDaysBalance}</td>
                    <td className="whitespace-nowrap py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${emp.isActive ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-500/10'}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${emp.isActive ? 'bg-green-500' : 'bg-gray-400'}`} aria-hidden="true" />
                        {emp.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3.5 px-4 text-sm">
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => startEdit(emp)} aria-label="עריכה" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"><Edit2 size={15} /></button>
                        <button type="button" onClick={() => deleteEmployee(emp.id)} aria-label="מחיקה" className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="פעולות על נבחרים"
        className={`fixed bottom-0 right-0 left-0 z-40 flex items-center gap-3 px-6 py-4
          bg-white/85 backdrop-blur-md border-t border-cyan-200/60
          rounded-tl-2xl rounded-tr-2xl shadow-lg
          transition-all duration-300 ease-out
          ${someSelected ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}`}
        style={{ maxWidth: '100vw' }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 text-cyan-800 px-3 py-1 text-sm font-semibold ring-1 ring-inset ring-cyan-500/25 whitespace-nowrap shrink-0">
          <Users size={14} />
          {selectedCount} {selectedCount === 1 ? 'עובד נבחר' : 'עובדים נבחרו'}
        </span>

        <div className="w-px h-6 bg-slate-200 shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-2 shrink-0">
          {!pendingAgreementApply ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBulkAgreementOpen(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1"
                  aria-haspopup="listbox"
                  aria-expanded={bulkAgreementOpen}
                >
                  שנה הסכם
                  <ChevronDown size={14} className={`transition-transform duration-150 ${bulkAgreementOpen ? 'rotate-180' : ''}`} />
                </button>
                {bulkAgreementOpen && (
                  <div className="absolute bottom-full mb-2 right-0 z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {state.agreements.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">אין הסכמים מוגדרים</div>
                    ) : (
                      state.agreements.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => { setBulkAgreementId(a.id); setBulkAgreementOpen(false); }}
                          className={`w-full text-right px-4 py-2 text-sm hover:bg-cyan-50 hover:text-cyan-800 transition-colors ${bulkAgreementId === a.id ? 'font-semibold text-cyan-700 bg-cyan-50/60' : 'text-gray-700'}`}
                        >
                          {a.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {bulkAgreementId && (
                <button
                  type="button"
                  onClick={handleBulkAgreementApply}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 transition-colors"
                >
                  <Check size={14} />
                  החל
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                לשנות הסכם ל-<strong className="text-cyan-700">{bulkAgreementName}</strong> עבור {selectedCount} עובדים?
              </span>
              <button
                type="button"
                onClick={handleBulkAgreementApply}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700 transition-colors"
              >
                <Check size={14} />
                אישור
              </button>
              <button
                type="button"
                onClick={cancelAgreementPending}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-slate-50 transition-colors"
              >
                חזור
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={openBalancesModal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 shrink-0"
        >
          עדכן יתרות
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={clearSelection}
          aria-label="בטל בחירה"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-colors shrink-0"
        >
          <X size={14} />
          ביטול
        </button>
      </div>

      <Modal open={showBalancesModal} onClose={() => { setShowBalancesModal(false); setPendingBalancesApply(false); }}
        title={`עדכון יתרות — ${selectedCount} ${selectedCount === 1 ? 'עובד' : 'עובדים'}`} size="sm"
        footer={<>
          <button type="button" onClick={() => { setShowBalancesModal(false); setPendingBalancesApply(false); }} className="secondary-btn">ביטול</button>
          <button type="button" onClick={handleBulkBalancesApply} className="primary-btn">{pendingBalancesApply ? 'אשר ועדכן' : 'עדכן'}</button>
        </>}>
        <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  השאר שדה ריק כדי לא לשנות אותו.
                </p>
                <div>
                  <label htmlFor="bulk-vacation" className="block text-sm font-medium text-gray-700 mb-1">יתרת חופשה (ימים)</label>
                  <input
                    id="bulk-vacation"
                    type="number"
                    step="0.5"
                    placeholder="ריק = ללא שינוי"
                    value={balancesForm.vacation}
                    onChange={e => { setBalancesForm(f => ({ ...f, vacation: e.target.value })); setPendingBalancesApply(false); }}
                    className={inp}
                  />
                </div>
                <div>
                  <label htmlFor="bulk-sick" className="block text-sm font-medium text-gray-700 mb-1">יתרת מחלה (ימים)</label>
                  <input
                    id="bulk-sick"
                    type="number"
                    step="0.5"
                    placeholder="ריק = ללא שינוי"
                    value={balancesForm.sick}
                    onChange={e => { setBalancesForm(f => ({ ...f, sick: e.target.value })); setPendingBalancesApply(false); }}
                    className={inp}
                  />
                </div>
                <div>
                  <label htmlFor="bulk-globalOT" className="block text-sm font-medium text-gray-700 mb-1">ש"נ גלובלי (שעות)</label>
                  <input
                    id="bulk-globalOT"
                    type="number"
                    step="0.5"
                    placeholder="ריק = ללא שינוי"
                    value={balancesForm.globalOT}
                    onChange={e => { setBalancesForm(f => ({ ...f, globalOT: e.target.value })); setPendingBalancesApply(false); }}
                    className={inp}
                  />
                </div>

                {pendingBalancesApply && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <strong>אישור:</strong> לעדכן יתרות עבור {selectedCount} עובדים?
                    <div className="flex gap-2 mt-2">
                      {balancesForm.vacation !== '' && <span className="bg-white rounded px-2 py-0.5 text-xs border border-amber-200">חופשה: {balancesForm.vacation}</span>}
                      {balancesForm.sick !== '' && <span className="bg-white rounded px-2 py-0.5 text-xs border border-amber-200">מחלה: {balancesForm.sick}</span>}
                      {balancesForm.globalOT !== '' && <span className="bg-white rounded px-2 py-0.5 text-xs border border-amber-200">ש"נ גלובלי: {balancesForm.globalOT}</span>}
                    </div>
                  </div>
                )}
              </div>
      </Modal>

      <Modal open={!!(showForm && formData)} onClose={() => setShowForm(false)}
        title={editingId ? 'עריכת עובד' : 'עובד חדש'} size="xl"
        footer={<>
          <button type="button" onClick={() => setShowForm(false)} className="secondary-btn">ביטול</button>
          <button type="button" onClick={saveEmployee} className="primary-btn">שמור</button>
        </>}>
        {formData && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l: 'מספר עובד *', v: formData.employeeNumber, k: 'employeeNumber', ph: '1234567' },
                  { l: 'שם פרטי *', v: formData.firstName, k: 'firstName' },
                  { l: 'שם משפחה *', v: formData.lastName, k: 'lastName' },
                  { l: 'מחלקה', v: formData.department || '', k: 'department' },
                ].map(({ l, v, k, ph }) => (
                  <div key={k}>
                    <label htmlFor={`emp-${k}`} className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                    <input id={`emp-${k}`} className={inp} value={v} placeholder={ph} onChange={e => setFormData({ ...formData, [k]: e.target.value })} />
                    {k === 'employeeNumber' && formErrors.employeeNumber && <p className="text-xs text-red-500 mt-1">{formErrors.employeeNumber}</p>}
                    {(k === 'firstName' || k === 'lastName') && formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                  </div>
                ))}
                <div>
                  <label htmlFor="emp-agreementId" className="block text-sm font-medium text-gray-700 mb-1">הסכם *</label>
                  <select id="emp-agreementId" className={inp} value={formData.agreementId} onChange={e => setFormData({ ...formData, agreementId: e.target.value })}><option value="">— בחר —</option>{state.agreements.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                  {formErrors.agreementId && <p className="text-xs text-red-500 mt-1">{formErrors.agreementId}</p>}
                </div>
                <div><label htmlFor="emp-employmentType" className="block text-sm font-medium text-gray-700 mb-1">סוג העסקה</label><select id="emp-employmentType" className={inp} value={formData.employmentType} onChange={e => setFormData({ ...formData, employmentType: e.target.value as 'monthly' | 'hourly' })}><option value="monthly">חודשי</option><option value="hourly">שעתי</option></select></div>
                <div><label htmlFor="emp-workPercentage" className="block text-sm font-medium text-gray-700 mb-1">אחוז משרה</label><input id="emp-workPercentage" type="number" className={inp} value={formData.workPercentage} onChange={e => setFormData({ ...formData, workPercentage: +e.target.value })} /></div>
                <div><label htmlFor="emp-startDate" className="block text-sm font-medium text-gray-700 mb-1">תחילת עבודה</label><input id="emp-startDate" type="date" className={inp} value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
                <div><label htmlFor="emp-vacationDaysBalance" className="block text-sm font-medium text-gray-700 mb-1">חופשה (ימים)</label><input id="emp-vacationDaysBalance" type="number" step="0.5" className={inp} value={formData.vacationDaysBalance} onChange={e => setFormData({ ...formData, vacationDaysBalance: +e.target.value })} /></div>
                <div><label htmlFor="emp-sickDaysBalance" className="block text-sm font-medium text-gray-700 mb-1">מחלה (ימים)</label><input id="emp-sickDaysBalance" type="number" step="0.5" className={inp} value={formData.sickDaysBalance} onChange={e => setFormData({ ...formData, sickDaysBalance: +e.target.value })} /></div>
                <div><label htmlFor="emp-globalOvertimeBalance" className="block text-sm font-medium text-gray-700 mb-1">ש"נ גלובלי (שעות)</label><input id="emp-globalOvertimeBalance" type="number" step="0.5" className={inp} value={formData.globalOvertimeBalance || 0} onChange={e => setFormData({ ...formData, globalOvertimeBalance: +e.target.value })} /></div>
                <div><label htmlFor="emp-isActive" className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label><select id="emp-isActive" className={inp} value={formData.isActive ? 'active' : 'inactive'} onChange={e => setFormData({ ...formData, isActive: e.target.value === 'active' })}><option value="active">פעיל</option><option value="inactive">לא פעיל</option></select></div>
                <div><label htmlFor="emp-restDay" className="block text-sm font-medium text-gray-700 mb-1">יום מנוחה</label><select id="emp-restDay" className={inp} value={formData.restDay ?? 6} onChange={e => setFormData({ ...formData, restDay: +e.target.value as 0|1|2|3|4|5|6 })}><option value={0}>ראשון</option><option value={1}>שני</option><option value={2}>שלישי</option><option value={3}>רביעי</option><option value={4}>חמישי</option><option value={5}>שישי</option><option value={6}>שבת</option></select></div>
                <div><label htmlFor="emp-religion" className="block text-sm font-medium text-gray-700 mb-1">דת</label><select id="emp-religion" className={inp} value={formData.religion ?? ''} onChange={e => setFormData({ ...formData, religion: (e.target.value || undefined) as Employee['religion'] })}><option value="">— לא צוין —</option><option value="jewish">יהודי</option><option value="muslim">מוסלמי</option><option value="christian">נוצרי</option><option value="druze">דרוזי</option></select></div>
              </div>
        )}
      </Modal>
    </div>
  );
}
