import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Globe, Instagram, KeyRound, Link2, MapPin, Navigation, Phone, Save, Store, Trash2, UserRound, MessageCircle } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi, useNow } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { BusinessInfo, Deal } from '../lib/types';
import { DealCard, FALLBACK_DESIGN } from '../shared/DealCard';
import { Avatar, Button, Field, Input, Select, Skeleton, Switch, Textarea } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, useBootstrap } from './kit';
import { ChangePasswordModal } from './ChangePasswordModal';

interface ProfileData {
  business: BusinessInfo;
  owner: { name: string; email: string; phone: string };
}

interface FormState {
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  customWaze: boolean;
  waze_url: string;
  website: string;
  instagram: string;
  lat: string;
  lng: string;
  category_id: string;
  city_id: string;
  ownerName: string;
}

function toForm(d: ProfileData): FormState {
  const b = d.business;
  return {
    name: b.name,
    description: b.description,
    phone: b.phone,
    whatsapp: b.whatsapp,
    address: b.address,
    customWaze: !!b.waze_url,
    waze_url: b.waze_url,
    website: b.website,
    instagram: b.instagram,
    lat: b.lat != null ? String(b.lat) : '',
    lng: b.lng != null ? String(b.lng) : '',
    category_id: b.category ? String(b.category.id) : '',
    city_id: b.city ? String(b.city.id) : '',
    ownerName: d.owner.name,
  };
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card-3d p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 font-bold text-ink-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-100 text-lime-700">{icon}</span>
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const { setBusiness } = useAuth();
  const boot = useBootstrap();
  const toast = useToast();
  const { data, loading } = useApi<ProfileData>('/business/profile');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [business, setBiz] = useState<BusinessInfo | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const now = useNow(60_000);

  useEffect(() => {
    if (data) {
      setForm(toForm(data));
      setBiz(data.business);
    }
  }, [data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const autoWaze = useMemo(() => {
    if (!form) return '';
    if (form.lat && form.lng) return `https://waze.com/ul?ll=${encodeURIComponent(`${form.lat},${form.lng}`)}&navigate=yes`;
    if (form.address) return `https://waze.com/ul?q=${encodeURIComponent(form.address)}&navigate=yes`;
    return '';
  }, [form]);

  const previewDeal: Deal | null = useMemo(() => {
    if (!form || !business) return null;
    return {
      id: 0,
      title: 'כך יופיעו פרטי העסק על הכרטיס',
      description: '',
      original_price: 100,
      discount_percent: 30,
      final_price: 70,
      image_url: '',
      duration_hours: 6,
      starts_at: new Date(now - 3600_000).toISOString(),
      expires_at: new Date(now + 5 * 3600_000).toISOString(),
      status: 'active',
      featured: false,
      design: { ...FALLBACK_DESIGN, headline: 'דוגמה לכרטיס', badge: 'תצוגה' },
      design_source: 'builtin',
      business: {
        id: business.id,
        name: form.name || business.name,
        slug: business.slug,
        logo_url: business.logo_url,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        waze_url: form.customWaze ? form.waze_url : autoWaze,
      },
      category: null,
      city: boot?.cities.find((c) => String(c.id) === form.city_id) ?? null,
    };
  }, [form, business, autoWaze, boot, now]);

  if (loading || !form || !business) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-12 w-60" />
        <Skeleton className="h-80" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ business: BusinessInfo }>('/business/profile', {
        name: form.name,
        description: form.description,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        waze_url: form.customWaze ? form.waze_url : '',
        website: form.website,
        instagram: form.instagram,
        lat: form.lat === '' ? null : form.lat,
        lng: form.lng === '' ? null : form.lng,
        category_id: form.category_id,
        city_id: form.city_id,
        ownerName: form.ownerName,
      });
      setBusiness(res.business);
      setBiz(res.business);
      toast('הפרופיל נשמר בהצלחה');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) return toast('הקובץ גדול מדי (עד 4MB)', 'error');
    setLogoBusy(true);
    try {
      const res = await api.upload<{ business: BusinessInfo }>('/business/profile/logo', file);
      setBusiness(res.business);
      setBiz(res.business);
      toast('הלוגו עודכן');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const res = await api.del<{ business: BusinessInfo }>('/business/profile/logo');
      setBusiness(res.business);
      setBiz(res.business);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLogoBusy(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast('הדפדפן לא תומך באיתור מיקום', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', pos.coords.latitude.toFixed(6));
        set('lng', pos.coords.longitude.toFixed(6));
        toast('המיקום עודכן — לא לשכוח לשמור');
      },
      () => toast('לא ניתן לקבל מיקום', 'error'),
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="פרופיל העסק"
        subtitle="הפרטים כאן מופיעים אוטומטית על כרטיסי הדילים שלך"
        icon={<Store size={22} />}
        actions={
          <Button onClick={save} loading={saving} icon={<Save size={17} />}>
            שמירת שינויים
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Section icon={<Store size={18} />} title="פרטי העסק">
            <Field label="שם העסק" required className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
            </Field>
            <Field label="קטגוריה" required>
              <Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                {boot?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="עיר" required>
              <Select value={form.city_id} onChange={(e) => set('city_id', e.target.value)}>
                {boot?.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="תיאור קצר" className="sm:col-span-2" hint={`${form.description.length}/600`}>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value.slice(0, 600))} placeholder="ספרו בכמה מילים על העסק" />
            </Field>
          </Section>

          <Section icon={<Phone size={18} />} title="יצירת קשר">
            <Field label="טלפון" required hint="יופיע ככפתור חיוג על הכרטיס">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" className="text-left" inputMode="tel" />
            </Field>
            <Field label="וואטסאפ (לא חובה)" hint="יופיע ככפתור וואטסאפ">
              <div className="relative">
                <Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} dir="ltr" className="pl-10 text-left" inputMode="tel" />
                <MessageCircle size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              </div>
            </Field>
            <Field label="שם בעל העסק">
              <div className="relative">
                <Input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} className="pr-10" />
                <UserRound size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
              </div>
            </Field>
            <Field label="אימייל להתחברות" hint="לשינוי אימייל פנו לתמיכה">
              <Input value={data!.owner.email} disabled dir="ltr" className="text-left" />
            </Field>
          </Section>

          <Section icon={<MapPin size={18} />} title="מיקום וניווט">
            <Field label="כתובת" className="sm:col-span-2" hint="תופיע על הכרטיס ומשמשת ליצירת קישור Waze אוטומטי">
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="רחוב, מספר, עיר" />
            </Field>
            <Field label="קו רוחב (לא חובה)">
              <Input value={form.lat} onChange={(e) => set('lat', e.target.value.replace(/[^\d.]/g, ''))} dir="ltr" className="text-left" placeholder="32.0853" />
            </Field>
            <Field label="קו אורך (לא חובה)">
              <Input value={form.lng} onChange={(e) => set('lng', e.target.value.replace(/[^\d.]/g, ''))} dir="ltr" className="text-left" placeholder="34.7818" />
            </Field>
            <div className="sm:col-span-2">
              <Button size="sm" variant="outline" onClick={useMyLocation} icon={<MapPin size={15} />}>
                שימוש במיקום הנוכחי שלי
              </Button>
            </div>
            <div className="space-y-3 rounded-2xl bg-ink-50/70 p-4 ring-1 ring-ink-100 sm:col-span-2">
              <Switch checked={form.customWaze} onChange={(v) => set('customWaze', v)} label="קישור Waze מותאם אישית" description="כבוי = הקישור נוצר אוטומטית מהכתובת / מהקואורדינטות" />
              {form.customWaze ? (
                <Input value={form.waze_url} onChange={(e) => set('waze_url', e.target.value)} dir="ltr" className="text-left" placeholder="https://waze.com/ul/..." />
              ) : (
                <div className="flex items-center gap-2 truncate text-sm text-ink-500" dir="ltr">
                  <Navigation size={15} className="shrink-0 text-lime-700" />
                  {autoWaze ? (
                    <a href={autoWaze} target="_blank" rel="noreferrer" className="truncate text-leaf-700 hover:underline">
                      {autoWaze}
                    </a>
                  ) : (
                    <span dir="rtl">הזינו כתובת כדי ליצור קישור</span>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section icon={<Link2 size={18} />} title="ברשת">
            <Field label="אתר אינטרנט">
              <div className="relative">
                <Input value={form.website} onChange={(e) => set('website', e.target.value)} dir="ltr" className="pl-10 text-left" placeholder="https://" />
                <Globe size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              </div>
            </Field>
            <Field label="אינסטגרם">
              <div className="relative">
                <Input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} dir="ltr" className="pl-10 text-left" placeholder="@mybusiness" />
                <Instagram size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              </div>
            </Field>
          </Section>

          <div className="flex justify-end">
            <Button size="lg" onClick={save} loading={saving} icon={<Save size={18} />}>
              שמירת שינויים
            </Button>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="card-3d p-6 text-center">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <div className="relative mx-auto w-fit">
              <div className="rounded-full bg-white p-1.5 shadow-lift ring-4 ring-lime-100">
                <Avatar src={business.logo_url} name={form.name || business.name} size={120} />
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={logoBusy} className="absolute bottom-1 left-1 flex h-10 w-10 items-center justify-center rounded-full bg-leaf-700 text-white shadow-lift ring-4 ring-white transition hover:scale-110" aria-label="החלפת לוגו">
                <Camera size={18} />
              </button>
            </div>
            <h3 className="mt-4 font-bold">לוגו העסק</h3>
            <p className="text-xs text-ink-500">מופיע במרכז החלק העליון של כל כרטיס דיל. מומלץ ריבועי, רקע שקוף.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" onClick={() => fileRef.current?.click()} loading={logoBusy}>
                העלאת לוגו
              </Button>
              {business.logo_url && (
                <Button size="sm" variant="ghost" className="text-red-600" onClick={removeLogo} icon={<Trash2 size={14} />}>
                  הסרה
                </Button>
              )}
            </div>
          </section>

          {previewDeal && (
            <div>
              <div className="mb-2 text-sm font-bold text-ink-700">תצוגה מקדימה</div>
              <DealCard deal={previewDeal} preview tilt={false} />
            </div>
          )}

          <section className="card-3d flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
              <KeyRound size={20} />
            </span>
            <div className="flex-1">
              <div className="font-bold">סיסמה</div>
              <div className="text-xs text-ink-500">מומלץ להחליף מדי פעם</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>
              שינוי
            </Button>
          </section>
        </aside>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
