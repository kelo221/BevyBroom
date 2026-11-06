/** Three tones of one colour family, lit from the top left. */
export interface IconHammerRamp {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
}

/** Dark outline drawn around every shape of the classic icon set. */
export const ICON_HAMMER_OUTLINE = '#000000';

/** Soft grey for hidden edges and secondary strokes. */
export const ICON_HAMMER_OUTLINE_SOFT = '#808080';

/** Bright edge highlight on lit bevels. */
export const ICON_HAMMER_HIGHLIGHT = '#ffffff';

/** Colour families of the classic Hammer icon art. */
export const ICON_HAMMER_RAMPS = {
  red: { light: '#ff7a6a', base: '#d82818', dark: '#7c0c04' },
  brick: { light: '#f0a080', base: '#c0502c', dark: '#6c2410' },
  green: { light: '#a0ee88', base: '#30b020', dark: '#126008' },
  blue: { light: '#9ccaff', base: '#2a6ade', dark: '#0c2a7c' },
  yellow: { light: '#fff8a0', base: '#f4cc18', dark: '#8c6a00' },
  orange: { light: '#ffc878', base: '#f08c14', dark: '#8c4400' },
  white: { light: '#ffffff', base: '#e4e4e4', dark: '#a4a4a4' },
  steel: { light: '#e0e4ec', base: '#9aa2b2', dark: '#4a5262' },
  glass: { light: '#f0faff', base: '#a4d6f4', dark: '#4282ba' },
  wood: { light: '#e4ac6a', base: '#a8682c', dark: '#5c3410' },
  purple: { light: '#d8b0ff', base: '#8c40dc', dark: '#42187c' },
  coal: { light: '#7a7a7a', base: '#383838', dark: '#0c0c0c' },
  cyan: { light: '#a4f4f4', base: '#18b0c4', dark: '#085a66' },
} as const satisfies Record<string, IconHammerRamp>;
