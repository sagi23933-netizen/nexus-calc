import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { BusinessInfo, CardInput, Package } from '../lib/types';
import { money, periodLabel } from '../lib/format';
import { CardForm, emptyCard, validateCardInput } from './CardForm';
import { Button, Modal, Switch } from './ui';
import { useToast } from './Toast';

/** Payment flow for a subscription or token pack. */
export function CheckoutModal({ open, onClose, pkg, business, onDone, demo }: {
  open: boolean;
  onClose: () => void;
  pkg: Package | null;
  business: BusinessInfo;
  onDone: (b: BusinessInfo) => void;
  demo?: boolean;
}) {
  const toast = useToast();
  const [card, setCard] = useState<CardInput>(emptyCard);
  const [useSaved, setUseSaved] = useState(!!business.card);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!pkg) return null;
  const isTokens = pkg.kind === 'tokens';

  const pay = async () => {
    setError(null);
    if (!useSaved) {
      const v = validateCardInput(card);
      if (v) return setError(v);
    }
    setLoading(true);
    try {
      const res = await api.post<{ business: BusinessInfo }>(isTokens ? '/business/billing/tokens' : '/business/billing/subscribe', {
        packageId: pkg.id,
        useSavedCard: useSaved,
        card: useSaved ? undefined : { ...card, number: card.number.replace(/\s/g, '') },
      });
      setDone(true);
      onDone(res.business);
      toast(isTokens ? `${pkg.tokens} טוקנים נוספו לחשבון!` : `חבילת ${pkg.name} הופעלה!`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setDone(false);
    setError(null);
    setCard(emptyCard);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={done ? undefined : isTokens ? `רכישת ${pkg.name}` : `תשלום — חבילת ${pkg.name}`} size="lg">
      {done ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-lime-100 text-lime-600 shadow-glow">
            <CheckCircle2 size={44} />
          </div>
          <h3 className="text-2xl font-black">התשלום התקבל בהצלחה!</h3>
          <p className="mt-2 text-ink-600">{isTokens ? `${pkg.tokens} טוקנים נוספו ליתרה שלך.` : `חבילת ${pkg.name} פעילה. ${pkg.tokens} טוקנים נוספו לחשבון.`}</p>
          <Button className="mt-6" onClick={close}>
            מעולה, ממשיכים
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-l from-lime-50 to-white p-4 ring-1 ring-lime-200">
            <div>
              <div className="font-bold">{pkg.name}</div>
              <div className="text-sm text-ink-500">
                {pkg.tokens} טוקנים · {periodLabel(pkg.period)}
                {!isTokens && business.status === 'trial' && ' · החיוב הבא בתום התקופה'}
              </div>
            </div>
            <div className="text-left">
              <div className="font-display text-3xl text-leaf-700">{money(pkg.price)}</div>
              <div className="text-[11px] text-ink-500">כולל מע״מ</div>
            </div>
          </div>
          {!isTokens && business.status === 'trial' && (
            <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
              תשלום עכשיו לא מקצר את תקופת הניסיון: תקופת החבילה תתחיל בסיום הניסיון, והטוקנים של החבילה נוספים כבר עכשיו.
            </p>
          )}
          {business.card && (
            <Switch
              checked={useSaved}
              onChange={setUseSaved}
              label={`שימוש בכרטיס השמור (${business.card.brand} •••• ${business.card.last4})`}
              description="ניתן לבטל ולהזין כרטיס אחר"
            />
          )}
          {!useSaved && <CardForm value={card} onChange={setCard} demo={demo} />}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <ShieldCheck size={15} className="text-lime-600" /> תשלום מאובטח · חשבונית נשלחת אוטומטית
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>
                ביטול
              </Button>
              <Button onClick={pay} loading={loading}>
                תשלום {money(pkg.price)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
