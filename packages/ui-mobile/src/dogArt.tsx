import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse, Circle, Path } from 'react-native-svg';

/**
 * Faithful port of the prototype's dogSvg() illustration (js/brand.js).
 * Palettes and ear styles mirror the prototype's three seed pets
 * (Simba/drop, Mochi/fluff, Rio/prick) so the same visual language
 * carries through even though real pets don't ship with fixed art.
 */
export interface DogArt {
  bg1: string;
  bg2: string;
  coat: string;
  coatDark: string;
  ear: 'drop' | 'fluff' | 'prick';
  ear2: string;
  muzzle: string;
}

const PALETTES: DogArt[] = [
  { bg1: '#E9CBA0', bg2: '#C2914F', coat: '#F5E7D6', coatDark: '#C68B4A', ear: 'drop', ear2: '#8B4E22', muzzle: '#FFF7EC' },
  { bg1: '#F2DAC3', bg2: '#D8A87E', coat: '#FFF6EA', coatDark: '#D8B58E', ear: 'fluff', ear2: '#DDB98F', muzzle: '#FFFCF6' },
  { bg1: '#DCB78E', bg2: '#A9703C', coat: '#E5BC88', coatDark: '#A97230', ear: 'prick', ear2: '#C9954F', muzzle: '#F8E2C6' },
  { bg1: '#E2CBB3', bg2: '#B98A62', coat: '#F0DFC9', coatDark: '#B9895F', ear: 'fluff', ear2: '#C9A377', muzzle: '#FBF0E2' },
  { bg1: '#DCC3A9', bg2: '#9A7350', coat: '#EAD8BE', coatDark: '#9D7752', ear: 'drop', ear2: '#7A5638', muzzle: '#F7EBDA' },
];

/** Deterministic pick so the same pet always renders the same art. */
export function pickDogArt(seed: string): DogArt {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
}

function ears(o: DogArt) {
  if (o.ear === 'drop') {
    return (
      <>
        <Path d="M23 42c-8 5-10 22-4 33 5 9 14 8 16 1 2-8-3-20-3-27 0-6-3-10-9-7Z" fill={o.ear2} />
        <Path d="M77 42c8 5 10 22 4 33-5 9-14 8-16 1-2-8 3-20 3-27 0-6 3-10 9-7Z" fill={o.ear2} />
      </>
    );
  }
  if (o.ear === 'fluff') {
    return (
      <>
        <Path d="M20 45c-7 9-6 26 2 34 8 8 17 3 18-5 1-9-4-17-7-25-2-7-9-10-13-4Z" fill={o.ear2} />
        <Path d="M80 45c7 9 6 26-2 34-8 8-17 3-18-5-1-9 4-17 7-25 2-7 9-10 13-4Z" fill={o.ear2} />
        <Path d="M35 23c7-7 23-7 30 0 5 5-4 9-15 9s-20-4-15-9Z" fill={o.ear2} />
      </>
    );
  }
  return (
    <>
      <Path d="M25 43 20 12l25 15-20 16Z" fill={o.ear2} />
      <Path d="M75 43 80 12 55 27l20 16Z" fill={o.ear2} />
      <Path d="M28 39 26 21l13 8-11 10Z" fill={o.coatDark} opacity={0.5} />
      <Path d="M72 39 74 21l-13 8 11 10Z" fill={o.coatDark} opacity={0.5} />
    </>
  );
}

/** Renders the pet-face illustration inside a 100x100 viewBox, exactly as the prototype's dogSvg(). */
export function DogFace({ art, gradId }: { art: DogArt; gradId: string }) {
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={art.bg1} />
          <Stop offset="1" stopColor={art.bg2} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill={`url(#${gradId})`} />
      {ears(art)}
      <Ellipse cx={50} cy={53} rx={27} ry={28} fill={art.coat} />
      <Path d="M50 25c-9 0-17 5-20 13 5-5 12-7 20-7s15 2 20 7c-3-8-11-13-20-13Z" fill={art.coatDark} opacity={0.45} />
      <Ellipse cx={50} cy={68} rx={15} ry={12} fill={art.muzzle} />
      <Ellipse cx={50} cy={62} rx={6} ry={4.6} fill="#26170F" />
      <Path
        d="M50 67v4m0 0c-2.6 3-7.2 2.6-8.2-.5M50 71c2.6 3 7.2 2.6 8.2-.5"
        stroke="#26170F"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={38.5} cy={49} rx={4.7} ry={5.3} fill="#26170F" />
      <Ellipse cx={61.5} cy={49} rx={4.7} ry={5.3} fill="#26170F" />
      <Circle cx={40.3} cy={47.1} r={1.7} fill="#fff" />
      <Circle cx={63.3} cy={47.1} r={1.7} fill="#fff" />
    </Svg>
  );
}
