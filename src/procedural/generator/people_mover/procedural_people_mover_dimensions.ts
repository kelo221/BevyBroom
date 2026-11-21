/** Material slot of the belt, the steps and the landing plates. */
export const PROCEDURAL_PEOPLE_MOVER_SLOT_TREAD = 'tread';

/** Material slot of the side panels and the truss under the steps. */
export const PROCEDURAL_PEOPLE_MOVER_SLOT_PANELS = 'panels';

/** Material slot of the handrails. */
export const PROCEDURAL_PEOPLE_MOVER_SLOT_RAILS = 'rails';

/** Material slot of the elevator car. */
export const PROCEDURAL_PEOPLE_MOVER_SLOT_CAR = 'car';

/** Material slot of the elevator shaft frame. */
export const PROCEDURAL_PEOPLE_MOVER_SLOT_FRAME = 'frame';

/** Part name of the elevator car, the node the game moves. */
export const PROCEDURAL_PEOPLE_MOVER_PART_CAR = 'Car';

/**
 * Brush size every structural piece of a people mover is a whole multiple of,
 * in meters.
 */
export const PROCEDURAL_PEOPLE_MOVER_BRUSH_SIZE = 0.25;

/**
 * Sizes of the generated pieces, in meters. They are fixed so every mover of a
 * game looks alike; the fields only set the ends, the width and the speed.
 * Every structural size is a whole multiple of
 * {@link PROCEDURAL_PEOPLE_MOVER_BRUSH_SIZE}, so a mover whose ends and width
 * lie on that grid meets the level's brushes flush. The step riser limit only
 * sets how many steps an escalator draws, and the placeholder radius only draws
 * a marker.
 */
export const PROCEDURAL_PEOPLE_MOVER_SIZES = {
  beltThickness: 0.25,
  trussDepth: 0.5,
  stepRiserMax: 0.21,
  landingLength: 1.25,
  landingThickness: 0.25,
  panelHeight: 1.0,
  panelThickness: 0.25,
  railHeight: 0.25,
  railWidth: 0.25,
  carHeight: 2.25,
  carHeadroom: 0.25,
  postSize: 0.25,
  placeholderRadius: 0.05,
} as const;

/** Sizes of the generated pieces that are not structure and keep any value. */
export const PROCEDURAL_PEOPLE_MOVER_SIZES_OFF_GRID: ReadonlySet<keyof typeof PROCEDURAL_PEOPLE_MOVER_SIZES> = new Set([
  'stepRiserMax',
  'placeholderRadius',
]);
