import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, PlusSquare, RefreshCw, Share, Smartphone, WifiOff, X, Zap, MapPin } from 'lucide-react';
import { applyUpdate, promptInstall, usePwa } from '../lib/pwa';
import { Button, Modal, cx } from './ui';

const DISMISS_KEY = 'bd_install_dismissed';
const DISMISS_DAYS = 10;

function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

function IosInstructions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    { icon: <Share size={20} />, text: 'לוחצים על כפתור השיתוף בסרגל של Safari' },
    { icon: <PlusSquare size={20} />, text: 'גוללים ובוחרים "הוספה למסך הבית"' },
    { icon: <Smartphone size={20} />, text: 'מאשרים "הוסף" — והאייקון של בולדיל מופיע במסך הבית' },
  ];
  return (
    <Modal open={open} onClose={onClose} title="התקנת בולדיל באייפון" size="sm">
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">{s.icon}</span>
            <span className="text-[15px] font-semibold">
              {i + 1}. {s.text}
            </span>
          </div>
        ))}
        <p className="pt-1 text-center text-xs text-ink-500">ההתקנה זמינה מ-Safari בלבד. אחרי ההתקנה האפליקציה נפתחת במסך מלא, כמו כל אפליקציה.</p>
      </div>
    </Modal>
  );
}

/** "Install app" button for menus/footers — renders nothing when installing isn't possible. */
export function InstallButton({ className, label = 'הורדת האפליקציה' }: { className?: string; label?: string }) {
  const pwa = usePwa();
  const [ios, setIos] = useState(false);
  if (pwa.standalone || pwa.installed || (!pwa.canInstall && !pwa.ios)) return null;
  return (
    <>
      <button className={className} onClick={() => (pwa.canInstall ? promptInstall() : setIos(true))}>
        <Download size={16} /> {label}
      </button>
      <IosInstructions open={ios} onClose={() => setIos(false)} />
    </>
  );
}

/** Global PWA layer: install banner, iOS instructions, update-ready toast and offline indicator. */
export function PwaLayer() {
  const pwa = usePwa();
  const loc = useLocation();
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const isAdmin = loc.pathname.startsWith('/admin');
  const inDashboard = loc.pathname.startsWith('/dashboard');
  const eligible = !isAdmin && !pwa.standalone && !pwa.installed && (pwa.canInstall || pwa.ios);

  useEffect(() => {
    if (!eligible || dismissedRecently()) return;
    const t = setTimeout(() => setShow(true), 9000);
    return () => clearTimeout(t);
  }, [eligible]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (pwa.canInstall) {
      const r = await promptInstall();
      if (r !== 'unavailable') setShow(false);
    } else setIos(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && eligible && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className={cx('fixed inset-x-3 z-[80] mx-auto max-w-md sm:inset-x-auto sm:right-6', inDashboard ? 'bottom-24 lg:bottom-6' : 'bottom-4')}
            role="dialog"
            aria-label="התקנת האפליקציה"
          >
            <div className="relative overflow-hidden rounded-[26px] bg-leaf-950 p-4 text-white shadow-deep ring-1 ring-white/10">
              <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(400px 160px at 100% 0%, rgba(140,193,10,.4), transparent 70%), radial-gradient(300px 140px at 0% 100%, rgba(140,63,24,.5), transparent 70%)' }} />
              <button onClick={dismiss} className="absolute left-3 top-3 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="סגירה">
                <X size={18} />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="perspective shrink-0">
                  <img src="/icon-192.png" alt="" className="h-16 w-16 animate-floaty drop-shadow-[0_12px_18px_rgba(0,0,0,.5)]" style={{ transform: 'rotateY(-14deg) rotateX(8deg)' }} />
                </div>
                <div className="min-w-0 pl-6">
                  <div className="text-lg font-black leading-tight">בולדיל כאפליקציה בטלפון</div>
                  <div className="mt-0.5 text-sm text-ink-300">{inDashboard ? 'מפרסמים דיל בלחיצה ישר ממסך הבית' : 'הדילים של העיר שלך במרחק לחיצה'}</div>
                </div>
              </div>
              <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
                <span className="flex items-center gap-1"><Zap size={13} className="text-lime-400" /> פתיחה מהירה</span>
                <span className="flex items-center gap-1"><MapPin size={13} className="text-lime-400" /> העיר שלך שמורה</span>
                <span className="flex items-center gap-1"><WifiOff size={13} className="text-lime-400" /> עובד גם בלי רשת</span>
              </div>
              <div className="relative mt-4 flex gap-2">
                <Button onClick={install} className="flex-1" icon={<Download size={18} />}>
                  התקנה חינם
                </Button>
                <Button variant="ghost" onClick={dismiss} className="text-white hover:bg-white/10">
                  לא עכשיו
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pwa.updateReady && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="fixed inset-x-0 top-3 z-[110] flex justify-center px-3">
            <div className="flex items-center gap-3 rounded-2xl bg-leaf-950/95 px-4 py-2.5 text-sm font-semibold text-white shadow-deep ring-1 ring-white/10 backdrop-blur">
              <RefreshCw size={16} className="text-lime-400" />
              גרסה חדשה של בולדיל זמינה
              <button onClick={applyUpdate} className="rounded-xl bg-lime-500 px-3 py-1 font-bold text-leaf-950 hover:bg-lime-400">
                עדכון
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!pwa.online && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className={cx('fixed inset-x-0 z-[85] flex justify-center px-3', inDashboard ? 'bottom-24 lg:bottom-4' : 'bottom-4')}>
            <div className="flex items-center gap-2 rounded-full bg-ink-900/95 px-4 py-2 text-sm font-semibold text-white shadow-deep">
              <WifiOff size={16} className="text-amber-300" /> אין חיבור לאינטרנט — מוצגים הנתונים האחרונים שנשמרו
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IosInstructions open={ios} onClose={() => setIos(false)} />
    </>
  );
}
