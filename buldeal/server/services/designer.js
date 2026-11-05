/**
 * Deal-card design spec — shared contract between the AI, the built-in designer and the React DealCard.
 * Every field is validated/sanitized here so the frontend can trust it.
 */

export const LAYOUTS = ['classic', 'spotlight', 'ribbon', 'split'];
export const PATTERNS = ['none', 'dots', 'grid', 'waves', 'confetti', 'sparkles', 'stripes', 'leaves', 'bubbles'];
export const FONTS = ['rubik', 'secular', 'varela', 'suez', 'frank', 'karantina'];
export const ANIMATIONS = ['none', 'pulse', 'shine', 'float', 'glow'];
export const RADII = ['soft', 'round', 'sharp'];

export const DESIGN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['layout', 'palette', 'pattern', 'font', 'headline', 'tagline', 'badge', 'emoji', 'ctaText', 'animation', 'radius', 'vibe'],
  properties: {
    layout: { type: 'string', enum: LAYOUTS, description: 'Card composition' },
    palette: {
      type: 'object',
      additionalProperties: false,
      required: ['bg1', 'bg2', 'accent', 'text', 'priceBg', 'priceText'],
      properties: {
        bg1: { type: 'string', description: 'Gradient start, hex #RRGGBB' },
        bg2: { type: 'string', description: 'Gradient end, hex #RRGGBB' },
        accent: { type: 'string', description: 'Accent for badges and discount, hex #RRGGBB' },
        text: { type: 'string', description: 'Main text color with strong contrast over bg, hex #RRGGBB' },
        priceBg: { type: 'string', description: 'Final-price chip background, hex #RRGGBB' },
        priceText: { type: 'string', description: 'Final-price chip text, hex #RRGGBB' },
      },
    },
    pattern: { type: 'string', enum: PATTERNS },
    font: { type: 'string', enum: FONTS, description: 'rubik=modern bold, secular=punchy display, varela=soft rounded, suez=classic display, frank=elegant serif, karantina=condensed street' },
    headline: { type: 'string', description: 'Catchy Hebrew headline, max 26 characters' },
    tagline: { type: 'string', description: 'Short Hebrew supporting line, max 60 characters' },
    badge: { type: 'string', description: 'Hebrew sticker text, max 14 characters, e.g. "מבצע בזק"' },
    emoji: { type: 'string', description: 'One emoji that fits the business category' },
    ctaText: { type: 'string', description: 'Hebrew call-to-action, max 16 characters' },
    animation: { type: 'string', enum: ANIMATIONS },
    radius: { type: 'string', enum: RADII },
    vibe: { type: 'string', description: 'Two or three Hebrew words describing the visual mood' },
  },
};

// ---------- color helpers ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const readableOn = (bg, preferred) => {
  if (preferred && HEX.test(preferred) && contrast(preferred, bg) >= 4.5) return preferred;
  return contrast('#ffffff', bg) >= contrast('#101510', bg) ? '#ffffff' : '#101510';
};

const clip = (s, n) => {
  const chars = Array.from(String(s ?? '').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim());
  return chars.length > n ? chars.slice(0, n).join('').trim() : chars.join('');
};

/** Validate and repair a design object from any source. */
export function sanitizeDesign(input, fallback) {
  const d = input && typeof input === 'object' ? input : {};
  const f = fallback;
  const p = d.palette && typeof d.palette === 'object' ? d.palette : {};
  const color = (v, def) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : def);
  const bg1 = color(p.bg1, f.palette.bg1);
  const bg2 = color(p.bg2, f.palette.bg2);
  const mid = mix(bg1, bg2, 0.5);
  const accent = color(p.accent, f.palette.accent);
  const priceBg = color(p.priceBg, f.palette.priceBg);
  const emojiMatch = String(d.emoji || '').match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/u);
  return {
    layout: LAYOUTS.includes(d.layout) ? d.layout : f.layout,
    palette: {
      bg1,
      bg2,
      accent,
      text: readableOn(mid, color(p.text, f.palette.text)),
      priceBg,
      priceText: readableOn(priceBg, color(p.priceText, f.palette.priceText)),
    },
    pattern: PATTERNS.includes(d.pattern) ? d.pattern : f.pattern,
    font: FONTS.includes(d.font) ? d.font : f.font,
    headline: clip(d.headline, 26) || f.headline,
    tagline: clip(d.tagline, 60) || f.tagline,
    badge: clip(d.badge, 14) || f.badge,
    emoji: emojiMatch ? emojiMatch[0] : f.emoji,
    ctaText: clip(d.ctaText, 16) || f.ctaText,
    animation: ANIMATIONS.includes(d.animation) ? d.animation : f.animation,
    radius: RADII.includes(d.radius) ? d.radius : f.radius,
    vibe: clip(d.vibe, 30) || f.vibe,
  };
}

// ---------- built-in (rule-based) designer ----------
const PRESETS = {
  food: { palettes: [['#ff7a18', '#c81d25', '#ffd23f'], ['#f9484a', '#fbd72b', '#ffffff'], ['#ff9a44', '#fc6076', '#fff3b0']], emoji: ['🍔', '🍕', '🌮', '🍝'], font: ['secular', 'rubik'], pattern: ['dots', 'confetti'], vibe: 'חם ומעורר תיאבון' },
  cafe: { palettes: [['#6f4e37', '#c69c72', '#ffe8c7'], ['#3e2723', '#a1887f', '#ffcc80']], emoji: ['☕', '🥐', '🧁'], font: ['varela', 'frank'], pattern: ['bubbles', 'waves'], vibe: 'חמים ונעים' },
  fashion: { palettes: [['#232526', '#414345', '#f8c8dc'], ['#8e2de2', '#4a00e0', '#ffd1f2'], ['#ee9ca7', '#ffdde1', '#7a1f4b']], emoji: ['👗', '👠', '🛍️', '👜'], font: ['frank', 'suez'], pattern: ['stripes', 'sparkles'], vibe: 'אלגנטי ואופנתי' },
  beauty: { palettes: [['#f7b2c4', '#c9748f', '#fff0f5'], ['#d4a5a5', '#9e7676', '#fff5e4']], emoji: ['💅', '💄', '✨', '🌸'], font: ['frank', 'varela'], pattern: ['sparkles', 'bubbles'], vibe: 'עדין ומפנק' },
  sport: { palettes: [['#0f2027', '#2c5364', '#a8ff3e'], ['#00c6ff', '#0072ff', '#d4fc79']], emoji: ['🏋️', '⚽', '🏃', '💪'], font: ['karantina', 'rubik'], pattern: ['stripes', 'grid'], vibe: 'אנרגטי וחזק' },
  electronics: { palettes: [['#0f0c29', '#302b63', '#00e5ff'], ['#141e30', '#243b55', '#7cfc00']], emoji: ['📱', '🎧', '💻', '⚡'], font: ['rubik', 'karantina'], pattern: ['grid', 'sparkles'], vibe: 'טכנולוגי ומתקדם' },
  home: { palettes: [['#134e5e', '#71b280', '#fff6d5'], ['#5a3f37', '#2c7744', '#f6e7b4']], emoji: ['🛋️', '🪴', '🏡'], font: ['varela', 'suez'], pattern: ['leaves', 'waves'], vibe: 'ביתי ומזמין' },
  health: { palettes: [['#11998e', '#38ef7d', '#ffffff'], ['#43cea2', '#185a9d', '#e0fff4']], emoji: ['🌿', '💊', '🧘'], font: ['varela', 'rubik'], pattern: ['leaves', 'bubbles'], vibe: 'רענן ובריא' },
  car: { palettes: [['#232526', '#5b6467', '#ffb400'], ['#1f1c2c', '#928dab', '#ff5e3a']], emoji: ['🚗', '🛞', '🔧'], font: ['karantina', 'rubik'], pattern: ['stripes', 'grid'], vibe: 'עוצמתי ומהיר' },
  fun: { palettes: [['#7f00ff', '#e100ff', '#ffe600'], ['#fc466b', '#3f5efb', '#fffb7d']], emoji: ['🎉', '🎳', '🎬', '🎟️'], font: ['secular', 'karantina'], pattern: ['confetti', 'sparkles'], vibe: 'חגיגי ומשוגע' },
  kids: { palettes: [['#f7971e', '#ffd200', '#ff3d7f'], ['#56ccf2', '#2f80ed', '#ffe66d']], emoji: ['🧸', '🎈', '🪀'], font: ['varela', 'secular'], pattern: ['confetti', 'bubbles'], vibe: 'צבעוני ושמח' },
  pets: { palettes: [['#f6d365', '#fda085', '#5b3a29'], ['#ffe259', '#ffa751', '#3a2a1a']], emoji: ['🐶', '🐱', '🦴', '🐾'], font: ['varela', 'secular'], pattern: ['dots', 'bubbles'], vibe: 'חמוד ושמח' },
  supermarket: { palettes: [['#56ab2f', '#a8e063', '#fff200'], ['#1d976c', '#93f9b9', '#ff6b35']], emoji: ['🛒', '🥑', '🍎', '🧺'], font: ['secular', 'rubik'], pattern: ['dots', 'leaves'], vibe: 'טרי ומשתלם' },
  services: { palettes: [['#283c86', '#45a247', '#ffffff'], ['#355c7d', '#6c5b7b', '#f8b195']], emoji: ['🛠️', '📋', '🤝'], font: ['rubik', 'suez'], pattern: ['grid', 'waves'], vibe: 'מקצועי ואמין' },
  default: { palettes: [['#1e5c2e', '#7cc22a', '#ffe14d'], ['#2f7d32', '#c6f16b', '#ffffff']], emoji: ['🔥', '💥', '⭐'], font: ['rubik', 'secular'], pattern: ['dots', 'sparkles'], vibe: 'קליל ומזמין' },
};

function seeded(seed) {
  let s = (Number(seed) || 1) * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const pickFrom = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

export function presetKey(categorySlug) {
  return PRESETS[categorySlug] ? categorySlug : 'default';
}

/** Deterministic, category-aware design used when no AI is configured or the AI fails. */
export function builtinDesign({ deal, categorySlug, seed }) {
  const preset = PRESETS[presetKey(categorySlug)];
  const rnd = seeded(seed ?? Date.now() % 100000);
  const [bg1, bg2, accent] = pickFrom(rnd, preset.palettes);
  const d = Math.round(Number(deal.discount_percent) || 0);
  const headlines =
    d >= 50
      ? [`${d}% הנחה מטורפת!`, 'חצי מחיר ויותר!', 'מחיר שלא חוזר', 'דיל היסטרי!']
      : d >= 25
        ? [`${d}% הנחה – רק עכשיו`, 'דיל בזק!', 'מחיר מיוחד לזמן קצר', 'חוטפים לפני שנגמר']
        : [`${d}% הנחה`, 'הטבה לזמן מוגבל', 'מבצע של היום', 'שווה לבדוק!'];
  const badges = ['מבצע בזק', 'רק היום', 'דיל חם', 'לזמן מוגבל', 'חדש!'];
  const ctas = ['אני רוצה!', 'לניווט לעסק', 'תפסו את הדיל', 'מגיעים עכשיו'];
  const fallback = {
    layout: pickFrom(rnd, LAYOUTS),
    palette: { bg1, bg2, accent, text: '#ffffff', priceBg: accent, priceText: '#111111' },
    pattern: pickFrom(rnd, preset.pattern),
    font: pickFrom(rnd, preset.font),
    headline: pickFrom(rnd, headlines),
    tagline: clip(deal.title, 60) || 'הדיל שחיכיתם לו',
    badge: pickFrom(rnd, badges),
    emoji: pickFrom(rnd, preset.emoji),
    ctaText: pickFrom(rnd, ctas),
    animation: d >= 40 ? 'pulse' : pickFrom(rnd, ['shine', 'float', 'glow']),
    radius: pickFrom(rnd, RADII),
    vibe: preset.vibe,
  };
  return sanitizeDesign(fallback, fallback);
}
