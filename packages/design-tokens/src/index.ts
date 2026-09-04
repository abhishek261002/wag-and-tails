// ─── Brand Colors ────────────────────────────────────────────────────────────
export const colors = {
  // Primary browns
  brandBrown: '#4A1E0B',
  brandBrownSecondary: '#5E2A11',
  biscuit: '#DCC3A9',
  biscuitLight: '#EDD9C4',
  biscuitLighter: '#F5EDE3',

  // Accent
  marigold: '#F07B2C',
  marigoldDark: '#C25A12',
  marigoldLight: '#F9A96C',
  marigoldBg: '#FEF3EA',

  // Canvas / backgrounds
  canvas: '#FBF7F2',
  white: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceAlt: '#F5EDE3',

  // Text
  textPrimary: '#1A0A03',
  textSecondary: '#5C3D2E',
  textMuted: '#9E7B6A',
  textOnDark: '#FFFFFF',
  textOnMarigold: '#FFFFFF',   // only for large/bold text - contrast insufficient for small

  // Status colors
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57C00',
  warningLight: '#FFF3E0',
  error: '#C62828',
  errorLight: '#FFEBEE',
  info: '#1565C0',
  infoLight: '#E3F2FD',

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
  borderLight: '#E8D8CC',
  borderMedium: '#C8AA96',
  borderDark: '#9E7B6A',

  // Overlays
  overlay: 'rgba(74, 30, 11, 0.5)',
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
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
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
