import { NavLink } from 'react-router-dom';
import {
  Users, Calculator, Download,
  Settings, Calendar, ClipboardList, Home, Menu, X, BarChart3
} from 'lucide-react';
import { useState } from 'react';

const preloadMap: Record<string, () => void> = {
  '/employees': () => import('../../pages/EmployeesPage'),
  '/agreements': () => import('../../pages/AgreementsPage'),
  '/attendance': () => import('../../pages/AttendancePage'),
  '/calculation': () => import('../../pages/CalculationPage'),
  '/export': () => import('../../pages/ExportPage'),
  '/reports': () => import('../../pages/ReportsPage'),
  '/settings': () => import('../../pages/SettingsPage'),
};

const navItems = [
  { to: '/', icon: Home, label: 'דף הבית' },
  { to: '/employees', icon: Users, label: 'עובדים' },
  { to: '/agreements', icon: ClipboardList, label: 'הסכמים' },
  { to: '/attendance', icon: Calendar, label: 'נוכחות' },
  { to: '/calculation', icon: Calculator, label: 'חישוב' },
  { to: '/export', icon: Download, label: 'יצוא' },
  { to: '/reports', icon: BarChart3, label: 'דוחות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export default function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <nav className="top-nav__links">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => preloadMap[to]?.()}
              className={({ isActive }) =>
                `top-nav__link ${isActive ? 'top-nav__link--active' : ''}`
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="top-nav__logo-area">
            <img src="/nexus_logo.png" alt="Nexus Group" className="top-nav__logo" />
          </div>
        </nav>

        <button
          type="button"
          className="top-nav__mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="תפריט"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="top-nav__mobile">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => preloadMap[to]?.()}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `top-nav__mobile-link ${isActive ? 'top-nav__mobile-link--active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
