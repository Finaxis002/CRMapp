/**
 * UnifiedThemeSystem.js
 * Single source of truth for Sharda CRM professional UI.
 * Use: import { getTheme, COLORS } from '../themes/UnifiedThemeSystem'
 * Or:  const { colors, spacing, typography } = useUISystem() / useTheme()
 */

export const lightColors = {
  // Brand
  primary: '#5a7bf6',
  primaryDark: '#4a68e0',
  primaryLight: '#7c96ff',
  primarySoft: 'rgba(90,123,246,0.10)',
  primaryBorder: 'rgba(90,123,246,0.20)',
  primaryShadow: 'rgba(90,123,246,0.25)',

  // Semantic
  success: '#12B76A',
  successSoft: 'rgba(18,183,106,0.10)',
  warning: '#F79009',
  warningSoft: 'rgba(247,144,9,0.10)',
  danger: '#F04438',
  dangerSoft: 'rgba(240,68,56,0.10)',
  info: '#0BA5EC',
  infoSoft: 'rgba(11,165,236,0.10)',
  purple: '#7A5AF8',
  purpleSoft: 'rgba(122,90,248,0.10)',
  cyan: '#0BA5EC',
  cyanSoft: 'rgba(11,165,236,0.10)',

  // Status badges
  statusNew: '#3b82f6',
  statusProcessing: '#F79009',
  statusCompleted: '#12B76A',
  statusCancelled: '#F04438',

  // Surfaces
  white: '#ffffff',
  black: '#000000',
  background: '#F8FAFC',
  backgroundSecondary: '#f3f4f6',
  backgroundTertiary: '#e5e7eb',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  cardBg: 'rgba(0,0,0,0.04)',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#ffffff',
  textLink: '#5a7bf6',

  // Borders & states
  border: 'rgba(0,0,0,0.09)',
  borderSolid: '#e5e7eb',
  borderLight: '#f3f4f6',
  borderFocus: '#5a7bf6',
  borderError: '#F04438',
  disabledBg: '#f3f4f6',
  disabledText: '#d1d5db',
  placeholder: '#9CA3AF',
  overlay: 'rgba(17, 24, 39, 0.45)',
  shadow: '#000000',

  // Skeleton
  skeletonBase: '#e5e7eb',
  skeletonHighlight: '#f3f4f6',

  // Aliases used by existing DashboardScreen local palette
  accent: '#5a7bf6',
  accentDark: '#4a68e0',
  accentSoft: 'rgba(90,123,246,0.10)',
  accentBorder: 'rgba(90,123,246,0.20)',
  accentShadow: 'rgba(90,123,246,0.25)',
  warn: '#F79009',
  warnSoft: 'rgba(247,144,9,0.10)',
  red: '#F04438',
  redSoft: 'rgba(240,68,56,0.10)',
  text1: '#111827',
  text2: '#6B7280',
  text3: '#9CA3AF',
  gradientStart: '#5a7bf6',
  gradientEnd: '#7A5AF8',
};

export const darkColors = {
  primary: '#6b8fff',
  primaryDark: '#5a7bf6',
  primaryLight: '#8aa4ff',
  primarySoft: 'rgba(90,123,246,0.15)',
  primaryBorder: 'rgba(90,123,246,0.22)',
  primaryShadow: 'rgba(90,123,246,0.25)',

  success: '#12B76A',
  successSoft: 'rgba(18,183,106,0.13)',
  warning: '#F79009',
  warningSoft: 'rgba(247,144,9,0.13)',
  danger: '#F04438',
  dangerSoft: 'rgba(240,68,56,0.13)',
  info: '#0BA5EC',
  infoSoft: 'rgba(11,165,236,0.13)',
  purple: '#7A5AF8',
  purpleSoft: 'rgba(122,90,248,0.13)',
  cyan: '#0BA5EC',
  cyanSoft: 'rgba(11,165,236,0.13)',

  statusNew: '#60a5fa',
  statusProcessing: '#FBBF24',
  statusCompleted: '#34d399',
  statusCancelled: '#f87171',

  white: '#ffffff',
  black: '#000000',
  background: '#0F172A',
  backgroundSecondary: '#1f2937',
  backgroundTertiary: '#374151',
  surface: '#1E293B',
  surfaceElevated: '#273449',
  cardBg: 'rgba(255,255,255,0.04)',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  textLink: '#6b8fff',

  border: 'rgba(255,255,255,0.09)',
  borderSolid: '#334155',
  borderLight: '#1f2937',
  borderFocus: '#6b8fff',
  borderError: '#f87171',
  disabledBg: '#374151',
  disabledText: '#6b7280',
  placeholder: '#64748B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',

  skeletonBase: '#374151',
  skeletonHighlight: '#4b5563',

  accent: '#5a7bf6',
  accentDark: '#4a68e0',
  accentSoft: 'rgba(90,123,246,0.15)',
  accentBorder: 'rgba(90,123,246,0.22)',
  accentShadow: 'rgba(90,123,246,0.25)',
  warn: '#F79009',
  warnSoft: 'rgba(247,144,9,0.13)',
  red: '#F04438',
  redSoft: 'rgba(240,68,56,0.13)',
  text1: '#F8FAFC',
  text2: '#94A3B8',
  text3: '#64748B',
  gradientStart: '#5a7bf6',
  gradientEnd: '#7A5AF8',
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: '700', lineHeight: 32, letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28, letterSpacing: -0.2 },
  h4: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  body1: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body2: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  button: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  full: 9999,
};

export const sizes = {
  buttonHeightSmall: 32,
  buttonHeightMedium: 44,
  buttonHeightLarge: 52,
  inputHeight: 44,
  inputHeightSmall: 40,
  inputHeightLarge: 52,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  iconXl: 32,
  avatarSm: 26,
  avatarMd: 40,
  avatarLg: 56,
  hitSlop: 8,
};

export const createElevation = (shadowColor = '#000000') => ({
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
});

export const elevation = createElevation(lightColors.shadow);

export function getTheme(isDark = false) {
  const colors = isDark ? darkColors : lightColors;
  return {
    isDark,
    colors,
    typography,
    spacing,
    borderRadius,
    sizes,
    elevation: createElevation(colors.shadow),
  };
}

/** Flat COLORS for simple imports (light mode defaults) */
export const COLORS = {
  ...lightColors,
  bgLight: lightColors.background,
  bgHover: lightColors.backgroundSecondary,
  borderColor: lightColors.borderSolid,
  error: lightColors.danger,
  disabled: lightColors.disabledText,
};

export default {
  lightColors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  sizes,
  elevation,
  getTheme,
  COLORS,
};
