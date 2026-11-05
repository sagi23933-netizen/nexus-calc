import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { PageLoader } from './shared/ui';

// ---- public site ----
import SiteLayout from './site/SiteLayout';
import HomePage from './site/HomePage';
const DealPage = lazy(() => import('./site/DealPage'));
const BusinessPage = lazy(() => import('./site/BusinessPage'));
const PricingPage = lazy(() => import('./site/PricingPage'));
const LoginPage = lazy(() => import('./site/LoginPage'));
const RegisterPage = lazy(() => import('./site/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./site/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./site/ResetPasswordPage'));
const ChoosePackagePage = lazy(() => import('./site/ChoosePackagePage'));
const NotFound = lazy(() => import('./site/NotFound'));

// ---- business dashboard ----
const DashboardLayout = lazy(() => import('./dashboard/DashboardLayout'));
const DOverview = lazy(() => import('./dashboard/OverviewPage'));
const DNewDeal = lazy(() => import('./dashboard/NewDealPage'));
const DDeals = lazy(() => import('./dashboard/DealsPage'));
const DStats = lazy(() => import('./dashboard/StatsPage'));
const DBilling = lazy(() => import('./dashboard/BillingPage'));
const DProfile = lazy(() => import('./dashboard/ProfilePage'));
const DNotifications = lazy(() => import('./dashboard/NotificationsPage'));

// ---- super admin ----
const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const ADashboard = lazy(() => import('./admin/DashboardPage'));
const ABusinesses = lazy(() => import('./admin/BusinessesPage'));
const ABusinessDetail = lazy(() => import('./admin/BusinessDetailPage'));
const ADeals = lazy(() => import('./admin/DealsPage'));
const APackages = lazy(() => import('./admin/PackagesStudio'));
const ALookup = lazy(() => import('./admin/LookupPage'));
const AAnalytics = lazy(() => import('./admin/AnalyticsPage'));
const AAI = lazy(() => import('./admin/AIModelsPage'));
const APayments = lazy(() => import('./admin/PaymentsPage'));
const ASupport = lazy(() => import('./admin/SupportPage'));
const ANotifications = lazy(() => import('./admin/NotificationsPage'));
const ASettings = lazy(() => import('./admin/SettingsPage'));
const AAdmins = lazy(() => import('./admin/AdminsPage'));
const AAudit = lazy(() => import('./admin/AuditPage'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <img src="/icon-192.png" alt="" className="h-20 w-20" />
          <h1 className="text-2xl font-black">אופס, משהו השתבש</h1>
          <p className="max-w-md text-ink-500">{this.state.error.message}</p>
          <button className="btn btn-lime" onClick={() => window.location.reload()}>
            טעינה מחדש
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Route guard by role. Business owners without a package are sent to choose one first. */
function RequireRole({ role, children }: { role: 'admin' | 'business'; children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader dark={role === 'admin'} />;
  if (!me.user || me.user.role !== role) {
    return <Navigate to={role === 'admin' ? '/admin/login' : `/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  if (role === 'business' && me.business?.needs_package && !loc.pathname.startsWith('/choose-package')) {
    return <Navigate to="/choose-package" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="deal/:id" element={<DealPage />} />
            <Route path="b/:slug" element={<BusinessPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route
            path="choose-package"
            element={
              <RequireRole role="business">
                <ChoosePackagePage />
              </RequireRole>
            }
          />

          <Route
            path="dashboard"
            element={
              <RequireRole role="business">
                <DashboardLayout />
              </RequireRole>
            }
          >
            <Route index element={<DOverview />} />
            <Route path="new" element={<DNewDeal />} />
            <Route path="deals" element={<DDeals />} />
            <Route path="stats" element={<DStats />} />
            <Route path="billing" element={<DBilling />} />
            <Route path="profile" element={<DProfile />} />
            <Route path="notifications" element={<DNotifications />} />
          </Route>

          <Route path="admin/login" element={<AdminLogin />} />
          <Route
            path="admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<ADashboard />} />
            <Route path="businesses" element={<ABusinesses />} />
            <Route path="businesses/:id" element={<ABusinessDetail />} />
            <Route path="deals" element={<ADeals />} />
            <Route path="packages" element={<APackages />} />
            <Route path="categories" element={<ALookup kind="categories" />} />
            <Route path="cities" element={<ALookup kind="cities" />} />
            <Route path="analytics" element={<AAnalytics />} />
            <Route path="ai" element={<AAI />} />
            <Route path="payments" element={<APayments />} />
            <Route path="support" element={<ASupport />} />
            <Route path="notifications" element={<ANotifications />} />
            <Route path="settings" element={<ASettings />} />
            <Route path="admins" element={<AAdmins />} />
            <Route path="audit" element={<AAudit />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
