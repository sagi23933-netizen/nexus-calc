import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BellRing, CalendarClock, CreditCard, Gift, LogOut } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { BusinessInfo, Package } from '../lib/types';
import { date, daysLeft } from '../lib/format';
import { BrandLogo } from '../shared/Brand';
import { PackageCard } from '../shared/PackageCard';
import { PageLoader } from '../shared/ui';
import { useToast } from '../shared/Toast';

/** Mandatory step after sign-up: pick the package that continues after the free trial (no card needed now). */
export default function ChoosePackagePage() {
  const { me, setBusiness, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = me.business;

  useEffect(() => {
    api
      .get<{ packages: Package[] }>('/public/packages')
      .then((r) => setPackages(r.packages))
      .catch((e) => setError(errMsg(e)));
  }, []);

  const choose = async (pkg: Package) => {
    setSaving(pkg.id);
    setError(null);
    try {
      const res = await api.post<{ business: BusinessInfo }>('/auth/choose-package', { packageId: pkg.id });
      setBusiness(res.business);
      toast(`בחרת בחבילת ${pkg.name}! תקופת הניסיון התחילה`);
      navigate('/dashboard?welcome=1');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(null);
    }
  };

  if (!b) return <PageLoader />;
  const trialEnd = b.trial.ends_at;

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(900px 500px at 50% -10%, rgba(163,213,32,.3), transparent 70%), #fbfaf3' }}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <BrandLogo height={44} to={null} />
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="btn btn-ghost btn-sm"
          >
            <LogOut size={16} /> יציאה
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-3xl text-center">
          <span className="chip bg-lime-500 text-leaf-950 shadow-3d">
            <Gift size={14} /> שלב אחרון
          </span>
          <h1 className="mt-4 font-display text-4xl leading-tight text-leaf-900 sm:text-5xl">{b.name}, באיזו חבילה ממשיכים?</h1>
          <p className="mt-3 text-lg text-ink-600">
            החשבון פתוח ותקופת הניסיון כבר רצה. בחרו את החבילה שתופעל בסיום הניסיון — <b>בלי כרטיס אשראי עכשיו</b>, ואפשר להחליף בכל רגע.
          </p>
        </motion.div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            { icon: <CalendarClock size={20} />, title: `${b.trial.days} ימי ניסיון`, text: trialEnd ? `עד ${date(trialEnd)} (${daysLeft(trialEnd)} ימים)` : '' },
            { icon: <Gift size={20} />, title: 'טוקן אחד בכל יום', text: 'פרסום דיל אחד ביום בחינם' },
            { icon: <BellRing size={20} />, title: 'תזכורת יום לפני', text: 'נזכיר לכם לפני שהניסיון נגמר' },
          ].map((x) => (
            <div key={x.title} className="card-3d flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">{x.icon}</span>
              <div>
                <div className="font-bold">{x.title}</div>
                <div className="text-sm text-ink-500">{x.text}</div>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mx-auto mt-6 max-w-xl rounded-xl bg-red-50 px-4 py-3 text-center text-red-700">{error}</p>}

        <div className="mt-12 grid items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
          {!packages && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-[520px] rounded-[30px]" />)}
          {packages?.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="pt-4">
              <PackageCard pkg={p} onSelect={() => choose(p)} ctaLabel={saving === p.id ? 'שומר…' : 'בחירה והמשך'} ctaLoading={saving === p.id} ctaDisabled={saving !== null} selected={b.package?.id === p.id} />
            </motion.div>
          ))}
        </div>

        <p className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-ink-500">
          <CreditCard size={16} /> בסיום תקופת הניסיון יש להשלים תשלום על החבילה שנבחרה. ללא תשלום החשבון ייחסם אוטומטית (תישלח תזכורת יום לפני).
        </p>
      </div>
    </div>
  );
}
