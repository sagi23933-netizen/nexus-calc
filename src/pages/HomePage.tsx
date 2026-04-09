import { useApp } from '../contexts/AppContext';
import {
  CheckCircle2, ArrowLeft, Zap,
  Users, ClipboardList, Calendar, Calculator,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const { state } = useApp();

  const stats = [
    { label: 'עובדים', value: state.employees.filter(e => e.isActive).length, icon: Users, theme: 'teal', to: '/employees' },
    { label: 'הסכמים', value: state.agreements.length, icon: ClipboardList, theme: 'violet', to: '/agreements' },
    { label: 'רשומות נוכחות', value: state.attendance.length, icon: Calendar, theme: 'amber', to: '/attendance' },
    { label: 'חישובים', value: state.calculations.length, icon: Calculator, theme: 'rose', to: '/calculation' },
  ];

  const steps = [
    { n: 1, title: 'הגדר הסכמים', desc: 'הגדר פרמטרים לכל סוג הסכם', to: '/agreements', done: state.agreements.length > 0 },
    { n: 2, title: 'הוסף עובדים', desc: 'ידנית או ייבוא מ-Excel', to: '/employees', done: state.employees.length > 0 },
    { n: 3, title: 'ייבא נוכחות', desc: 'קובץ Excel עם נתוני נוכחות חודשיים', to: '/attendance', done: state.attendance.length > 0 },
    { n: 4, title: 'הפעל חישוב', desc: 'בחר חודש והפעל את מנוע החישוב', to: '/calculation', done: state.calculations.length > 0 },
    { n: 5, title: 'יצא לשיקלולית', desc: 'הורד קובץ TAMAL-5.DAT', to: '/export', done: state.calculations.length > 0 },
  ];

  const completedSteps = steps.filter(s => s.done).length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const allDone = completedSteps === steps.length;
  const nothingDone = completedSteps === 0;

  return (
    <div className="page-shell">

      <section className="hp-stats anim-stagger mb-6">
        {stats.map(({ label, value, icon: Icon, theme, to }) => (
          <Link key={label} to={to} className={`hp-card hp-card--${theme}`}>
            <div className={`hp-card__stripe`} />
            <div className="hp-card__icon"><Icon size={20} /></div>
            <div className="hp-card__num anim-pop">{value}</div>
            <div className="hp-card__label">{label}</div>
          </Link>
        ))}
      </section>

      {state.employees.length === 0 && (
        <div className="surface-card empty-state mb-5">
          <div className="empty-state__icon"><Users size={32} /></div>
          <p className="empty-state__title">המערכת ריקה — עדיין אין עובדים</p>
          <p className="empty-state__desc">
            התחל בהוספת עובדים למערכת, ולאחר מכן הגדר הסכמי נוכחות כדי להפעיל את מנוע החישוב.
          </p>
          <div className="empty-state__action">
            <Link to="/employees" className="primary-btn">
              <Users size={16} /> התחל עכשיו
            </Link>
          </div>
        </div>
      )}

      <section className="hp-flow">
        <header className="hp-flow__head">
          <div>
            <h3 className="hp-flow__title">תהליך עבודה</h3>
            <p className="hp-flow__sub">
              {nothingDone
                ? 'התחל מהשלב הראשון להפעלת המערכת'
                : allDone
                ? 'כל השלבים הושלמו — המערכת מוכנה'
                : `${completedSteps} מתוך ${steps.length} שלבים הושלמו`}
            </p>
          </div>
          <div className="hp-flow__bar-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% הושלמו`}>
            <div className="hp-flow__bar">
              <div className="hp-flow__bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="hp-flow__pct">{progress}%</span>
          </div>
        </header>

        {nothingDone && (
          <div className="flex items-start gap-3 mx-4 my-3 px-3 py-2.5 rounded-lg border border-blue-100 bg-blue-50">
            <Zap size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              ברוך הבא למערכת חישוב השכר. עקוב אחרי השלבים הבאים לפי הסדר כדי לבצע את החישוב הראשון שלך.
            </p>
          </div>
        )}

        <ol className="hp-flow__steps">
          {steps.map(({ n, title, desc, to, done }, i) => (
            <li key={n} className="hp-flow__item">
              <Link to={to} className="hp-flow__link group">
                <div className="hp-flow__rail">
                  <span className={`hp-flow__dot ${done ? 'hp-flow__dot--done' : ''}`}>
                    {done ? <CheckCircle2 size={15} /> : n}
                  </span>
                  {i < steps.length - 1 && (
                    <span className={`hp-flow__wire ${done ? 'hp-flow__wire--done' : ''}`} />
                  )}
                </div>
                <div className="hp-flow__body">
                  <span className={`hp-flow__name ${done ? 'line-through opacity-60' : ''}`}>{title}</span>
                  <span className="hp-flow__desc">{desc}</span>
                </div>
                <ArrowLeft size={14} className="hp-flow__go" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
