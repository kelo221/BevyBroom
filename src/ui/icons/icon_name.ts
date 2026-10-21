/** Every icon name the editor can draw. */
export const ICON_NAMES = [
  'crosshairs',
  'cube-outline',
  'cylinder',
  'door-closed',
  'door-open',
  'fire',
  'flash',
  'floor-plan',
  'image-outline',
  'lightbulb',
  'puzzle',
  'rounded-corner',
  'shape-outline',
  'shimmer',
  'sphere',
  'spotlight-beam',
  'square-outline',
  'terrain',
  'weather-fog',
] as const;

/** Name of one icon in the editor icon set. */
export type IconName = (typeof ICON_NAMES)[number];
