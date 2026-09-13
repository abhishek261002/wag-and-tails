import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { colors } from '@wag/design-tokens';
import { ICON_PATHS, type IconName } from './iconPaths';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  // 'stroke' is the prototype default; 'fill' mirrors its icoFill() variant,
  // used for the small solid glyphs (active tab, filled star).
  variant?: 'stroke' | 'fill';
}

// Mirrors ico()/icoFill() in the prototype's ui.js — same 24px viewBox and
// stroke weights, so icons sit on the same optical grid as the design.
export function Icon({ name, size = 20, color = colors.textPrimary, variant = 'stroke' }: IconProps) {
  const xml = useMemo(() => {
    const body = ICON_PATHS[name] ?? '';
    const attrs =
      variant === 'fill'
        ? `fill="${color}" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"`
        : `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
    // currentColor has no cascade to inherit from in react-native-svg, so the
    // resolved colour is substituted into the path data directly.
    const resolved = body.replace(/currentColor/g, color);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs}>${resolved}</svg>`;
  }, [name, size, color, variant]);

  return <SvgXml xml={xml} width={size} height={size} />;
}
