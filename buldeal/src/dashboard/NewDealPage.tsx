import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, Clock, Coins, ExternalLink, ImagePlus, LayoutGrid, MapPin, Navigation, Pencil, Percent, Phone, Plus, Rocket, Sparkles,
  Tag, Trash2, Wand2, Zap, CircleAlert,
} from 'lucide-react';
import { api, ApiError, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { BusinessInfo, Deal } from '../lib/types';
import { dateTime, durationLabel, money } from '../lib/format';
import { DealCard, FALLBACK_DESIGN } from '../shared/DealCard';
import { Button, Field, Input, Modal, Switch, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { DEAL_DEFAULTS, useBootstrap } from './kit';
import { AiDesigning, Confetti } from './AiDesigning';

interface Form {
  title: string;
  description: string;
  image_url: string;
  original_price: string;
  discount_percent: number;
  duration_hours: number;
  schedule: boolean;
  starts_at: string;
  show_phone: boolean;
  show_address: boolean;
  show_waze: boolean;
}

const STEPS = [
  { key: 'details', label: 'מה הדיל?', icon: Tag },
  { key: 'price', label: 'מחיר והנחה', icon: Percent },
  { key: 'time', label: 'זמן פרסום', icon: Clock },
  { key: 'contact', label: 'פרטים ופרסום', icon: Rocket },
] as const;

const TITLE_IDEAS: Record<string, string[]> = {
  food: ['ארוחה זוגית במחיר מיוחד', '1+1 על כל המנות העיקריות', 'מגש משפחתי + שתייה'],
  cafe: ['קפה + מאפה במחיר בזק', 'ארוחת בוקר זוגית', 'כל העוגות ב-1+1'],
  fashion: ['כל הקולקציה החדשה', 'פריט שני ב-50%', 'סוף עונה על הכל'],
  beauty: ['מניקור + פדיקור', 'טיפול פנים מפנק', 'תספורת + פן'],
  sport: ['חודש אימונים ללא הגבלה', 'כרטיסייה ל-10 אימונים', 'אימון ניסיון + ייעוץ'],
  default: ['מבצע בזק לזמן מוגבל', 'הנחה מיוחדת לגולשי בולדיל', '1+1 על המוצרים הנבחרים'],
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewDealPage() {
  const { me, setBusiness } = useAuth();
  const boot = useBootstrap();
  const navigate = useNavigate();
  const toast = useToast();
  const ds = boot?.settings.deals ?? DEAL_DEFAULTS;
  const b = me.business!;
  const [mountedAt] = useState(() => Date.now());

  const initial: Form = {
    title: '',
    description: '',
    image_url: '',
    original_price: '',
    discount_percent: 30,
    duration_hours: Math.min(ds.maxHours, Math.max(ds.minHours, 6)),
    schedule: false,
    starts_at: toLocalInput(new Date(mountedAt + 3600_000)),
    show_phone: true,
    show_address: true,
    show_waze: true,
  };
  const [form, setForm] = useState<Form>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ deal: Deal; warning?: string; designSource: string } | null>(null);
  const [redesigning, setRedesigning] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [blocker, setBlocker] = useState<{ code: string; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const original = Number(form.original_price) || 0;
  const finalPrice = Math.round(original * (1 - form.discount_percent / 100) * 100) / 100;
  const wazeUrl = b.waze_url || b.waze_auto;

  const previewDeal: Deal = useMemo(() => {
    const start = form.schedule ? new Date(form.starts_at) : new Date();
    const startIso = Number.isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString();
    return {
      id: 0,
      title: form.title || 'כאן תופיע כותרת הדיל',
      description: form.description,
      original_price: original || 100,
      discount_percent: form.discount_percent,
      final_price: original ? finalPrice : 100 * (1 - form.discount_percent / 100),
      image_url: form.image_url,
      duration_hours: form.duration_hours,
      starts_at: startIso,
      expires_at: new Date(new Date(startIso).getTime() + form.duration_hours * 3600_000).toISOString(),
      status: 'active',
      featured: false,
      design: { ...FALLBACK_DESIGN, headline: `${Math.round(form.discount_percent)}% הנחה!`, badge: 'תצוגה מקדימה' },
      design_source: 'builtin',
      business: {
        id: b.id,
        name: b.name,
        slug: b.slug,
        logo_url: b.logo_url,
        phone: form.show_phone ? b.phone : '',
        whatsapp: form.show_phone ? b.whatsapp : '',
        address: form.show_address ? b.address : '',
        waze_url: form.show_waze ? wazeUrl : '',
      },
      category: b.category ? { ...b.category, icon: 'Tag', color: '#8cc10a' } : null,
      city: b.city,
    };
  }, [form, original, finalPrice, b, wazeUrl]);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.title.trim().length < 2) e.title = 'כתבו כותרת קצרה לדיל';
      if (ds.requireImage && !form.image_url) e.image_url = 'יש להעלות תמונה';
    }
    if (s === 1) {
      if (!original || original < 1) e.original_price = 'הזינו את המחיר המקורי';
      if (form.discount_percent < 1 || form.discount_percent > ds.maxDiscount) e.discount_percent = `הנחה בין 1% ל-${ds.maxDiscount}%`;
    }
    if (s === 2 && form.schedule) {
      const t = new Date(form.starts_at).getTime();
      if (Number.isNaN(t)) e.starts_at = 'מועד לא תקין';
      else if (t > Date.now() + 7 * 86400_000) e.starts_at = 'ניתן לתזמן עד 7 ימים מראש';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const upload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) return toast('הקובץ גדול מדי (עד 4MB)', 'error');
    setUploading(true);
    try {
      const res = await api.upload<{ url: string }>('/business/uploads/image', file);
      set('image_url', res.url);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    for (let s = 0; s < 3; s++) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    setPublishing(true);
    const started = Date.now();
    try {
      const res = await api.post<{ deal: Deal; designSource: string; warning?: string; business: BusinessInfo }>('/business/deals', {
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.image_url,
        original_price: original,
        discount_percent: form.discount_percent,
        duration_hours: form.duration_hours,
        starts_at: form.schedule ? new Date(form.starts_at).toISOString() : undefined,
        show_phone: form.show_phone,
        show_address: form.show_address,
        show_waze: form.show_waze,
      });
      const wait = Math.max(0, 3200 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setBusiness(res.business);
      setResult({ deal: res.deal, warning: res.warning, designSource: res.designSource });
      setConfetti((c) => c + 1);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code && ['NO_TOKENS', 'NEEDS_PACKAGE', 'BLOCKED'].includes(code)) setBlocker({ code, message: errMsg(e) });
      else toast(errMsg(e), 'error');
    } finally {
      setPublishing(false);
    }
  };

  const redesign = async () => {
    if (!result) return;
    setRedesigning(true);
    try {
      const res = await api.post<{ deal: Deal; warning?: string }>(`/business/deals/${result.deal.id}/redesign`);
      setResult({ ...result, deal: res.deal, warning: res.warning });
      toast('עיצוב חדש מוכן ✨');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRedesigning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setForm(initial);
    setStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ideas = TITLE_IDEAS[b.category?.slug ?? ''] ?? TITLE_IDEAS.default;
  const durationChips = [1, 3, 6, 12, 24, 48].filter((h) => h >= ds.minHours && h <= ds.maxHours);
  const endAt = new Date(new Date(previewDeal.starts_at).getTime() + form.duration_hours * 3600_000).toISOString();

  // ---------------- result screen ----------------
  if (result) {
    const left = Math.max(0, ds.freeRedesigns - (result.deal.redesigns ?? 0));
    return (
      <div className="mx-auto max-w-5xl">
        <Confetti fire={confetti} />
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_400px]">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1.5 text-sm font-bold text-lime-800">
              <Check size={16} strokeWidth={3} /> {result.deal.status === 'scheduled' ? 'הדיל תוזמן בהצלחה' : 'הדיל באוויר!'}
            </div>
            <h1 className="mt-3 text-4xl font-black leading-tight text-ink-900 sm:text-5xl">
              {result.designSource === 'ai' ? 'ה-AI עיצב לך כרטיס מנצח 🎉' : 'הכרטיס שלך מוכן 🎉'}
            </h1>
            <p className="mt-3 text-lg text-ink-600">
              {result.deal.status === 'scheduled'
                ? `הדיל יעלה לאוויר ב-${dateTime(result.deal.starts_at)} ויוצג עד ${dateTime(result.deal.expires_at)}.`
                : `הדיל מוצג עכשיו באתר עד ${dateTime(result.deal.expires_at)}, ואז יימחק אוטומטית.`}
            </p>
            {result.warning && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <CircleAlert size={18} className="mt-0.5 shrink-0" /> שירות ה-AI לא היה זמין, ולכן הכרטיס עוצב במעצב המובנה לפי הקטגוריה שלך.
              </p>
            )}
            {result.deal.design.vibe && (
              <p className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                <Sparkles size={16} className="text-lime-600" /> אווירת העיצוב: <b className="text-ink-800">{result.deal.design.vibe}</b>
              </p>
            )}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a href={`/deal/${result.deal.id}`} target="_blank" rel="noreferrer" className="btn btn-leaf btn-lg">
                <ExternalLink size={19} /> צפייה באתר
              </a>
              <Button variant="outline" size="lg" onClick={redesign} loading={redesigning} disabled={left <= 0} icon={<Wand2 size={19} />}>
                {left > 0 ? `עיצוב מחדש (נותרו ${left})` : 'נוצלו העיצובים החוזרים'}
              </Button>
              <Button size="lg" onClick={reset} icon={<Plus size={19} />}>
                פרסום דיל נוסף
              </Button>
              <Link to="/dashboard/deals" className="btn btn-ghost btn-lg">
                <LayoutGrid size={19} /> לדילים שלי
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink-500">
              נותרו לך <b className="text-ink-800">{b.tokens.available}</b> טוקנים זמינים.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, rotateY: -90, scale: 0.8 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 90 }} style={{ transformPerspective: 1200 }} className="mx-auto w-full max-w-[400px]">
            <AnimatePresence mode="wait">
              <motion.div key={JSON.stringify(result.deal.design)} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.45 }} style={{ transformPerspective: 1200 }}>
                <DealCard deal={result.deal} large preview />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // ---------------- wizard ----------------
  return (
    <div className="mx-auto max-w-6xl">
      <AiDesigning open={publishing} title={form.title} />
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-[28px]">פרסום דיל חדש</h1>
        <p className="mt-0.5 text-sm text-ink-500">ממלאים 4 צעדים קצרים — וה-AI מעצב לכם כרטיס פרסום מושך לפי הקטגוריה של העסק.</p>
        <a href="#deal-preview" className="btn btn-sm btn-outline mt-3 lg:hidden">
          <Sparkles size={14} /> לתצוגה המקדימה
        </a>
      </div>

      {/* stepper */}
      <div className="mb-6 grid grid-cols-4 gap-2 sm:gap-3">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <button
              key={s.key}
              onClick={() => (i < step ? setStep(i) : i === step + 1 ? next() : undefined)}
              className={cx(
                'group relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition sm:flex-row sm:gap-3 sm:px-4 sm:text-right',
                active ? 'bg-white shadow-lift ring-2 ring-lime-400' : done ? 'bg-white/80 shadow-soft ring-1 ring-lime-200' : 'bg-white/50 ring-1 ring-ink-100',
              )}
            >
              <span
                className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition', active ? 'text-leaf-950 shadow-3d' : done ? 'bg-lime-500 text-white' : 'bg-ink-100 text-ink-400')}
                style={active ? { background: 'linear-gradient(160deg,#d6ee9c,#8cc10a 60%,#6f9e0b)' } : undefined}
              >
                {done ? <Check size={20} strokeWidth={3} /> : <s.icon size={19} />}
              </span>
              <span className="min-w-0">
                <span className="hidden text-[11px] font-semibold text-ink-400 sm:block">שלב {i + 1}</span>
                <span className={cx('block text-xs font-bold sm:text-sm', active ? 'text-ink-900' : 'text-ink-500')}>{s.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card-3d p-5 sm:p-7">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }}>
              {step === 0 && (
                <div className="space-y-5">
                  <StepTitle icon={<Tag size={20} />} title="מה מציעים היום?" text="כותרת קצרה וברורה עובדת הכי טוב. ה-AI יוסיף כותרת שיווקית משלו." />
                  <Field label="כותרת הדיל" required error={errors.title} hint={`${form.title.length}/80`}>
                    <Input value={form.title} onChange={(e) => set('title', e.target.value.slice(0, 80))} placeholder="לדוגמה: מגש משפחתי + 2 תוספות + שתייה" invalid={!!errors.title} autoFocus />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {ideas.map((t) => (
                      <button key={t} onClick={() => set('title', t)} className="chip bg-lime-50 text-lime-800 ring-1 ring-lime-200 transition hover:bg-lime-100">
                        <Sparkles size={12} /> {t}
                      </button>
                    ))}
                  </div>
                  <Field label="פרטים נוספים (לא חובה)" hint={`${form.description.length}/400 · תנאים, שעות מימוש וכו׳`}>
                    <Textarea value={form.description} onChange={(e) => set('description', e.target.value.slice(0, 400))} placeholder="בתוקף באיסוף עצמי בלבד, עד גמר המלאי…" />
                  </Field>
                  <Field label={`תמונה לדיל ${ds.requireImage ? '' : '(לא חובה)'}`} error={errors.image_url}>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    {form.image_url ? (
                      <div className="relative overflow-hidden rounded-2xl ring-1 ring-ink-100">
                        <img src={form.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
                        <div className="absolute left-3 top-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} icon={<Pencil size={14} />}>
                            החלפה
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => set('image_url', '')} icon={<Trash2 size={14} />}>
                            הסרה
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f) upload(f);
                        }}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-8 text-ink-500 transition hover:border-lime-400 hover:bg-lime-50/60"
                      >
                        {uploading ? <span className="animate-pulse font-semibold">מעלה…</span> : <ImagePlus size={30} className="text-lime-600" />}
                        <span className="text-sm font-semibold">גררו לכאן תמונה או לחצו לבחירה</span>
                        <span className="text-xs">PNG, JPG, WEBP · עד 4MB</span>
                      </button>
                    )}
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <StepTitle icon={<Percent size={20} />} title="כמה זה עולה?" text="מזינים מחיר מקורי ואחוז הנחה — המחיר הסופי מחושב אוטומטית ויוצג עם קו על המחיר המקורי." />
                  <Field label="מחיר מקורי" required error={errors.original_price}>
                    <div className="relative">
                      <Input inputMode="decimal" value={form.original_price} onChange={(e) => set('original_price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="100" className="pr-9 text-2xl font-black" invalid={!!errors.original_price} />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xl font-black text-ink-400">₪</span>
                    </div>
                  </Field>
                  <Field label="אחוז הנחה" error={errors.discount_percent}>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={1}
                        max={ds.maxDiscount}
                        value={form.discount_percent}
                        onChange={(e) => set('discount_percent', Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-ink-100 accent-lime-600"
                        style={{ background: `linear-gradient(to left, #8cc10a ${(form.discount_percent / ds.maxDiscount) * 100}%, #e9eee7 0)` }}
                      />
                      <div className="relative w-24">
                        <Input
                          inputMode="numeric"
                          value={form.discount_percent}
                          onChange={(e) => set('discount_percent', Math.min(ds.maxDiscount, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0)))}
                          className="pl-7 text-center text-lg font-black"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-ink-400">%</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[10, 20, 30, 40, 50, 70].filter((p) => p <= ds.maxDiscount).map((p) => (
                        <button key={p} onClick={() => set('discount_percent', p)} className={cx('chip px-3 py-1.5 text-sm ring-1 transition', form.discount_percent === p ? 'bg-leaf-700 text-white ring-leaf-700' : 'bg-white text-ink-700 ring-ink-200 hover:ring-lime-400')}>
                          {p}%
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="או: מה המחיר אחרי ההנחה?" hint="נחשב את אחוז ההנחה בשבילכם">
                    <div className="relative max-w-[220px]">
                      <Input
                        inputMode="decimal"
                        placeholder={original ? String(finalPrice) : '—'}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(/[^\d.]/g, ''));
                          if (original && v > 0 && v < original) set('discount_percent', Math.min(ds.maxDiscount, Math.max(1, Math.round((1 - v / original) * 100))));
                        }}
                        className="pr-9"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-ink-400">₪</span>
                    </div>
                  </Field>
                  <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lift" style={{ background: 'linear-gradient(135deg,#123a1f,#1e5c2e 60%,#3f8f2a)' }}>
                    <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-lime-300/25 blur-2xl" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm text-white/70">
                          במקום <s className="decoration-2">{original ? money(original) : '—'}</s>
                        </div>
                        <div className="font-display text-5xl leading-none">{original ? money(finalPrice) : '—'}</div>
                        {original > 0 && <div className="mt-1 text-sm text-lime-200">הלקוח חוסך {money(Math.round((original - finalPrice) * 100) / 100)}</div>}
                      </div>
                      <div className="flex h-24 w-24 shrink-0 animate-pulsebig flex-col items-center justify-center rounded-full text-leaf-950 shadow-3d" style={{ background: 'radial-gradient(circle at 35% 30%,#fff7a8,#ffe14d 50%,#c9a400 130%)' }}>
                        <span className="font-display text-3xl leading-none" dir="ltr">
                          {form.discount_percent}%
                        </span>
                        <span className="text-xs font-bold">הנחה</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <StepTitle icon={<Clock size={20} />} title="כמה זמן הדיל יהיה באוויר?" text={`מינימום ${durationLabel(ds.minHours)}, מקסימום ${durationLabel(ds.maxHours)}. בסוף הזמן הדיל נמחק אוטומטית מהאתר.`} />
                  <div className="flex flex-col items-center rounded-3xl bg-gradient-to-b from-lime-50 to-white p-6 ring-1 ring-lime-100">
                    <div className="relative flex h-40 w-40 items-center justify-center">
                      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#e9eee7" strokeWidth="10" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke="url(#durGrad)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(form.duration_hours / ds.maxHours) * 326.7} 326.7`} className="transition-all duration-300" />
                        <defs>
                          <linearGradient id="durGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#c6f16b" />
                            <stop offset="100%" stopColor="#1e5c2e" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="text-center">
                        <div className="font-display text-5xl leading-none text-leaf-800">{form.duration_hours}</div>
                        <div className="mt-1 text-sm font-semibold text-ink-500">שעות</div>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={ds.minHours}
                      max={ds.maxHours}
                      step={1}
                      value={form.duration_hours}
                      onChange={(e) => set('duration_hours', Number(e.target.value))}
                      className="mt-5 h-2 w-full max-w-md cursor-pointer appearance-none rounded-full accent-lime-600"
                      style={{ background: `linear-gradient(to left, #8cc10a ${((form.duration_hours - ds.minHours) / Math.max(1, ds.maxHours - ds.minHours)) * 100}%, #e9eee7 0)` }}
                      aria-label="משך הדיל בשעות"
                    />
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {durationChips.map((h) => (
                        <button key={h} onClick={() => set('duration_hours', h)} className={cx('chip px-3 py-1.5 text-sm ring-1 transition', form.duration_hours === h ? 'bg-leaf-700 text-white ring-leaf-700' : 'bg-white text-ink-700 ring-ink-200 hover:ring-lime-400')}>
                          {durationLabel(h)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { v: false, icon: <Zap size={20} />, title: 'עכשיו', text: 'הדיל עולה לאוויר מיד' },
                      { v: true, icon: <CalendarClock size={20} />, title: 'תזמון', text: 'עד 7 ימים מראש' },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        onClick={() => set('schedule', o.v)}
                        className={cx('flex items-center gap-3 rounded-2xl border-2 p-4 text-right transition', form.schedule === o.v ? 'border-lime-500 bg-lime-50 shadow-glow' : 'border-ink-100 bg-white hover:border-ink-200')}
                      >
                        <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', form.schedule === o.v ? 'bg-lime-500 text-white' : 'bg-ink-100 text-ink-500')}>{o.icon}</span>
                        <span>
                          <span className="block font-bold text-ink-900">{o.title}</span>
                          <span className="block text-xs text-ink-500">{o.text}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {form.schedule && (
                    <Field label="מועד תחילת הדיל" error={errors.starts_at}>
                      <Input type="datetime-local" value={form.starts_at} min={toLocalInput(new Date(mountedAt))} max={toLocalInput(new Date(mountedAt + 7 * 86400_000))} onChange={(e) => set('starts_at', e.target.value)} dir="ltr" className="text-left" />
                    </Field>
                  )}
                  <div className="flex items-center gap-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600 ring-1 ring-ink-100">
                    <Clock size={16} className="shrink-0 text-lime-700" /> הדיל יוצג עד <b className="text-ink-900">{dateTime(endAt)}</b> ואז יימחק אוטומטית.
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <StepTitle icon={<Rocket size={20} />} title="פרטי יצירת קשר על הכרטיס" text="הפרטים נלקחים אוטומטית מפרופיל העסק. בוחרים מה יופיע על הכרטיס." />
                  <ContactToggle icon={<Phone size={18} />} label="מספר טלפון (כפתור חיוג)" value={b.phone} checked={form.show_phone} onChange={(v) => set('show_phone', v)} />
                  <ContactToggle icon={<MapPin size={18} />} label="כתובת העסק" value={b.address} checked={form.show_address} onChange={(v) => set('show_address', v)} />
                  <ContactToggle icon={<Navigation size={18} />} label="ניווט ב-Waze" value={wazeUrl ? (b.waze_url ? 'קישור מותאם אישית' : 'נוצר אוטומטית מהכתובת') : ''} checked={form.show_waze} onChange={(v) => set('show_waze', v)} />
                  <Link to="/dashboard/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf-700 hover:underline">
                    <Pencil size={14} /> עריכת הפרטים בפרופיל העסק
                  </Link>

                  <div className="rounded-3xl bg-gradient-to-l from-ink-50 to-white p-5 ring-1 ring-ink-100">
                    <h3 className="mb-3 font-bold text-ink-900">סיכום</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-ink-500">דיל</dt>
                      <dd className="truncate font-semibold">{form.title}</dd>
                      <dt className="text-ink-500">מחיר</dt>
                      <dd className="font-semibold">
                        {money(finalPrice)} <s className="text-ink-400">{money(original)}</s> ({form.discount_percent}%)
                      </dd>
                      <dt className="text-ink-500">משך</dt>
                      <dd className="font-semibold">{durationLabel(form.duration_hours)}</dd>
                      <dt className="text-ink-500">התחלה</dt>
                      <dd className="font-semibold">{form.schedule ? dateTime(new Date(form.starts_at).toISOString()) : 'מיד'}</dd>
                    </dl>
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-200">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl text-leaf-950 shadow-3d" style={{ background: 'linear-gradient(160deg,#fff3a6,#f5c518 60%,#c99a00)' }}>
                        <Coins size={18} />
                      </span>
                      <div className="text-sm">
                        <div className="font-bold text-ink-900">הפרסום עולה טוקן אחד</div>
                        <div className="text-ink-500">
                          זמינים לך {b.tokens.available} טוקנים{b.tokens.daily ? ' (כולל הטוקן היומי של הניסיון)' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
            <Button variant="ghost" onClick={() => (step === 0 ? navigate('/dashboard') : setStep(step - 1))} icon={<ArrowRight size={18} />}>
              {step === 0 ? 'ביטול' : 'הקודם'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} size="lg">
                המשך <ArrowLeft size={18} />
              </Button>
            ) : (
              <Button onClick={publish} size="lg" loading={publishing} icon={<Wand2 size={20} />} disabled={b.tokens.available < 1}>
                פרסום ועיצוב ב-AI
              </Button>
            )}
          </div>
          {step === STEPS.length - 1 && b.tokens.available < 1 && (
            <p className="mt-3 text-center text-sm text-red-600">
              אין טוקנים זמינים.{' '}
              <Link to="/dashboard/billing" className="font-bold underline">
                לרכישת טוקנים
              </Link>
            </p>
          )}
        </div>

        {/* live preview */}
        <div id="deal-preview" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-700">תצוגה מקדימה חיה</span>
            <span className="chip bg-white text-ink-500 ring-1 ring-ink-100">
              <Sparkles size={12} className="text-lime-600" /> העיצוב הסופי ייווצר ב-AI
            </span>
          </div>
          <div className="mx-auto max-w-[380px]">
            <DealCard deal={previewDeal} preview />
          </div>
        </div>
      </div>

      <Modal open={!!blocker} onClose={() => setBlocker(null)} size="sm">
        {blocker && (
          <div className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl text-leaf-950 shadow-3d" style={{ background: 'linear-gradient(160deg,#fff3a6,#f5c518 60%,#c99a00)' }}>
              <Coins size={30} />
            </div>
            <h3 className="text-xl font-black">{blocker.code === 'NO_TOKENS' ? 'נגמרו הטוקנים' : blocker.code === 'NEEDS_PACKAGE' ? 'צריך לבחור חבילה' : 'החשבון אינו פעיל'}</h3>
            <p className="mt-2 text-ink-600">{blocker.message}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/dashboard/billing" className="btn btn-lime">
                {blocker.code === 'NO_TOKENS' ? 'לרכישת טוקנים' : 'למסך החבילות'}
              </Link>
              <Button variant="ghost" onClick={() => setBlocker(null)}>
                סגירה
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StepTitle({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lime-700 shadow-inner-top">{icon}</span>
      <div>
        <h2 className="text-xl font-black text-ink-900">{title}</h2>
        <p className="text-sm text-ink-500">{text}</p>
      </div>
    </div>
  );
}

function ContactToggle({ icon, label, value, checked, onChange }: { icon: ReactNode; label: string; value: string; checked: boolean; onChange: (v: boolean) => void }) {
  const missing = !value;
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border p-4 transition', checked && !missing ? 'border-lime-300 bg-lime-50/60' : 'border-ink-100 bg-white')}>
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', checked && !missing ? 'bg-lime-500 text-white' : 'bg-ink-100 text-ink-400')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-900">{label}</div>
        <div className={cx('truncate text-sm', missing ? 'text-amber-700' : 'text-ink-500')}>{missing ? 'לא הוגדר בפרופיל העסק' : value}</div>
      </div>
      <Switch checked={checked && !missing} onChange={onChange} disabled={missing} />
    </div>
  );
}
