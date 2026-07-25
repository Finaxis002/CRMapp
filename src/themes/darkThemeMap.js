import { lightColors, darkColors } from './UnifiedThemeSystem';

const AUTO_MAP = {};
Object.keys(lightColors).forEach(key => {
  const lightVal = lightColors[key];
  const darkVal = darkColors[key];
  if (typeof lightVal === 'string' && typeof darkVal === 'string') {
    AUTO_MAP[lightVal.toLowerCase()] = darkVal;
  }
});

const MANUAL_OVERRIDES = {
  '#fff': '#1c1f26',
  '#ffffff': '#1c1f26',
  '#f9fafb': '#121419',
  '#fafafa': '#181b21',
  '#111827': '#f3f4f6',
  '#374151': '#d1d5db',
  '#6b7280': '#9ca3af',
  '#9ca3af': '#7d8794',
  '#d1d5db': '#4b5563',
  '#e5e7eb': '#2c2f36',
  '#f3f4f6': '#23262d',
  '#fca5a5': '#7f1d1d',
  '#fee2e2': 'rgba(239,68,68,0.18)',
  '#fed7aa': 'rgba(249,115,22,0.35)',
  '#fff7ed': 'rgba(249,115,22,0.14)',
  '#dcfce7': 'rgba(34,197,94,0.18)',
  '#eff6ff': 'rgba(59,130,246,0.16)',
  '#faf5ff': 'rgba(168,85,247,0.16)',
  '#f0fdf4': 'rgba(34,197,94,0.16)',
  '#ecfdf5': 'rgba(16,185,129,0.16)',
  '#fefce8': 'rgba(234,179,8,0.16)',
  '#eef2ff': 'rgba(99,102,241,0.16)',
  'rgba(0,0,0,0.25)': 'rgba(0,0,0,0.6)',
  'rgba(255,255,255,0.7)': 'rgba(255,255,255,0.12)',
  'rgba(255,255,255,0.25)': 'rgba(255,255,255,0.18)',
};

export const DARK_COLOR_MAP = { ...AUTO_MAP, ...MANUAL_OVERRIDES };

export const recolorStyles = (stylesObj, isDark) => {
  if (!isDark) return stylesObj;
  const output = {};
  Object.keys(stylesObj).forEach(key => {
    const style = stylesObj[key] || {};
    const newStyle = {};
    Object.keys(style).forEach(prop => {
      const val = style[prop];
      const lookup = typeof val === 'string' ? val.toLowerCase() : val;
      newStyle[prop] = DARK_COLOR_MAP[lookup] || val;
    });
    output[key] = newStyle;
  });
  return output;
};

export const dc = (hex, isDark) => {
  if (!isDark || typeof hex !== 'string') return hex;
  return DARK_COLOR_MAP[hex.toLowerCase()] || hex;
};