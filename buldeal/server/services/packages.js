import { parseJson } from '../lib/utils.js';

export function serializePackage(p) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    subtitle: p.subtitle,
    price: p.price,
    compare_price: p.compare_price,
    period: p.period,
    tokens: p.tokens,
    priority_listing: !!p.priority_listing,
    theme: parseJson(p.theme, {}),
    rows: parseJson(p.rows, []),
    stickers: parseJson(p.stickers, []),
    cta_text: p.cta_text,
    is_active: !!p.is_active,
    show_on_site: !!p.show_on_site,
    show_in_dashboard: !!p.show_in_dashboard,
    sort_order: p.sort_order,
    updated_at: p.updated_at,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ROW_TYPES = ['feature', 'text', 'heading', 'divider', 'highlight', 'spacer'];
const SHAPES = ['ribbon', 'circle', 'tag', 'star', 'pill', 'burst'];

const clip = (v, n) => String(v ?? '').slice(0, n);
const color = (v, def) => (typeof v === 'string' && HEX.test(v) ? v : def);
const clamp = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Sanitize the canvas-editor content of a package (rows, stickers, theme). */
export function cleanPackageContent({ theme, rows, stickers }) {
  const t = theme && typeof theme === 'object' ? theme : {};
  const cleanTheme = {
    preset: clip(t.preset, 20),
    bg1: color(t.bg1, '#ffffff'),
    bg2: color(t.bg2, '#eef8e4'),
    accent: color(t.accent, '#7cc22a'),
    text: color(t.text, '#163b1f'),
    style: ['glass', 'solid', 'gradient', 'outline'].includes(t.style) ? t.style : 'gradient',
    elevation: clamp(t.elevation, 0, 3, 2),
  };
  const cleanRows = (Array.isArray(rows) ? rows : []).slice(0, 30).map((r, i) => ({
    id: clip(r?.id || `r${i}`, 20),
    type: ROW_TYPES.includes(r?.type) ? r.type : 'feature',
    text: clip(r?.text, 140),
    icon: clip(r?.icon, 30),
    included: r?.included !== false,
    bold: !!r?.bold,
    color: r?.color && HEX.test(r.color) ? r.color : '',
  }));
  const cleanStickers = (Array.isArray(stickers) ? stickers : []).slice(0, 6).map((s, i) => ({
    id: clip(s?.id || `s${i}`, 20),
    text: clip(s?.text, 24),
    shape: SHAPES.includes(s?.shape) ? s.shape : 'ribbon',
    color: color(s?.color, '#ffd23f'),
    textColor: color(s?.textColor, '#3a2600'),
    x: clamp(s?.x, 0, 100, 50),
    y: clamp(s?.y, 0, 100, 0),
    rotate: clamp(s?.rotate, -45, 45, 0),
    size: clamp(s?.size, 0.6, 1.8, 1),
  }));
  return { theme: cleanTheme, rows: cleanRows, stickers: cleanStickers };
}
