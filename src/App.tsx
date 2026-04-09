import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import TopNav from './components/layout/TopNav';
import SplashScreen from './components/SplashScreen';

const HomePage = lazy(() => import('./pages/HomePage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const AgreementsPage = lazy(() => import('./pages/AgreementsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const CalculationPage = lazy(() => import('./pages/CalculationPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">שגיאה במערכת</h1>
            <p className="text-gray-500 mb-4">{this.state.error?.message}</p>
            <button type="button" onClick={() => window.location.reload()} className="primary-btn">
              טען מחדש
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const pageTitles: Record<string, string> = {
  '/': 'מרכז בקרה',
  '/employees': 'ניהול עובדים',
  '/agreements': 'הסכמים',
  '/attendance': 'נוכחות',
  '/calculation': 'חישוב שעות',
  '/export': 'יצוא שיקלולית',
  '/reports': 'דוחות בקרה',
  '/settings': 'הגדרות',
};

function PageTransition() {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-transition');
    void el.offsetWidth;
    el.classList.add('page-transition');
  }, [location.pathname]);

  return (
    <div ref={ref} className="page-transition">
      <Outlet />
    </div>
  );
}

function Layout() {
  const location = useLocation();
  const title = Object.prototype.hasOwnProperty.call(pageTitles, location.pathname)
    ? pageTitles[location.pathname]
    : Object.entries(pageTitles)
        .filter(([key]) => location.pathname.startsWith(key))
        .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'מרכז בקרה';

  return (
    <div className="app-shell">
      <TopNav />
      <main className="main-content">
        <div className="main-content__inner">
          <div className="page-header-bar">
            <h1 className="page-title">{title}</h1>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          }>
            <PageTransition />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
    <ErrorBoundary>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/agreements" element={<AgreementsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/calculation" element={<CalculationPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={
              <div className="flex-1 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-2">404</h1>
                  <p className="text-gray-500 mb-4">הדף לא נמצא</p>
                </div>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
    </ErrorBoundary>
  );
}
