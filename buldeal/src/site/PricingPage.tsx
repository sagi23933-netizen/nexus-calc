import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Clock, Coins, Gift, Sparkles, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Package } from '../lib/types';
import { PackageCard } from '../shared/PackageCard';
import { Tabs, cx } from '../shared/ui';
import { useSite } from './siteContext';

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right font-bold">
        {q}
        <ChevronDown size={18} className={cx('shrink-0 transition', open && 'rotate-180')} />
      </button>
      {open && <p className="px-5 pb-5 leading-relaxed text-ink-600">{a}</p>}
    </div>
  );
}

export default function PricingPage() {
  const { boot } = useSite();
  const [kind, setKind] = useState<'subscription' | 'tokens'>('subscription');
  const [packages, setPackages] = useState<Package[] | null>(null);

  useEffect(() => {
    setPackages(null);
    api.get<{ packages: Package[] }>(`/public/packages?kind=${kind}`).then((r) => setPackages(r.packages)).catch(() => setPackages([]));
  }, [kind]);

  const s = boot?.settings;
  const trialDays = s?.trial.siteDays ?? 3;
  const maxH = s?.deals.maxHours ?? 48;
  const minH = s?.deals.minHours ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="chip bg-lime-500 text-leaf-950 shadow-3d">
          <Sparkles size={14} /> חבילות לעסקים
        </span>
        <h1 className="mt-4 font-display text-5xl leading-tight text-leaf-900">פשוט ושקוף: טוקן אחד = דיל אחד</h1>
        <p className="mt-4 text-lg text-ink-600">
          כל פרסום של דיל עולה טוקן אחד. אתם קובעים כמה זמן הדיל באוויר — משעה ועד {maxH} שעות — ובסוף הוא נמחק אוטומטית. מתחילים ב-{trialDays} ימי ניסיון חינם.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: <Gift />, t: `${trialDays} ימי ניסיון`, d: `טוקן פרסום אחד בכל יום, בלי כרטיס אשראי` },
          { icon: <Clock />, t: `${minH}–${maxH} שעות לדיל`, d: 'אתם בוחרים את זמן הפרסום, והמחיקה אוטומטית' },
          { icon: <Wand2 />, t: 'עיצוב AI', d: 'כל כרטיס מעוצב לפי הקטגוריה והנתונים של הדיל' },
        ].map((x, i) => (
          <motion.div key={x.t} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card-3d flex items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">{x.icon}</span>
            <div>
              <div className="text-lg font-bold">{x.t}</div>
              <div className="text-sm text-ink-500">{x.d}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Tabs
          value={kind}
          onChange={setKind}
          tabs={[
            { value: 'subscription', label: 'מנויים חודשיים' },
            { value: 'tokens', label: (<span className="flex items-center gap-1.5"><Coins size={15} /> חבילות טוקנים</span>) },
          ]}
        />
      </div>

      <div className="mt-10 grid items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
        {!packages && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-[520px] rounded-[30px]" />)}
        {packages?.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="pt-4">
            <PackageCard pkg={p} footer={null} />
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link to="/register" className="btn btn-lime btn-lg">
          מתחילים {trialDays} ימי ניסיון חינם
        </Link>
        <p className="mt-3 text-sm text-ink-500">המחירים כוללים מע״מ · ניתן להחליף חבילה בכל עת</p>
      </div>

      <div className="mx-auto mt-16 max-w-3xl space-y-3">
        <h2 className="mb-4 text-center text-2xl font-black">שאלות נפוצות</h2>
        <Faq q="מה זה טוקן?" a="טוקן הוא קרדיט לפרסום דיל אחד. כל פרסום מוריד טוקן אחד מהיתרה, בלי קשר למשך הדיל." />
        <Faq q="כמה זמן הדיל מופיע באתר?" a={`אתם בוחרים בין ${minH} ל-${maxH} שעות. בסוף הזמן הדיל נמחק אוטומטית מהאתר, ואתם מקבלים סיכום צפיות ולחיצות.`} />
        <Faq q="מה קורה בסוף תקופת הניסיון?" a="יום לפני הסיום נשלחת תזכורת. אם לא בוצע תשלום על החבילה שבחרתם, החשבון נחסם עד להסדרת התשלום — כל הנתונים נשמרים." />
        <Faq q="צריך ח.פ כדי להירשם?" a="לא. ההרשמה פתוחה לכל עסק, בלי מספר עוסק וללא כרטיס אשראי בתקופת הניסיון." />
        <Faq q="איך עובד העיצוב ב-AI?" a="אחרי לחיצה על 'פרסם', ה-AI מקבל את פרטי הדיל והקטגוריה של העסק ומעצב כרטיס ייחודי — צבעים, כותרת, אווירה. הלוגו, המחירים ופרטי ההתקשרות מוצגים תמיד." />
      </div>
    </div>
  );
}
