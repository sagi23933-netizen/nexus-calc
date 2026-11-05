import { useEffect, useMemo, useState } from 'react';
import { GripVertical, MapPinned, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi } from '../lib/hooks';
import { DynIcon } from '../lib/icons';
import type { Category, City } from '../lib/types';
import { Button, Confirm, Empty, Field, Input, Modal, Skeleton, Switch, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, Panel } from './kit';
import { ColorField, IconPicker } from './studio/controls';

type Kind = 'categories' | 'cities';
type Item = Category & City;

const COPY = {
  categories: { title: 'קטגוריות', one: 'קטגוריה', subtitle: 'הקטגוריות מוצגות בראש האתר, בהרשמה ובסינון — וגם מנחות את ה-AI בעיצוב הכרטיסים.', icon: Tags },
  cities: { title: 'ערים', one: 'עיר', subtitle: 'הערים זמינות לבחירה בראש האתר ובהרשמת העסקים.', icon: MapPinned },
};

interface Draft {
  id?: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  ai_hint: string;
  region: string;
  is_active: boolean;
}

const emptyDraft: Draft = { name: '', slug: '', icon: 'Tag', color: '#7cc22a', ai_hint: '', region: '', is_active: true };

export default function LookupPage({ kind }: { kind: Kind }) {
  const toast = useToast();
  const c = COPY[kind];
  const { data, loading, reload, setData } = useApi<{ items: Item[] }>(`/admin/${kind}`, [kind]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  // the same component instance serves both routes — reset local UI state when switching
  useEffect(() => {
    setQ('');
    setDraft(null);
  }, [kind]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => {
    const s = q.trim();
    return s ? items.filter((i) => i.name.includes(s) || i.slug.includes(s) || (i.region || '').includes(s)) : items;
  }, [items, q]);

  const bodyOf = (d: Draft) =>
    kind === 'categories'
      ? { name: d.name, slug: d.slug || undefined, icon: d.icon, color: d.color, ai_hint: d.ai_hint, is_active: d.is_active }
      : { name: d.name, slug: d.slug || undefined, region: d.region, is_active: d.is_active };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast('יש להזין שם', 'error');
    setSaving(true);
    try {
      if (draft.id) await api.put(`/admin/${kind}/${draft.id}`, bodyOf(draft));
      else await api.post(`/admin/${kind}`, bodyOf(draft));
      toast(draft.id ? `${c.one} עודכנה` : `${c.one} נוספה`);
      setDraft(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (it: Item, v: boolean) => {
    setData((d) => (d ? { items: d.items.map((x) => (x.id === it.id ? { ...x, is_active: v ? 1 : 0 } : x)) } : d));
    try {
      await api.put(`/admin/${kind}/${it.id}`, bodyOf({ ...toDraft(it), is_active: v }));
    } catch (e) {
      toast(errMsg(e), 'error');
      reload();
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/${kind}/${toDelete.id}`);
      toast(`${c.one} נמחקה`);
      setToDelete(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const drop = async (targetId: number) => {
    const from = drag;
    setDrag(null);
    setOver(null);
    if (from == null || from === targetId) return;
    const next = [...items];
    const [moved] = next.splice(next.findIndex((i) => i.id === from), 1);
    next.splice(next.findIndex((i) => i.id === targetId), 0, moved);
    setData({ items: next });
    try {
      await api.post(`/admin/${kind}/reorder`, { ids: next.map((i) => i.id) });
      toast('הסדר עודכן', 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
      reload();
    }
  };

  const canDrag = !q.trim();
  const Icon = c.icon;

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        icon={<Icon size={22} />}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setDraft({ ...emptyDraft })}>
            {kind === 'categories' ? 'קטגוריה חדשה' : 'עיר חדשה'}
          </Button>
        }
      />
      <Panel
        padded={false}
        title={`${items.length} ${c.title}`}
        subtitle={canDrag ? 'גררו שורות כדי לקבוע את סדר ההצגה באתר' : 'סידור מחדש זמין כשאין חיפוש פעיל'}
        actions={
          <div className="relative w-56 max-w-full">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <Input dark className="!py-2 pr-9 text-sm" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty dark title="לא נמצאו תוצאות" text={q ? 'נסו חיפוש אחר' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table">
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>שם</th>
                  {kind === 'categories' ? <th className="hidden md:table-cell">הנחיית עיצוב ל-AI</th> : <th>אזור</th>}
                  <th className="text-center">עסקים</th>
                  <th className="text-center">דילים פעילים</th>
                  <th>פעיל</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      setDrag(it.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (drag == null) return;
                      e.preventDefault();
                      setOver(it.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(it.id);
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    className={cx(drag === it.id && 'opacity-40', over === it.id && drag !== it.id && 'outline outline-2 -outline-offset-2 outline-sky-400', !it.is_active && 'opacity-60')}
                  >
                    <td className="text-ink-500">{canDrag && <GripVertical size={16} className="cursor-grab" />}</td>
                    <td className="min-w-[170px]">
                      <div className="flex items-center gap-3">
                        {kind === 'categories' && (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-3d" style={{ background: it.color, color: '#fff' }}>
                            <DynIcon name={it.icon} size={17} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{it.name}</div>
                          <div className="truncate whitespace-nowrap font-mono text-[11px] text-ink-500" dir="ltr">
                            /{it.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    {kind === 'categories' ? <td className="hidden max-w-xs truncate text-ink-300 md:table-cell">{it.ai_hint || <span className="text-ink-600">—</span>}</td> : <td className="text-ink-300">{it.region || '—'}</td>}
                    <td className="text-center tabular-nums text-ink-200">{it.businesses ?? 0}</td>
                    <td className="text-center tabular-nums">
                      <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', (it.live_deals ?? 0) > 0 ? 'bg-lime-400/15 text-lime-300' : 'text-ink-500')}>{it.live_deals ?? 0}</span>
                    </td>
                    <td>
                      <Switch dark checked={!!it.is_active} onChange={(v) => toggleActive(it, v)} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn-icon h-9 w-9 text-ink-300 hover:bg-white/10" onClick={() => setDraft(toDraft(it))} aria-label="עריכה">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="btn-icon h-9 w-9 text-red-300 hover:bg-red-500/10" onClick={() => setToDelete(it)} aria-label="מחיקה">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        dark
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `עריכת ${c.one}` : kind === 'categories' ? 'קטגוריה חדשה' : 'עיר חדשה'}
        footer={
          <>
            <Button variant="a-ghost" className="a-btn-ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
            <Button onClick={save} loading={saving}>
              שמירה
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {kind === 'categories' && (
              <div className="flex items-center gap-3 rounded-2xl bg-black/30 p-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-3d" style={{ background: draft.color, color: '#fff' }}>
                  <DynIcon name={draft.icon} size={22} />
                </span>
                <span className="font-bold text-white">{draft.name || 'שם הקטגוריה'}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field dark label="שם" required>
                <Input dark value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </Field>
              <Field dark label="כתובת (slug)" hint="ריק = נוצר אוטומטית מהשם">
                <Input dark dir="ltr" className="text-left font-mono" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </Field>
            </div>
            {kind === 'categories' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <IconPicker value={draft.icon} onChange={(v) => setDraft({ ...draft, icon: v || 'Tag' })} />
                  <ColorField label="צבע" value={draft.color} onChange={(v) => setDraft({ ...draft, color: v })} />
                </div>
                <Field dark label="הנחיית סגנון ל-AI" hint="למשל: ״צבעים חמים ומעוררי תיאבון״ — ה-AI משתמש בזה כשהוא מעצב כרטיסי דילים בקטגוריה">
                  <Textarea dark value={draft.ai_hint} maxLength={200} onChange={(e) => setDraft({ ...draft, ai_hint: e.target.value })} />
                </Field>
              </>
            ) : (
              <Field dark label="אזור">
                <Input dark value={draft.region} maxLength={40} placeholder="מרכז / צפון / דרום…" onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
              </Field>
            )}
            <Switch dark checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} label="פעיל" description="פריט כבוי לא מוצג באתר ובהרשמה" />
          </div>
        )}
      </Modal>

      <Confirm
        dark
        danger
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        title={`מחיקת ${c.one}`}
        confirmText="מחיקה"
        body={
          toDelete && (
            <>
              למחוק את <b className="text-white">{toDelete.name}</b>?
              {(toDelete.businesses ?? 0) > 0 && <div className="mt-2 text-amber-300">משויכים אליה {toDelete.businesses} עסקים, ולכן המחיקה תיחסם. אפשר לכבות אותה במקום.</div>}
            </>
          )
        }
      />
    </div>
  );
}

function toDraft(it: Item): Draft {
  return { id: it.id, name: it.name, slug: it.slug, icon: it.icon || 'Tag', color: it.color || '#7cc22a', ai_hint: it.ai_hint || '', region: it.region || '', is_active: !!it.is_active };
}
