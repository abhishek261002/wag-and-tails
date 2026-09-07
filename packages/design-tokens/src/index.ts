// ─── Brand Colors ────────────────────────────────────────────────────────────
// Values match the Wag & Tails prototype (styles.css :root) exactly.
export const colors = {
  // Primary browns (brand-900..50 in the prototype)
  brandBrown: '#4A1E0B',        // --brand-700
  brandBrownSecondary: '#5E2A11', // --brand-600
  brand900: '#2B1206',
  brand800: '#3A1808',
  brand500: '#7A3D1C',
  biscuit: '#DCC3A9',           // --brand-200
  biscuitLight: '#F0E2D4',      // --brand-100
  biscuitLighter: '#F9F1E9',    // --brand-50

  // Accent: marigold (accent-700..50 in the prototype)
  marigold: '#F07B2C',          // --accent-400 (the hot accent)
  marigoldMid: '#E86A1C',       // --accent-500
  marigoldDark: '#C25A12',      // --accent-600 (accessible text tint)
  marigoldDeep: '#A8480C',      // --accent-700
  marigoldLight: '#F9A96C',
  marigoldBg: '#FFF3E9',        // --accent-50

  // Canvas / backgrounds
  canvas: '#FBF7F2',
  white: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceAlt: '#F4EDE5',        // --sunken

  // Text
  textPrimary: '#1C1006',       // --ink
  textSecondary: '#4A3A2C',     // --ink-2
  textMuted: '#6E5B4B',         // --ink-3
  textDisabled: '#9A8878',      // --ink-4
  textOnDark: '#FFFFFF',
  textOnMarigold: '#FFFFFF',   // only for large/bold text - contrast insufficient for small

  // Status colors
  success: '#1F7A4D',           // --ok-600
  successLight: '#E7F4ED',      // --ok-50
  warning: '#B4520F',           // --warn-600
  warningLight: '#FFF1E4',      // --warn-50
  error: '#B3261E',             // --danger-600
  errorLight: '#FCECEA',        // --danger-50
  info: '#1F5F8B',              // --info-600
  infoLight: '#E9F2F8',         // --info-50

  // Neutrals
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Borders
  borderLight: '#EDE4D9',       // --line
  borderMedium: '#E2D5C6',      // --line-2
  borderDark: '#9A8878',        // --ink-4

  // Overlays
  overlay: 'rgba(28, 16, 6, 0.52)',
  overlayLight: 'rgba(74, 30, 11, 0.15)',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    display: 'PlusJakartaSans',
    ui: 'Inter',
    // Fallbacks
    displayFallback: 'Georgia, serif',
    uiFallback: 'system-ui, -apple-system, sans-serif',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
// Matches the prototype's --r-xs..--r-pill scale.
export const radii = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  none: 'none',
  sm: '0 1px 3px rgba(74,30,11,0.08), 0 1px 2px rgba(74,30,11,0.05)',
  md: '0 4px 12px rgba(74,30,11,0.10), 0 2px 6px rgba(74,30,11,0.06)',
  lg: '0 8px 24px rgba(74,30,11,0.12), 0 4px 12px rgba(74,30,11,0.08)',
  xl: '0 16px 40px rgba(74,30,11,0.14), 0 8px 20px rgba(74,30,11,0.10)',
  // Mobile card shadow
  card: '0 2px 10px rgba(74,30,11,0.09)',
  // Elevated modal/sheet
  sheet: '0 -4px 24px rgba(74,30,11,0.12)',
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────
export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    verySlow: 600,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ─── Breakpoints (web) ────────────────────────────────────────────────────────
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ─── Z-Index ──────────────────────────────────────────────────────────────────
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
} as const;

// ─── Pet Avatar Ring States ───────────────────────────────────────────────────
export const avatarRing = {
  idle: colors.biscuit,
  active: colors.marigold,
  inProgress: colors.brandBrown,
  done: colors.success,
} as const;

// ─── Consolidated Token Export ────────────────────────────────────────────────
export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  animation,
  breakpoints,
  zIndex,
  avatarRing,
} as const;

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Tokens = typeof tokens;
