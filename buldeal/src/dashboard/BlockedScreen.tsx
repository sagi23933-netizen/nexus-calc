import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Headphones, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import type { BusinessInfo, Package } from '../lib/types';
import { BLOCK_REASON } from '../lib/format';
import { PackageCard } from '../shared/PackageCard';
import { CheckoutModal } from '../shared/CheckoutModal';
import { Skeleton } from '../shared/ui';

interface BillingData {
  subscriptions: Package[];
  billing: { provider: string };
}

/** Full-page lock shown when the account is blocked/suspended — with a path back via payment. */
export function BlockedScreen({ business }: { business: BusinessInfo }) {
  const { setBusiness } = useAuth();
  const { data } = useApi<BillingData>(business.status === 'blocked' ? '/business/billing' : null);
  const [pkg, setPkg] = useState<Package | null>(null);
  const suspended = business.status === 'suspended';
  const reason = BLOCK_REASON[business.blocked_reason] || business.blocked_reason || (suspended ? 'החשבון הושעה' : 'החשבון אינו פעיל');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-[32px] p-8 text-center text-white shadow-deep sm:p-12" style={{ background: 'linear-gradient(150deg,#08200f,#1e5c2e 55%,#3f8f2a)' }}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-wood-500/25 blur-3xl" />
        <motion.div
          initial={{ rotateY: -30, scale: 0.8, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14 }}
          style={{ transformPerspective: 800 }}
          className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] text-leaf-950 shadow-3d"
        >
          <div className="absolute inset-0 rounded-[28px]" style={{ background: suspended ? 'linear-gradient(160deg,#fecaca,#ef4444)' : 'linear-gradient(160deg,#e8ff9a,#8cc10a 60%,#6f9e0b)' }} />
          {suspended ? <ShieldAlert size={46} className="relative" /> : <Lock size={46} className="relative" />}
        </motion.div>
        <h1 className="relative text-3xl font-black sm:text-4xl">{suspended ? 'החשבון מושעה' : 'החשבון חסום כרגע'}</h1>
        <p className="relative mx-auto mt-3 max-w-xl text-lg text-lime-100/90">{reason}</p>
        <p className="relative mx-auto mt-2 max-w-xl text-sm text-white/70">
          {suspended
            ? 'לבירור ולהחזרת החשבון לפעילות פנו לצוות התמיכה דרך חלון הצ׳אט.'
            : 'הדילים שלך הוסרו מהאתר, אבל כל הנתונים שמורים. בחרו חבילה והשלימו תשלום — והחשבון יחזור לפעול מיד.'}
        </p>
        {suspended && (
          <p className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
            <Headphones size={16} /> לחצו על כפתור התמיכה בפינת המסך
          </p>
        )}
      </div>

      {!suspended && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-black text-ink-900">בחרו חבילה כדי לחזור לפרסם</h2>
          {!data ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[460px] rounded-[30px]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {data.subscriptions.map((p) => (
                <PackageCard key={p.id} pkg={p} current={business.package?.id === p.id} onSelect={() => setPkg(p)} ctaLabel={business.package?.id === p.id ? 'תשלום וחידוש' : 'בחירה ותשלום'} />
              ))}
            </div>
          )}
        </div>
      )}

      <CheckoutModal open={!!pkg} onClose={() => setPkg(null)} pkg={pkg} business={business} demo={data?.billing.provider === 'demo'} onDone={(b) => setBusiness(b)} />
    </div>
  );
}
