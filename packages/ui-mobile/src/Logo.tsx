import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

export interface LogoProps {
  size?: number;
  ink?: string;
  ground?: string;
}

// The Wag & Tails mark — a dog and cat sharing one silhouette — copied
// verbatim from the prototype's logoMark() in brand.js. `ink` is the
// figure colour, `ground` is the accent dots/ground-line colour (defaults
// mirror the prototype: white figure on the brand-brown circle it usually
// sits inside).
export function Logo({ size = 44, ink = '#FFFFFF', ground = '#4A1E0B' }: LogoProps) {
  const xml = useMemo(
    () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}">
    <g fill="${ink}">
      <path d="M176 92c22 0 32 24 30 54-2 24-4 42-4 60h-42c0-20-2-38-6-58-5-26-2-56 22-56Z"/>
      <path d="M161 54h32l5 54c0 9-34 11-35 3Z"/>
      <ellipse cx="176" cy="54" rx="30" ry="27"/>
      <ellipse cx="206" cy="64" rx="17" ry="12.5"/>
      <path d="M152 32c-15 9-22 30-18 50 3 14 12 21 18 16-7-22-7-46 4-62 2-4-1-6-4-4Z"/>
      <path fill="none" stroke="${ink}" stroke-width="17" stroke-linecap="round" d="M162 150c-36-6-74 10-88 44"/>
    </g>
    <circle fill="${ground}" cx="183" cy="49" r="6.5"/>
    <circle fill="${ground}" cx="220" cy="62" r="4.5"/>
    <g transform="translate(-12,4)">
      <path fill="${ink}" stroke="${ground}" stroke-width="11" paint-order="stroke" stroke-linejoin="round"
        d="M110 130l-6-26c-1-5 3-8 7-5l18 14c8-3 17-3 25 0l18-14c4-3 8 0 7 5l-6 26c9 10 13 24 9 37-3 10-7 19-7 29 0 5 1 10 2 15h-64c2-9 3-19 2-28-1-8-4-15-5-23-2-12 2-24 10-33Z"/>
      <path fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" d="M170 194c15-3 24-15 21-29"/>
      <circle fill="${ground}" cx="129" cy="146" r="4.5"/>
      <circle fill="${ground}" cx="153" cy="146" r="4.5"/>
    </g>
    <path fill="${ink}" d="M16 210c50-14 158-14 208 0-50 9-158 9-208 0Z"/>
  </svg>`,
    [size, ink, ground]
  );

  return <SvgXml xml={xml} width={size} height={size} />;
}
