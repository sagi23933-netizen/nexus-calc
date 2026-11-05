import { useState, type DragEvent } from 'react';
import {
  ArrowDown, ArrowUp, Copy, GripVertical, Heading, Highlighter, Layers, ListPlus, Minus, MoveVertical, Palette, Plus, RotateCcw, Save, Settings,
  Sticker, Trash2, Type, Eye, Check, MousePointerClick,
} from 'lucide-react';
import type { Package, PackageRow, PackageRowType, PackageSticker, StickerShape } from '../../lib/types';
import { DynIcon } from '../../lib/icons';
import { THEME_PRESETS, StickerView } from '../../shared/PackageCard';
import { Button, Input, Switch, cx } from '../../shared/ui';
import { DarkSelect } from '../parts';
import { ColorField, IconPicker, MiniField, RangeField, Section, Segmented } from './controls';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const ROW_TYPES: { type: PackageRowType; label: string; icon: typeof Type }[] = [
  { type: 'feature', label: 'יתרון', icon: Check },
  { type: 'text', label: 'טקסט', icon: Type },
  { type: 'heading', label: 'כותרת', icon: Heading },
  { type: 'highlight', label: 'הדגשה', icon: Highlighter },
  { type: 'divider', label: 'קו', icon: Minus },
  { type: 'spacer', label: 'רווח', icon: MoveVertical },
];
const ROW_LABEL = Object.fromEntries(ROW_TYPES.map((r) => [r.type, r.label])) as Record<PackageRowType, string>;

export const STICKER_PRESETS: { label: string; s: Omit<PackageSticker, 'id'> }[] = [
  { label: 'הכי משתלם', s: { text: 'הכי משתלם', shape: 'ribbon', color: '#ffd23f', textColor: '#3a2600', x: 50, y: 0, rotate: 0, size: 1 } },
  { label: 'מומלץ', s: { text: 'מומלץ', shape: 'pill', color: '#ff3d71', textColor: '#ffffff', x: 82, y: 4, rotate: 8, size: 1 } },
  { label: 'VIP', s: { text: 'VIP', shape: 'circle', color: '#7c3aed', textColor: '#ffffff', x: 88, y: 6, rotate: 12, size: 1 } },
  { label: 'חדש!', s: { text: 'חדש!', shape: 'burst', color: '#a3d520', textColor: '#142010', x: 12, y: 6, rotate: -12, size: 1 } },
  { label: 'מבצע', s: { text: 'מבצע', shape: 'tag', color: '#ff7a18', textColor: '#ffffff', x: 16, y: 8, rotate: -8, size: 1 } },
  { label: 'מותאם', s: { text: 'טקסט', shape: 'star', color: '#ffd23f', textColor: '#3a2600', x: 85, y: 10, rotate: 0, size: 1 } },
];

const SHAPES: { value: StickerShape; label: string }[] = [
  { value: 'ribbon', label: 'סרט' },
  { value: 'pill', label: 'גלולה' },
  { value: 'circle', label: 'עיגול' },
  { value: 'tag', label: 'תווית' },
  { value: 'star', label: 'כוכב' },
  { value: 'burst', label: 'פיצוץ' },
];

export function newRow(type: PackageRowType): PackageRow {
  const text = { feature: 'יתרון חדש', text: 'טקסט חופשי שמסביר את החבילה', heading: 'מה כלול', highlight: 'הטבה מיוחדת!', divider: '', spacer: '' }[type];
  return { id: uid(), type, text, icon: type === 'highlight' ? 'Sparkles' : '', included: true, bold: false, color: '' };
}

interface Props {
  pkg: Package;
  dirty: boolean;
  saving: boolean;
  selectedRowId: string | null;
  selectedStickerId: string | null;
  onSelectRow: (id: string | null) => void;
  onSelectSticker: (id: string | null) => void;
  update: (fn: (p: Package) => Package, coalesce?: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function Inspector({ pkg, dirty, saving, selectedRowId, selectedStickerId, onSelectRow, onSelectSticker, update, onSave, onDiscard, onDuplicate, onDelete }: Props) {
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [overRow, setOverRow] = useState<string | null>(null);
  const set = <K extends keyof Package>(k: K, v: Package[K], coalesce = true) => update((p) => ({ ...p, [k]: v }), coalesce ? `${pkg.id}:${String(k)}` : undefined);
  const setTheme = (patch: Partial<Package['theme']>, key?: string) => update((p) => ({ ...p, theme: { ...p.theme, ...patch } }), key ? `${pkg.id}:theme:${key}` : undefined);

  const row = pkg.rows.find((r) => r.id === selectedRowId) || null;
  const sticker = pkg.stickers.find((s) => s.id === selectedStickerId) || null;

  const setRow = (id: string, patch: Partial<PackageRow>, key?: string) =>
    update((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }), key ? `${pkg.id}:row:${id}:${key}` : undefined);
  const moveRow = (id: string, dir: -1 | 1) =>
    update((p) => {
      const i = p.rows.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.rows.length) return p;
      const rows = [...p.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...p, rows };
    });
  const addRow = (type: PackageRowType) => {
    const r = newRow(type);
    update((p) => {
      const idx = selectedRowId ? p.rows.findIndex((x) => x.id === selectedRowId) : -1;
      const rows = [...p.rows];
      rows.splice(idx >= 0 ? idx + 1 : rows.length, 0, r);
      return { ...p, rows };
    });
    onSelectRow(r.id);
  };
  const dupRow = (id: string) => {
    const copy = { ...pkg.rows.find((r) => r.id === id)!, id: uid() };
    update((p) => {
      const rows = [...p.rows];
      rows.splice(rows.findIndex((r) => r.id === id) + 1, 0, copy);
      return { ...p, rows };
    });
    onSelectRow(copy.id);
  };
  const delRow = (id: string) => {
    update((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) }));
    onSelectRow(null);
  };
  const onDropRow = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const from = dragRow;
    setDragRow(null);
    setOverRow(null);
    if (!from || from === targetId) return;
    update((p) => {
      const rows = [...p.rows];
      const fi = rows.findIndex((r) => r.id === from);
      const [moved] = rows.splice(fi, 1);
      rows.splice(rows.findIndex((r) => r.id === targetId), 0, moved);
      return { ...p, rows };
    });
  };

  const setSticker = (id: string, patch: Partial<PackageSticker>, key?: string) =>
    update((p) => ({ ...p, stickers: p.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }), key ? `${pkg.id}:st:${id}:${key}` : undefined);
  const addSticker = (preset: Omit<PackageSticker, 'id'>) => {
    if (pkg.stickers.length >= 6) return;
    const s = { ...preset, id: uid() };
    update((p) => ({ ...p, stickers: [...p.stickers, s] }));
    onSelectSticker(s.id);
  };
  const delSticker = (id: string) => {
    update((p) => ({ ...p, stickers: p.stickers.filter((s) => s.id !== id) }));
    onSelectSticker(null);
  };

  const isTokens = pkg.kind === 'tokens';

  return (
    <div className="a-card overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/5 bg-black/20 px-4 py-3">
        <div className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-white/15" style={{ background: `linear-gradient(150deg, ${pkg.theme.bg1}, ${pkg.theme.bg2})` }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-white">{pkg.name || 'ללא שם'}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
            {pkg.id < 0 ? <span className="text-amber-300">חבילה חדשה — לא נשמרה</span> : dirty ? <span className="text-amber-300">● שינויים שלא נשמרו</span> : <span className="text-lime-400">✓ שמור</span>}
          </div>
        </div>
        <button type="button" onClick={onDuplicate} className="btn-icon h-8 w-8 text-ink-300 hover:bg-white/10" title="שכפול חבילה" aria-label="שכפול חבילה">
          <Copy size={15} />
        </button>
        <button type="button" onClick={onDelete} className="btn-icon h-8 w-8 text-red-300 hover:bg-red-500/10" title="מחיקת חבילה" aria-label="מחיקת חבילה">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex gap-2 border-b border-white/5 px-4 py-3">
        <Button size="sm" className="flex-1" icon={<Save size={15} />} onClick={onSave} loading={saving} disabled={!dirty}>
          שמירה
        </Button>
        <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<RotateCcw size={14} />} onClick={onDiscard} disabled={!dirty || pkg.id < 0}>
          ביטול שינויים
        </Button>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto scrollbar-thin xl:max-h-[calc(100vh-230px)]">
        {/* sticker editor floats to the top when one is selected */}
        {sticker && (
          <Section title="מדבקה נבחרת" icon={<Sticker size={16} />} aside={<button type="button" onClick={() => onSelectSticker(null)} className="text-xs text-ink-400 hover:text-white">סגירה</button>}>
            <div className="flex justify-center rounded-xl bg-black/20 py-6">
              <div className="relative h-20 w-40">
                <StickerView s={{ ...sticker, x: 50, y: 50 }} />
              </div>
            </div>
            <MiniField label="טקסט">
              <Input dark value={sticker.text} maxLength={24} onChange={(e) => setSticker(sticker.id, { text: e.target.value }, 'text')} />
            </MiniField>
            <div>
              <span className="a-label !mb-1 text-xs">צורה</span>
              <div className="grid grid-cols-3 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSticker(sticker.id, { shape: s.value })}
                    className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold ring-1 transition', sticker.shape === s.value ? 'bg-lime-400 text-leaf-950 ring-lime-400' : 'text-ink-200 ring-white/10 hover:bg-white/5')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="רקע" value={sticker.color} onChange={(v) => setSticker(sticker.id, { color: v }, 'color')} />
              <ColorField label="טקסט" value={sticker.textColor} onChange={(v) => setSticker(sticker.id, { textColor: v }, 'textColor')} />
            </div>
            <RangeField label="סיבוב" value={sticker.rotate} min={-45} max={45} onChange={(v) => setSticker(sticker.id, { rotate: v }, 'rotate')} suffix="°" />
            <RangeField label="גודל" value={sticker.size ?? 1} min={0.6} max={1.8} step={0.05} onChange={(v) => setSticker(sticker.id, { size: v }, 'size')} suffix="x" />
            <div className="grid grid-cols-2 gap-3">
              <RangeField label="מיקום אופקי" value={Math.round(sticker.x)} min={0} max={100} onChange={(v) => setSticker(sticker.id, { x: v }, 'x')} suffix="%" />
              <RangeField label="מיקום אנכי" value={Math.round(sticker.y)} min={0} max={100} onChange={(v) => setSticker(sticker.id, { y: v }, 'y')} suffix="%" />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <MousePointerClick size={13} /> אפשר לגרור את המדבקה ישירות על הכרטיס, או להזיז עם החיצים במקלדת.
            </p>
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => delSticker(sticker.id)}>
              מחיקת מדבקה
            </Button>
          </Section>
        )}

        {row && (
          <Section title={`שורה נבחרת · ${ROW_LABEL[row.type]}`} icon={<Layers size={16} />} aside={<button type="button" onClick={() => onSelectRow(null)} className="text-xs text-ink-400 hover:text-white">סגירה</button>}>
            <MiniField label="סוג שורה">
              <DarkSelect value={row.type} onChange={(e) => setRow(row.id, { type: e.target.value as PackageRowType })}>
                {ROW_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </DarkSelect>
            </MiniField>
            {!['divider', 'spacer'].includes(row.type) && (
              <MiniField label="טקסט">
                <Input dark value={row.text} maxLength={140} onChange={(e) => setRow(row.id, { text: e.target.value }, 'text')} autoFocus />
              </MiniField>
            )}
            {['feature', 'highlight'].includes(row.type) && <IconPicker value={row.icon} onChange={(v) => setRow(row.id, { icon: v })} />}
            {row.type === 'feature' && <Switch dark checked={row.included} onChange={(v) => setRow(row.id, { included: v })} label="כלול בחבילה" description="כבוי = מוצג עם X ומחוק" />}
            {['feature', 'text'].includes(row.type) && <Switch dark checked={!!row.bold} onChange={(v) => setRow(row.id, { bold: v })} label="טקסט מודגש" />}
            {['feature', 'text', 'heading'].includes(row.type) && <ColorField label="צבע טקסט" value={row.color || ''} onChange={(v) => setRow(row.id, { color: v }, 'color')} allowEmpty />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<ArrowUp size={14} />} onClick={() => moveRow(row.id, -1)}>
                למעלה
              </Button>
              <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<ArrowDown size={14} />} onClick={() => moveRow(row.id, 1)}>
                למטה
              </Button>
              <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<Copy size={14} />} onClick={() => dupRow(row.id)}>
                שכפול
              </Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => delRow(row.id)}>
                מחיקה
              </Button>
            </div>
          </Section>
        )}

        <Section title="פרטי החבילה" icon={<Settings size={16} />}>
          <MiniField label="שם החבילה">
            <Input dark value={pkg.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
          </MiniField>
          <MiniField label="תת־כותרת">
            <Input dark value={pkg.subtitle} maxLength={120} onChange={(e) => set('subtitle', e.target.value)} />
          </MiniField>
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="מחיר (₪)">
              <Input dark type="number" min={0} value={pkg.price} onChange={(e) => set('price', Number(e.target.value))} />
            </MiniField>
            <MiniField label="מחיר להשוואה (מחוק)">
              <Input dark type="number" min={0} value={pkg.compare_price ?? ''} placeholder="ללא" onChange={(e) => set('compare_price', e.target.value === '' ? null : Number(e.target.value))} />
            </MiniField>
            <MiniField label="טוקנים">
              <Input dark type="number" min={0} value={pkg.tokens} onChange={(e) => set('tokens', Math.max(0, Math.round(Number(e.target.value))))} />
            </MiniField>
            <MiniField label="תקופה">
              {isTokens ? (
                <Input dark value="חד־פעמי" disabled />
              ) : (
                <DarkSelect value={pkg.period} onChange={(e) => set('period', e.target.value as Package['period'], false)}>
                  <option value="month">חודשי</option>
                  <option value="year">שנתי</option>
                </DarkSelect>
              )}
            </MiniField>
          </div>
          <MiniField label="טקסט כפתור">
            <Input dark value={pkg.cta_text} maxLength={40} onChange={(e) => set('cta_text', e.target.value)} />
          </MiniField>
          <Switch dark checked={pkg.priority_listing} onChange={(v) => set('priority_listing', v, false)} label="קידום בראש רשימת הדילים" description="דילים של מנויים פעילים יוצגו ראשונים עם תג ״מומלץ״" />
        </Section>

        <Section title="נראות וזמינות" icon={<Eye size={16} />}>
          <Switch dark checked={pkg.is_active} onChange={(v) => set('is_active', v, false)} label="חבילה פעילה" description="חבילה לא פעילה לא ניתנת לרכישה" />
          <Switch dark checked={pkg.show_on_site} onChange={(v) => set('show_on_site', v, false)} label="מוצגת באתר" description="בעמוד המחירים ובמסך בחירת החבילה בהרשמה" />
          <Switch dark checked={pkg.show_in_dashboard} onChange={(v) => set('show_in_dashboard', v, false)} label="מוצגת בממשק העסקים" description="במסך החבילות והטוקנים של בעל העסק" />
        </Section>

        <Section title="עיצוב" icon={<Palette size={16} />}>
          <div>
            <span className="a-label !mb-1.5 text-xs">ערכות צבע</span>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEME_PRESETS).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme({ preset: key, bg1: t.bg1, bg2: t.bg2, accent: t.accent, text: t.text })}
                  className={cx('group flex flex-col items-center gap-1 rounded-xl p-1.5 ring-1 transition', pkg.theme.preset === key ? 'ring-lime-400' : 'ring-white/10 hover:ring-white/30')}
                >
                  <span className="relative h-9 w-full overflow-hidden rounded-lg" style={{ background: `linear-gradient(150deg, ${t.bg1}, ${t.bg2})` }}>
                    <span className="absolute bottom-1 left-1 h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: t.accent }} />
                  </span>
                  <span className="text-[10px] text-ink-300">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="רקע עליון" value={pkg.theme.bg1} onChange={(v) => setTheme({ bg1: v, preset: 'custom' }, 'bg1')} />
            <ColorField label="רקע תחתון" value={pkg.theme.bg2} onChange={(v) => setTheme({ bg2: v, preset: 'custom' }, 'bg2')} />
            <ColorField label="צבע הדגשה" value={pkg.theme.accent} onChange={(v) => setTheme({ accent: v, preset: 'custom' }, 'accent')} />
            <ColorField label="צבע טקסט" value={pkg.theme.text} onChange={(v) => setTheme({ text: v, preset: 'custom' }, 'text')} />
          </div>
          <div>
            <span className="a-label !mb-1 text-xs">סגנון</span>
            <Segmented
              value={pkg.theme.style || 'gradient'}
              onChange={(v) => setTheme({ style: v })}
              options={[
                { value: 'gradient', label: 'מעבר' },
                { value: 'solid', label: 'אחיד' },
                { value: 'glass', label: 'זכוכית' },
                { value: 'outline', label: 'מתאר' },
              ]}
            />
          </div>
          <RangeField label="עומק תלת־ממד (צל)" value={pkg.theme.elevation ?? 2} min={0} max={3} onChange={(v) => setTheme({ elevation: v }, 'elev')} />
        </Section>

        <Section title={`שורות (${pkg.rows.length})`} icon={<ListPlus size={16} />}>
          <div className="grid grid-cols-3 gap-1.5">
            {ROW_TYPES.map((t) => (
              <button key={t.type} type="button" onClick={() => addRow(t.type)} className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-2 text-xs font-semibold text-ink-100 ring-1 ring-white/10 transition hover:bg-lime-400/15 hover:ring-lime-400/40">
                <Plus size={12} className="text-lime-400" />
                {t.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1">
            {pkg.rows.map((r) => {
              const T = ROW_TYPES.find((x) => x.type === r.type)?.icon ?? Type;
              return (
                <li
                  key={r.id}
                  draggable
                  onDragStart={(e) => {
                    setDragRow(r.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverRow(r.id);
                  }}
                  onDragLeave={() => setOverRow((o) => (o === r.id ? null : o))}
                  onDrop={(e) => onDropRow(e, r.id)}
                  onDragEnd={() => {
                    setDragRow(null);
                    setOverRow(null);
                  }}
                  onClick={() => onSelectRow(r.id)}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm ring-1 transition',
                    selectedRowId === r.id ? 'bg-lime-400/10 ring-lime-400/60' : 'ring-transparent hover:bg-white/5',
                    overRow === r.id && dragRow !== r.id && 'ring-sky-400',
                    dragRow === r.id && 'opacity-40',
                  )}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-ink-500" />
                  <T size={14} className="shrink-0 text-ink-400" />
                  {r.icon && <DynIcon name={r.icon} size={13} className="shrink-0 text-lime-400" />}
                  <span className={cx('flex-1 truncate', !r.included && 'text-ink-500 line-through')}>{r.text || <span className="text-ink-500">{ROW_LABEL[r.type]}</span>}</span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title={`מדבקות (${pkg.stickers.length}/6)`} icon={<Sticker size={16} />}>
          <div className="grid grid-cols-3 gap-1.5">
            {STICKER_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={pkg.stickers.length >= 6}
                onClick={() => addSticker(p.s)}
                className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold ring-1 ring-white/10 transition hover:ring-lime-400/50 disabled:opacity-40"
                style={{ background: `${p.s.color}22`, color: p.s.color }}
              >
                <Plus size={12} />
                {p.label}
              </button>
            ))}
          </div>
          {pkg.stickers.length > 0 && (
            <ul className="space-y-1">
              {pkg.stickers.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSticker(s.id)}
                    className={cx('flex w-full items-center gap-2 rounded-xl px-2 py-2 text-right text-sm ring-1 transition', selectedStickerId === s.id ? 'bg-lime-400/10 ring-lime-400/60' : 'ring-transparent hover:bg-white/5')}
                  >
                    <span className="h-4 w-4 shrink-0 rounded-md" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.text}</span>
                    <span className="text-[11px] text-ink-400">{SHAPES.find((x) => x.value === s.shape)?.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
