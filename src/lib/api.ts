import { firestore } from './firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  writeBatch, query,
} from 'firebase/firestore';


function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = stripUndefined(v);
    }
    return clean;
  }
  return obj;
}

async function getAllDocs(col: string): Promise<any[]> {
  const snap = await getDocs(query(collection(firestore, col)));
  return snap.docs.map(d => d.data());
}


async function getState(): Promise<any> {
  const [employees, agreementsRaw, attendance, holidays, componentMappings, calculationsRaw] = await Promise.all([
    getAllDocs('employees'),
    getAllDocs('agreements'),
    getAllDocs('attendance'),
    getAllDocs('holidays'),
    getAllDocs('componentMappings'),
    getAllDocs('calculations'),
  ]);

  const agreements = agreementsRaw.map(a => {
    if (a.data && typeof a.data === 'object' && !Array.isArray(a.data)) {
      return { ...a.data, id: a.id };
    }
    return a;
  });

  const calculations = calculationsRaw.map(c => {
    if (c.data && typeof c.data === 'object' && !Array.isArray(c.data)) {
      return { ...c.data, id: c.id };
    }
    return c;
  });

  return { employees, agreements, attendance, holidays, componentMappings, calculations };
}

async function loadState(state: any): Promise<{ success: boolean }> {
  const batch = writeBatch(firestore);

  if (state.agreements) {
    for (const agr of state.agreements) {
      const id = agr.id;
      if (!id) continue;
      const { id: _id, ...rest } = agr;
      batch.set(doc(firestore, 'agreements', id), stripUndefined({ id, data: rest }));
    }
  }

  if (state.employees) {
    for (const emp of state.employees) {
      if (!emp.id) continue;
      batch.set(doc(firestore, 'employees', emp.id), stripUndefined(emp));
    }
  }

  if (state.attendance) {
    for (const att of state.attendance) {
      if (!att.id) continue;
      batch.set(doc(firestore, 'attendance', att.id), stripUndefined(att));
    }
  }

  if (state.holidays) {
    for (const h of state.holidays) {
      if (!h.id) continue;
      batch.set(doc(firestore, 'holidays', h.id), stripUndefined(h));
    }
  }

  if (state.componentMappings) {
    for (const m of state.componentMappings) {
      if (!m.internalKey) continue;
      batch.set(doc(firestore, 'componentMappings', m.internalKey), stripUndefined(m));
    }
  }

  if (state.calculations) {
    for (const calc of state.calculations) {
      const id = calc.id || `calc-${calc.employeeId}-${calc.year}-${calc.month}`;
      batch.set(doc(firestore, 'calculations', id), stripUndefined({
        id,
        employeeId: calc.employeeId,
        month: calc.month,
        year: calc.year,
        data: calc,
      }));
    }
  }

  await batch.commit();
  return { success: true };
}


export const api = {
  getState,
  loadState,

  addEmployee: async (emp: any) => {
    await setDoc(doc(firestore, 'employees', emp.id), stripUndefined(emp));
  },
  updateEmployee: async (emp: any) => {
    const ref = doc(firestore, 'employees', emp.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, stripUndefined(emp));
    } else {
      await setDoc(ref, stripUndefined(emp));
    }
  },
  deleteEmployee: async (id: string) => {
    await deleteDoc(doc(firestore, 'employees', id));
  },

  addAgreement: async (agr: any) => {
    const { id, ...rest } = agr;
    await setDoc(doc(firestore, 'agreements', id), stripUndefined({ id, data: rest }));
  },
  updateAgreement: async (agr: any) => {
    const { id, ...rest } = agr;
    await setDoc(doc(firestore, 'agreements', id), stripUndefined({ id, data: rest }));
  },
  deleteAgreement: async (id: string) => {
    await deleteDoc(doc(firestore, 'agreements', id));
  },

 
  addAttendanceBatch: async (recs: any[]) => {
    const batch = writeBatch(firestore);
    for (const rec of recs) {
      if (!rec.id) continue;
      batch.set(doc(firestore, 'attendance', rec.id), stripUndefined(rec));
    }
    await batch.commit();
  },
  updateAttendance: async (rec: any) => {
    await setDoc(doc(firestore, 'attendance', rec.id), stripUndefined(rec));
  },
  deleteAttendance: async (id: string) => {
    await deleteDoc(doc(firestore, 'attendance', id));
  },

  setHolidays: async (holidays: any[]) => {
    const existing = await getDocs(collection(firestore, 'holidays'));
    const batch = writeBatch(firestore);
    existing.docs.forEach(d => batch.delete(d.ref));
    for (const h of holidays) {
      if (!h.id) continue;
      batch.set(doc(firestore, 'holidays', h.id), stripUndefined(h));
    }
    await batch.commit();
  },
  addHoliday: async (h: any) => {
    await setDoc(doc(firestore, 'holidays', h.id), stripUndefined(h));
  },
  updateHoliday: async (h: any) => {
    await setDoc(doc(firestore, 'holidays', h.id), stripUndefined(h));
  },
  deleteHoliday: async (id: string) => {
    await deleteDoc(doc(firestore, 'holidays', id));
  },

  setComponentMappings: async (mappings: any[]) => {
    const existing = await getDocs(collection(firestore, 'componentMappings'));
    const batch = writeBatch(firestore);
    existing.docs.forEach(d => batch.delete(d.ref));
    for (const m of mappings) {
      if (!m.internalKey) continue;
      batch.set(doc(firestore, 'componentMappings', m.internalKey), stripUndefined(m));
    }
    await batch.commit();
  },
  updateComponentMapping: async (m: any) => {
    await setDoc(doc(firestore, 'componentMappings', m.internalKey), stripUndefined(m));
  },

  addCalculation: async (calc: any) => {
    const id = calc.id || `calc-${calc.employeeId}-${calc.year}-${calc.month}`;
    await setDoc(doc(firestore, 'calculations', id), stripUndefined({
      id,
      employeeId: calc.employeeId,
      month: calc.month,
      year: calc.year,
      data: calc,
    }));
  },
  deleteCalculation: async (employeeId: string, year: number, month: number) => {
    const id = `calc-${employeeId}-${year}-${month}`;
    await deleteDoc(doc(firestore, 'calculations', id));
  },
  setCalculations: async (calcs: any[]) => {
    const batch = writeBatch(firestore);
    for (const calc of calcs) {
      const id = calc.id || `calc-${calc.employeeId}-${calc.year}-${calc.month}`;
      batch.set(doc(firestore, 'calculations', id), stripUndefined({
        id,
        employeeId: calc.employeeId,
        month: calc.month,
        year: calc.year,
        data: calc,
      }));
    }
    await batch.commit();
  },
};
