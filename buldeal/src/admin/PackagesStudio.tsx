import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, Copy, ExternalLink, GripVertical, Monitor, Moon, Palette, Plus, Redo2, Save, Smartphone, Sun, Undo2, Users, ZoomIn, ZoomOut, EyeOff,
  Globe, LayoutDashboard,
} from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Package, PackageSticker } from '../lib/types';
import { PackageCard, THEME_PRESETS } from '../shared/PackageCard';
import { Button, Confirm, PageLoader, Tabs, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader } from './kit';
import { useUndoable } from './studio/history';
import { Inspector, newRow } from './studio/Inspector';

type Kind = Package['kind'];

const EDITABLE: (keyof Package)[] = ['name', 'kind', 'subtitle', 'price', 'compare_price', 'period', 'tokens', 'priority_listing', 'theme', 'rows', 'stickers', 'cta_text', 'is_active', 'show_on_site', 'show_in_dashboard'];
const snapshot = (p: Package) => JSON.stringify(EDITABLE.map((k) => p[k]));
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
let tempId = -1;
const CARD_W = 290;
const COL_GAP = 28;

function blankPackage(kind: Kind, order: number): Package {
  const t = THEME_PRESETS.mint;
  return {
    id: tempId--,
    name: kind === 'tokens' ? 'חבילת טוקנים' : 'חבילה חדשה',
    kind,
    subtitle: kind === 'tokens' ? 'תוספת פרסומים' : 'תיאור קצר של החבילה',
    price: kind === 'tokens' ? 99 : 149,
    compare_price: null,
    period: kind === 'tokens' ? 'once' : 'month',
    tokens: kind === 'tokens' ? 10 : 20,
    priority_listing: false,
    theme: { preset: 'mint', bg1: t.bg1, bg2: t.bg2, accent: t.accent, text: t.text, style: 'gradient', elevation: 2 },
    rows: [
      { ...newRow('feature'), text: kind === 'tokens' ? '10 פרסומים נוספים' : '20 פרסומי דילים בחודש', icon: 'Ticket' },
      { ...newRow('feature'), text: 'עיצוב כרטיס אוטומטי ב-AI', icon: 'Wand2' },
    ],
    stickers: [],
    cta_text: kind === 'tokens' ? 'רכישה' : 'בחירת חבילה',
    is_active: true,
    show_on_site: true,
    show_in_dashboard: true,
    sort_order: order,
    subscribers: 0,
  };
}

function payload(p: Package) {
  return Object.fromEntries(EDITABLE.map((k) => [k, p[k]]));
}

export default function PackagesStudio() {
  const toast = useToast();
  const hist = useUndoable<Package[]>([]);
  const items = hist.state;
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('subscription');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [stickerId, setStickerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [device, setDevice] = useState<'desktop' | 'mobile'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'));
  const [canvasBg, setCanvasBg] = useState<'site' | 'dark'>('site');
  const [saving, setSaving] = useState<number | 'all' | null>(null);
  const [toDelete, setToDelete] = useState<Package | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragPkg, setDragPkg] = useState<number | null>(null);
  const [overPkg, setOverPkg] = useState<number | null>(null);
  const cardEls = useRef(new Map<number, HTMLDivElement>());
  const canvasRef = useRef<HTMLDivElement>(null);
  const innerClick = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ packages: Package[] }>('/admin/packages');
      hist.reset(res.packages);
      setSaved(Object.fromEntries(res.packages.map((p) => [p.id, snapshot(p)])));
      setSelectedId((cur) => cur ?? res.packages.find((p) => p.kind === 'subscription')?.id ?? null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => items.filter((p) => p.kind === kind), [items, kind]);
  const selected = items.find((p) => p.id === selectedId) || null;

  // fit the canvas: zoom out (down to 75%) so all cards of the tab are visible side by side
  const fit = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const cols = device === 'mobile' ? 1 : list.length;
    const content = device === 'mobile' ? 400 : cols * CARD_W + COL_GAP * Math.max(0, cols - 1) + 48;
    setZoom(Math.max(0.75, Math.min(1, Math.floor((el.clientWidth / content) * 100) / 100)));
  }, [device, list.length]);
  useEffect(() => {
    if (!loading) fit();
  }, [loading, kind, fit]);
  const isDirty = useCallback((p: Package) => p.id < 0 || saved[p.id] !== snapshot(p), [saved]);
  const dirtyCount = items.filter(isDirty).length;

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirtyCount) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyCount]);

  const update = useCallback(
    (id: number, fn: (p: Package) => Package, opts: { coalesce?: string; skipHistory?: boolean } = {}) => hist.set((all) => all.map((p) => (p.id === id ? fn(p) : p)), opts),
    [hist],
  );

  const select = (id: number) => {
    if (id !== selectedId) {
      setRowId(null);
      setStickerId(null);
    }
    setSelectedId(id);
  };

  const switchKind = (k: Kind) => {
    setKind(k);
    const first = items.find((p) => p.kind === k);
    setSelectedId(first?.id ?? null);
    setRowId(null);
    setStickerId(null);
  };

  // ---------- sticker drag on canvas ----------
  const startStickerDrag = (e: RPointerEvent<HTMLDivElement>, pkgId: number, sId: string) => {
    e.preventDefault();
    innerClick.current = true;
    select(pkgId);
    setStickerId(sId);
    setRowId(null);
    const el = cardEls.current.get(pkgId);
    const pkg = items.find((p) => p.id === pkgId);
    const st = pkg?.stickers.find((s) => s.id === sId);
    if (!el || !st) return;
    const r0 = el.getBoundingClientRect();
    const off = { x: ((e.clientX - r0.left) / r0.width) * 100 - st.x, y: ((e.clientY - r0.top) / r0.height) * 100 - st.y };
    let moved = false;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = Math.round(clamp(((ev.clientX - r.left) / r.width) * 100 - off.x) * 10) / 10;
      const y = Math.round(clamp(((ev.clientY - r.top) / r.height) * 100 - off.y) * 10) / 10;
      if (!moved) {
        moved = true;
        hist.checkpoint();
      }
      update(pkgId, (p) => ({ ...p, stickers: p.stickers.map((s) => (s.id === sId ? { ...s, x, y } : s)) }), { skipHistory: true });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setTimeout(() => (innerClick.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- package actions ----------
  const savePkg = async (p: Package) => {
    if (!p.name.trim()) return toast('יש להזין שם לחבילה', 'error');
    setSaving(p.id);
    try {
      const res = p.id < 0 ? await api.post<{ package: Package }>('/admin/packages', payload(p)) : await api.put<{ package: Package }>(`/admin/packages/${p.id}`, payload(p));
      const fresh = { ...res.package, subscribers: p.subscribers ?? 0 };
      hist.set((all) => all.map((x) => (x.id === p.id ? fresh : x)), { skipHistory: true });
      setSaved((s) => ({ ...s, [fresh.id]: snapshot(fresh) }));
      if (selectedId === p.id) setSelectedId(fresh.id);
      toast(`החבילה "${fresh.name}" נשמרה`);
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    setSaving('all');
    for (const p of items.filter(isDirty)) {
      const ok = await savePkg(p);
      if (!ok) break;
    }
    setSaving(null);
  };

  const discard = (p: Package) => {
    if (p.id < 0) return;
    const original = JSON.parse(saved[p.id]) as unknown[];
    update(p.id, (cur) => {
      const restored = { ...cur };
      EDITABLE.forEach((k, i) => ((restored as Record<string, unknown>)[k] = original[i]));
      return restored;
    });
  };

  const addPackage = () => {
    const p = blankPackage(kind, items.length + 1);
    hist.set((all) => [...all, p]);
    select(p.id);
  };

  const duplicate = async (p: Package) => {
    if (p.id < 0) {
      const copy = { ...structuredClone(p), id: tempId--, name: `${p.name} (עותק)` };
      hist.set((all) => [...all, copy]);
      select(copy.id);
      return;
    }
    try {
      const res = await api.post<{ package: Package }>(`/admin/packages/${p.id}/duplicate`);
      hist.set((all) => {
        const i = all.findIndex((x) => x.id === p.id);
        const next = [...all];
        next.splice(i + 1, 0, { ...res.package, subscribers: 0 });
        return next;
      }, { skipHistory: true });
      setSaved((s) => ({ ...s, [res.package.id]: snapshot(res.package) }));
      select(res.package.id);
      toast('החבילה שוכפלה (כבויה עד להפעלה)');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const doDelete = async () => {
    const p = toDelete;
    if (!p) return;
    if (p.id < 0) {
      hist.set((all) => all.filter((x) => x.id !== p.id));
      setToDelete(null);
      setSelectedId(null);
      return;
    }
    setDeleting(true);
    try {
      await api.del(`/admin/packages/${p.id}`);
      hist.set((all) => all.filter((x) => x.id !== p.id), { skipHistory: true });
      setSelectedId(null);
      toast('החבילה נמחקה');
      setToDelete(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const persistOrder = async (all: Package[]) => {
    const ids = all.filter((p) => p.id > 0).map((p) => p.id);
    try {
      await api.post('/admin/packages/reorder', { ids });
      toast('סדר החבילות עודכן', 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const reorder = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    const next = [...items];
    const fi = next.findIndex((p) => p.id === fromId);
    const [moved] = next.splice(fi, 1);
    next.splice(next.findIndex((p) => p.id === toId), 0, moved);
    hist.set(next, { skipHistory: true });
    persistOrder(next);
  };

  const move = (id: number, dir: -1 | 1) => {
    const idx = list.findIndex((p) => p.id === id);
    const target = list[idx + dir];
    if (!target) return;
    reorder(id, target.id);
  };

  const onDropPkg = (e: DragEvent, target: number) => {
    e.preventDefault();
    if (dragPkg != null) reorder(dragPkg, target);
    setDragPkg(null);
    setOverPkg(null);
  };

  // ---------- keyboard: undo/redo, delete, nudge ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z') && !typing) {
        e.preventDefault();
        if (e.shiftKey) hist.redo();
        else hist.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y') && !typing) {
        e.preventDefault();
        hist.redo();
        return;
      }
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (selected && isDirty(selected)) savePkg(selected);
        return;
      }
      if (typing || !selected) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && (stickerId || rowId)) {
        e.preventDefault();
        if (stickerId) {
          update(selected.id, (p) => ({ ...p, stickers: p.stickers.filter((s) => s.id !== stickerId) }));
          setStickerId(null);
        } else if (rowId) {
          update(selected.id, (p) => ({ ...p, rows: p.rows.filter((r) => r.id !== rowId) }));
          setRowId(null);
        }
        return;
      }
      if (stickerId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        update(selected.id, (p) => ({ ...p, stickers: p.stickers.map((s: PackageSticker) => (s.id === stickerId ? { ...s, x: clamp(s.x + dx), y: clamp(s.y + dy) } : s)) }), { coalesce: `nudge:${stickerId}` });
      }
      if (e.key === 'Escape') {
        setRowId(null);
        setStickerId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return <PageLoader dark />;


  return (
    <div>
      <PageHeader
        title="סטודיו חבילות"
        subtitle="עריכה חזותית של החבילות כפי שיופיעו באתר ובממשק העסקים — לחצו על כרטיס, שורה או מדבקה כדי לערוך."
        icon={<Palette size={22} />}
        actions={
          <>
            <a href="/pricing" target="_blank" rel="noreferrer" className="btn btn-sm a-btn-outline a-outline">
              <ExternalLink size={15} /> צפייה באתר
            </a>
            <Button size="sm" icon={<Save size={15} />} onClick={saveAll} disabled={!dirtyCount} loading={saving === 'all'}>
              שמירת הכל {dirtyCount > 0 && `(${dirtyCount})`}
            </Button>
          </>
        }
      />

      {/* toolbar */}
      <div className="a-card mb-4 flex flex-wrap items-center gap-2 !rounded-2xl p-2">
        <Tabs
          dark
          value={kind}
          onChange={switchKind}
          tabs={[
            { value: 'subscription', label: 'מנויים', count: items.filter((p) => p.kind === 'subscription').length },
            { value: 'tokens', label: 'חבילות טוקנים', count: items.filter((p) => p.kind === 'tokens').length },
          ]}
        />
        <div className="mx-1 hidden h-7 w-px bg-white/10 sm:block" />
        <div className="flex items-center gap-1">
          <button type="button" className="btn-icon h-9 w-9 text-ink-200 hover:bg-white/10 disabled:opacity-30" onClick={hist.undo} disabled={!hist.canUndo} title="ביטול (Ctrl+Z)" aria-label="ביטול פעולה">
            <Undo2 size={17} />
          </button>
          <button type="button" className="btn-icon h-9 w-9 text-ink-200 hover:bg-white/10 disabled:opacity-30" onClick={hist.redo} disabled={!hist.canRedo} title="חזרה (Ctrl+Shift+Z)" aria-label="חזרה על פעולה">
            <Redo2 size={17} />
          </button>
        </div>
        <div className="mx-1 hidden h-7 w-px bg-white/10 sm:block" />
        <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/5">
          <button type="button" className="btn-icon h-8 w-8 text-ink-200 hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.75, Math.round((z - 0.05) * 100) / 100))} aria-label="הקטנה">
            <ZoomOut size={16} />
          </button>
          <button type="button" className="w-12 text-center font-mono text-xs text-white" onClick={fit} title="התאמה לרוחב">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="btn-icon h-8 w-8 text-ink-200 hover:bg-white/10" onClick={() => setZoom((z) => Math.min(1.25, Math.round((z + 0.05) * 100) / 100))} aria-label="הגדלה">
            <ZoomIn size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/5">
          <button type="button" onClick={() => setDevice('desktop')} className={cx('btn-icon h-8 w-8', device === 'desktop' ? 'bg-lime-400 text-leaf-950' : 'text-ink-300 hover:bg-white/10')} title="תצוגת מחשב" aria-label="תצוגת מחשב">
            <Monitor size={16} />
          </button>
          <button type="button" onClick={() => setDevice('mobile')} className={cx('btn-icon h-8 w-8', device === 'mobile' ? 'bg-lime-400 text-leaf-950' : 'text-ink-300 hover:bg-white/10')} title="תצוגת נייד" aria-label="תצוגת נייד">
            <Smartphone size={16} />
          </button>
          <button type="button" onClick={() => setCanvasBg((b) => (b === 'site' ? 'dark' : 'site'))} className="btn-icon h-8 w-8 text-ink-300 hover:bg-white/10" title="רקע הקנבס" aria-label="החלפת רקע קנבס">
            {canvasBg === 'site' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
        <Button size="sm" variant="a-outline" className="a-btn-outline mr-auto" icon={<Plus size={15} />} onClick={addPackage}>
          {kind === 'tokens' ? 'חבילת טוקנים חדשה' : 'חבילה חדשה'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* canvas */}
        <div
          ref={canvasRef}
          className={cx('relative min-h-[620px] overflow-auto rounded-3xl ring-1', canvasBg === 'site' ? 'bg-cream ring-white/10' : 'bg-[#0a120d] ring-white/5')}
          style={{
            backgroundImage: `radial-gradient(${canvasBg === 'site' ? 'rgba(30,92,46,.14)' : 'rgba(190,230,160,.09)'} 1.2px, transparent 1.4px)`,
            backgroundSize: '22px 22px',
            boxShadow: 'inset 0 2px 24px rgba(0,0,0,.25)',
          }}
          onClick={() => {
            if (!innerClick.current) {
              setRowId(null);
              setStickerId(null);
            }
            innerClick.current = false;
          }}
        >
          <div className="mx-auto w-max px-6 pb-14 pt-12" style={{ zoom }}>
            {device === 'mobile' && <div className="mx-auto mb-6 h-1.5 w-24 rounded-full bg-ink-300/50" />}
            <div
              className="grid justify-center gap-y-12"
              style={{
                columnGap: COL_GAP,
                gridTemplateColumns: device === 'mobile' ? '352px' : `repeat(${Math.max(1, list.length)}, ${CARD_W}px)`,
              }}
            >
              {list.map((p, i) => {
                const dirty = isDirty(p);
                const sel = p.id === selectedId;
                return (
                  <div
                    key={p.id}
                    className={cx('flex flex-col transition-opacity', dragPkg === p.id && 'opacity-40')}
                    onDragOver={(e) => {
                      if (dragPkg == null) return;
                      e.preventDefault();
                      setOverPkg(p.id);
                    }}
                    onDrop={(e) => onDropPkg(e, p.id)}
                  >
                    <div
                      className={cx('mb-3 flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold', canvasBg === 'site' ? 'bg-white/80 text-ink-700 shadow-sm ring-1 ring-ink-100' : 'bg-white/5 text-ink-200 ring-1 ring-white/10', overPkg === p.id && dragPkg !== p.id && '!ring-2 !ring-sky-400')}
                    >
                      <span
                        draggable={p.id > 0}
                        onDragStart={(e) => {
                          setDragPkg(p.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDragPkg(null);
                          setOverPkg(null);
                        }}
                        className={cx('cursor-grab', p.id < 0 && 'cursor-not-allowed opacity-30')}
                        title={p.id < 0 ? 'יש לשמור לפני שינוי סדר' : 'גררו לשינוי סדר'}
                      >
                        <GripVertical size={15} />
                      </span>
                      <span className="flex-1 truncate">{p.name}</span>
                      {dirty && <span className="h-2 w-2 rounded-full bg-amber-400" title="שינויים שלא נשמרו" />}
                      {!p.is_active && (
                        <span className="rounded bg-red-500/15 px-1.5 text-[10px] text-red-500" title="לא פעילה">
                          כבויה
                        </span>
                      )}
                      {!p.show_on_site && <span title="מוסתרת באתר"><Globe size={13} className="text-ink-400 line-through opacity-60" /></span>}
                      {!p.show_in_dashboard && <span title="מוסתרת בממשק העסקים"><LayoutDashboard size={13} className="text-ink-400 opacity-60" /></span>}
                      {(p.subscribers ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 rounded bg-lime-500/15 px-1.5 text-[10px] text-lime-700" title="עסקים משויכים">
                          <Users size={11} />
                          {p.subscribers}
                        </span>
                      )}
                      <button type="button" disabled={i === 0 || p.id < 0} onClick={() => move(p.id, -1)} className="rounded p-0.5 hover:bg-black/10 disabled:opacity-25" aria-label="הזזה ימינה">
                        <ArrowRight size={13} />
                      </button>
                      <button type="button" disabled={i === list.length - 1 || p.id < 0} onClick={() => move(p.id, 1)} className="rounded p-0.5 hover:bg-black/10 disabled:opacity-25" aria-label="הזזה שמאלה">
                        <ArrowLeft size={13} />
                      </button>
                    </div>
                    <div
                      className={cx('relative flex-1 rounded-[30px] transition', !sel && 'cursor-pointer hover:-translate-y-1', !p.is_active && 'opacity-60 saturate-50')}
                      onClick={() => {
                        // rows/stickers/header handle their own selection; a click on the card body selects just the package
                        if (!innerClick.current) {
                          select(p.id);
                          setRowId(null);
                          setStickerId(null);
                        }
                        innerClick.current = true; // stop the canvas handler from clearing the selection
                      }}
                    >
                      <PackageCard
                        pkg={p}
                        selected={sel}
                        ctaLabel={p.cta_text}
                        className="min-h-[520px]"
                        editor={{
                          selectedRowId: sel ? rowId : null,
                          selectedStickerId: sel ? stickerId : null,
                          onRowClick: (id) => {
                            innerClick.current = true;
                            select(p.id);
                            setRowId(id);
                            setStickerId(null);
                          },
                          onStickerPointerDown: (e, sId) => startStickerDrag(e, p.id, sId),
                          onHeaderClick: () => {
                            innerClick.current = true;
                            select(p.id);
                            setRowId(null);
                            setStickerId(null);
                          },
                          innerRef: (el) => {
                            if (el) cardEls.current.set(p.id, el);
                            else cardEls.current.delete(p.id);
                          },
                        }}
                      />
                      {!p.is_active && (
                        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 mx-auto flex w-max -translate-y-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                          <EyeOff size={13} /> חבילה כבויה
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {list.length === 0 && (
              <div className="py-16 text-center">
                <p className="mb-4 text-sm text-ink-500">אין עדיין חבילות מהסוג הזה</p>
                <Button size="sm" icon={<Plus size={15} />} onClick={(e) => (e.stopPropagation(), addPackage())}>
                  הוספת חבילה
                </Button>
              </div>
            )}
          </div>
          <div className={cx('pointer-events-none absolute bottom-3 left-4 hidden text-[11px] md:block', canvasBg === 'site' ? 'text-ink-400' : 'text-ink-500')}>
            Ctrl+Z ביטול · Ctrl+S שמירה · Delete מחיקת פריט נבחר · חיצים להזזת מדבקה
          </div>
        </div>

        {/* inspector */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          {selected && selected.kind === kind ? (
            <Inspector
              pkg={selected}
              dirty={isDirty(selected)}
              saving={saving === selected.id}
              selectedRowId={rowId}
              selectedStickerId={stickerId}
              onSelectRow={(id) => {
                setRowId(id);
                if (id) setStickerId(null);
              }}
              onSelectSticker={(id) => {
                setStickerId(id);
                if (id) setRowId(null);
              }}
              update={(fn, coalesce) => update(selected.id, fn, { coalesce })}
              onSave={() => savePkg(selected)}
              onDiscard={() => discard(selected)}
              onDuplicate={() => duplicate(selected)}
              onDelete={() => setToDelete(selected)}
            />
          ) : (
            <div className="a-card p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-lime-400 shadow-3d">
                <Copy size={24} />
              </div>
              <h3 className="font-bold text-white">בחרו חבילה לעריכה</h3>
              <p className="mt-1 text-sm text-ink-400">לחצו על אחד הכרטיסים בקנבס כדי לערוך את התוכן, העיצוב והמדבקות שלו.</p>
              <Button className="mt-4" size="sm" icon={<Plus size={15} />} onClick={addPackage}>
                חבילה חדשה
              </Button>
            </div>
          )}
        </div>
      </div>

      <Confirm
        dark
        danger
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        title="מחיקת חבילה"
        confirmText="מחיקה"
        body={
          toDelete && (
            <>
              למחוק את החבילה <b className="text-white">{toDelete.name}</b>?
              {(toDelete.subscribers ?? 0) > 0 && <div className="mt-2 text-amber-300">לחבילה משויכים {toDelete.subscribers} עסקים — לא ניתן למחוק אותה. מומלץ לכבות אותה במקום.</div>}
            </>
          )
        }
      />
    </div>
  );
}

