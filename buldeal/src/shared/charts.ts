/**
 * Chart color tokens — validated with the dataviz palette validator (CVD-safe, adjacent pairs ≥ 8 ΔE).
 * Use slots in this fixed order, never cycled; a 7th series folds into "אחר".
 * Light slots 5–6 sit below 3:1 on white → always pair them with visible labels/legend values.
 */
export const SERIES_LIGHT = ['#5a9a0f', '#2a78d6', '#eb6834', '#6250d6', '#e87ba4', '#eda100'];
export const SERIES_DARK = ['#6f9e0b', '#3987e5', '#d95926', '#9085e9', '#d55181', '#c98500'];

export const CHART_LIGHT = {
  surface: '#ffffff',
  grid: '#e9eee7',
  axis: '#81917b',
  text: '#374234',
  muted: '#5f6f5a',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d3dccf',
};

export const CHART_DARK = {
  surface: '#101a14',
  grid: 'rgba(190,230,160,0.08)',
  axis: '#81917b',
  text: '#e9eee7',
  muted: '#aebba8',
  tooltipBg: '#0d1611',
  tooltipBorder: 'rgba(190,230,160,0.18)',
};

/** Status colors — reserved for state, always paired with an icon + label. */
export const STATUS_COLORS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
