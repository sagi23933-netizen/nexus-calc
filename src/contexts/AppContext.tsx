import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type {
  AppState, Employee, AgreementParams, AttendanceRecord,
  Holiday, ComponentMapping, MonthlyCalculation,
} from '../types';
import { DEFAULT_COMPONENT_MAPPINGS } from '../types';
import { defaultAgreements, defaultHolidays } from '../lib/defaults';
import { api } from '../lib/api';

type Action =
  | { type: 'SET_EMPLOYEES'; payload: Employee[] }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'DELETE_EMPLOYEE'; payload: string }
  | { type: 'SET_AGREEMENTS'; payload: AgreementParams[] }
  | { type: 'ADD_AGREEMENT'; payload: AgreementParams }
  | { type: 'UPDATE_AGREEMENT'; payload: AgreementParams }
  | { type: 'DELETE_AGREEMENT'; payload: string }
  | { type: 'SET_ATTENDANCE'; payload: AttendanceRecord[] }
  | { type: 'ADD_ATTENDANCE_BATCH'; payload: AttendanceRecord[] }
  | { type: 'UPDATE_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'DELETE_ATTENDANCE'; payload: string }
  | { type: 'SET_HOLIDAYS'; payload: Holiday[] }
  | { type: 'ADD_HOLIDAY'; payload: Holiday }
  | { type: 'UPDATE_HOLIDAY'; payload: Holiday }
  | { type: 'DELETE_HOLIDAY'; payload: string }
  | { type: 'SET_COMPONENT_MAPPINGS'; payload: ComponentMapping[] }
  | { type: 'UPDATE_COMPONENT_MAPPING'; payload: ComponentMapping }
  | { type: 'SET_CALCULATIONS'; payload: MonthlyCalculation[] }
  | { type: 'ADD_CALCULATION'; payload: MonthlyCalculation }
  | { type: 'UPDATE_CALCULATION'; payload: MonthlyCalculation }
  | { type: 'DELETE_CALCULATION'; payload: { employeeId: string; month: number; year: number } }
  | { type: 'LOAD_STATE'; payload: AppState };

const initialState: AppState = {
  employees: [],
  agreements: defaultAgreements(),
  attendance: [],
  holidays: defaultHolidays(),
  componentMappings: DEFAULT_COMPONENT_MAPPINGS,
  calculations: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE': {
      const s = action.payload;
      const empIds = new Set(s.employees.map(e => e.id));
      return {
        ...s,
        calculations: s.calculations.filter(c => empIds.has(c.employeeId)),
        attendance: s.attendance.filter(a => empIds.has(a.employeeId)),
      };
    }

    case 'SET_EMPLOYEES':
      return { ...state, employees: action.payload };
    case 'ADD_EMPLOYEE':
      return { ...state, employees: [...state.employees, action.payload] };
    case 'UPDATE_EMPLOYEE':
      return { ...state, employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EMPLOYEE':
      return {
        ...state,
        employees: state.employees.filter(e => e.id !== action.payload),
        calculations: state.calculations.filter(c => c.employeeId !== action.payload),
        attendance: state.attendance.filter(a => a.employeeId !== action.payload),
      };

    case 'SET_AGREEMENTS':
      return { ...state, agreements: action.payload };
    case 'ADD_AGREEMENT':
      return { ...state, agreements: [...state.agreements, { ...action.payload, version: 1, versionHistory: [] }] };
    case 'UPDATE_AGREEMENT': {
      return { ...state, agreements: state.agreements.map(a => {
        if (a.id !== action.payload.id) return a;
        
        const oldVersion = a.version ?? 1;
        const { versionHistory: _vh, ...oldSnapshot } = a;
        const newVersion = oldVersion + 1;
        const history = [...(a.versionHistory ?? []), {
          version: oldVersion,
          snapshot: oldSnapshot,
          modifiedAt: new Date().toISOString(),
        }].slice(-50);
        return { ...action.payload, version: newVersion, versionHistory: history };
      })};
    }
    case 'DELETE_AGREEMENT':
      return { ...state, agreements: state.agreements.filter(a => a.id !== action.payload) };

    case 'SET_ATTENDANCE':
      return { ...state, attendance: action.payload };
    case 'ADD_ATTENDANCE_BATCH':
      return { ...state, attendance: [...state.attendance, ...action.payload] };
    case 'UPDATE_ATTENDANCE':
      return { ...state, attendance: state.attendance.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_ATTENDANCE':
      return { ...state, attendance: state.attendance.filter(a => a.id !== action.payload) };

    case 'SET_HOLIDAYS':
      return { ...state, holidays: action.payload };
    case 'ADD_HOLIDAY':
      return { ...state, holidays: [...state.holidays, action.payload] };
    case 'UPDATE_HOLIDAY':
      return { ...state, holidays: state.holidays.map(h => h.id === action.payload.id ? action.payload : h) };
    case 'DELETE_HOLIDAY':
      return { ...state, holidays: state.holidays.filter(h => h.id !== action.payload) };

    case 'SET_COMPONENT_MAPPINGS':
      return { ...state, componentMappings: action.payload };
    case 'UPDATE_COMPONENT_MAPPING':
      return { ...state, componentMappings: state.componentMappings.map(m => m.internalKey === action.payload.internalKey ? action.payload : m) };

    case 'SET_CALCULATIONS':
      return { ...state, calculations: action.payload };
    case 'ADD_CALCULATION': {
      const exists = state.calculations.findIndex(
        c => c.employeeId === action.payload.employeeId &&
             c.month === action.payload.month &&
             c.year === action.payload.year
      );
      if (exists >= 0) {
        const updated = [...state.calculations];
        updated[exists] = action.payload;
        return { ...state, calculations: updated };
      }
      return { ...state, calculations: [...state.calculations, action.payload] };
    }
    case 'UPDATE_CALCULATION': {
      const p = action.payload;
      const idx = state.calculations.findIndex(
        c => c.employeeId === p.employeeId && c.month === p.month && c.year === p.year
      );
      if (idx >= 0) {
        const updated = [...state.calculations];
        updated[idx] = p;
        return { ...state, calculations: updated };
      }
      return { ...state, calculations: [...state.calculations, p] };
    }
    case 'DELETE_CALCULATION':
      return { ...state, calculations: state.calculations.filter(c =>
        !(c.employeeId === action.payload.employeeId && c.month === action.payload.month && c.year === action.payload.year)
      ) };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    api.getState()
      .then((data) => {
        const hasData = data.employees?.length || data.agreements?.length || data.attendance?.length || data.calculations?.length;
        if (hasData) {
          const firestoreAgreements = data.agreements || [];
          const firestoreIds = new Set(firestoreAgreements.map((a: { id: string }) => a.id));
          const missingDefaults = defaultAgreements().filter(d => !firestoreIds.has(d.id));
          const agreements = [...firestoreAgreements, ...missingDefaults];

          const holidays = data.holidays?.length ? data.holidays : defaultHolidays();
          const componentMappings = data.componentMappings?.length ? data.componentMappings : DEFAULT_COMPONENT_MAPPINGS;

          dispatch({
            type: 'LOAD_STATE',
            payload: {
              ...initialState,
              ...data,
              agreements,
              holidays,
              componentMappings,
            } as unknown as AppState
          });

          if (missingDefaults.length > 0) {
            for (const agr of missingDefaults) api.addAgreement(agr).catch(err => console.error('Failed to sync default agreement:', agr.id, err));
          }
          if (!data.holidays?.length) {
            api.setHolidays(holidays).catch(err => console.error('Failed to sync default holidays:', err));
          }
          if (!data.componentMappings?.length) {
            api.setComponentMappings(componentMappings).catch(err => console.error('Failed to sync default component mappings:', err));
          }
        } else {
         
          const saved = localStorage.getItem('attendance_system_v1');
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as AppState;
              const migrated = {
                ...initialState,
                ...parsed,
                componentMappings: parsed.componentMappings?.length ? parsed.componentMappings : DEFAULT_COMPONENT_MAPPINGS,
              };
              api.loadState(migrated).then(() => {
                dispatch({ type: 'LOAD_STATE', payload: migrated });
              });
              return;
            } catch { }
          }
       
          api.loadState(initialState);
        }
      })
      .catch(err => {
        console.error('API unavailable, falling back to localStorage', err);
        try {
          const saved = localStorage.getItem('attendance_system_v1');
          if (saved) {
            const parsed = JSON.parse(saved) as AppState;
            dispatch({
              type: 'LOAD_STATE',
              payload: { ...initialState, ...parsed,
                componentMappings: parsed.componentMappings?.length ? parsed.componentMappings : DEFAULT_COMPONENT_MAPPINGS }
            });
          }
 } catch { }
      });
  }, []);


  const saveToLocalStorage = useCallback((currentState: AppState) => {
    try {
      localStorage.setItem('attendance_system_v1', JSON.stringify(currentState));
 } catch { }
  }, []);


  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const syncDispatch = useCallback((action: Action) => {
    dispatch(action);

    const nextState = reducer(stateRef.current, action);
    stateRef.current = nextState;
    saveToLocalStorage(nextState);

    try {
      switch (action.type) {
        case 'ADD_EMPLOYEE':
          api.addEmployee(action.payload); break;
        case 'UPDATE_EMPLOYEE':
          api.updateEmployee(action.payload); break;
        case 'DELETE_EMPLOYEE':
          api.deleteEmployee(action.payload); break;
        case 'SET_EMPLOYEES':
          api.loadState({ employees: action.payload }); break;

        case 'ADD_AGREEMENT':
          api.addAgreement(action.payload).catch(e => console.error('Failed to add agreement:', e)); break;
        case 'UPDATE_AGREEMENT':
          api.updateAgreement(action.payload).catch(e => console.error('Failed to update agreement:', e)); break;
        case 'DELETE_AGREEMENT':
          api.deleteAgreement(action.payload).catch(e => console.error('Failed to delete agreement:', e)); break;

        case 'ADD_ATTENDANCE_BATCH':
          api.addAttendanceBatch(action.payload); break;
        case 'UPDATE_ATTENDANCE':
          api.updateAttendance(action.payload); break;
        case 'DELETE_ATTENDANCE':
          api.deleteAttendance(action.payload); break;

        case 'SET_HOLIDAYS':
          api.setHolidays(action.payload); break;
        case 'ADD_HOLIDAY':
          api.addHoliday(action.payload); break;
        case 'UPDATE_HOLIDAY':
          api.updateHoliday(action.payload); break;
        case 'DELETE_HOLIDAY':
          api.deleteHoliday(action.payload); break;

        case 'SET_COMPONENT_MAPPINGS':
          api.setComponentMappings(action.payload); break;
        case 'UPDATE_COMPONENT_MAPPING':
          api.updateComponentMapping(action.payload); break;

        case 'ADD_CALCULATION':
          api.addCalculation(action.payload).catch(err => { console.error('Failed to save calculation:', err); }); break;
        case 'UPDATE_CALCULATION':
          api.addCalculation(action.payload).catch(err => { console.error('Failed to save calculation:', err); }); break;
        case 'SET_CALCULATIONS':
          api.setCalculations(action.payload).catch(err => {
            console.error('Failed to sync calculations:', err);
          });
          break;
        case 'DELETE_CALCULATION':
          api.deleteCalculation(action.payload.employeeId, action.payload.year, action.payload.month).catch(err => {
            console.error('Failed to delete calculation:', err);
          });
          break;

        case 'LOAD_STATE':
          break;
      }
    } catch (err) {
      console.error('API sync error:', err);
    }
  }, [saveToLocalStorage]);

  return (
    <AppContext.Provider value={{ state, dispatch: syncDispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
