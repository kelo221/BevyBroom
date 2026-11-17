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
 * Sizes of the generated pieces, in meters. They are fixed so every mover of a
 * game looks alike; the fields only set the ends, the width and the speed.
 */
export const PROCEDURAL_PEOPLE_MOVER_SIZES = {
  beltThickness: 0.15,
  trussDepth: 0.4,
  stepRiserMax: 0.21,
  landingLength: 1.2,
  landingThickness: 0.05,
  panelHeight: 1.0,
  panelThickness: 0.1,
  railHeight: 0.08,
  railWidth: 0.14,
  carHeight: 2.2,
  carHeadroom: 0.3,
  postSize: 0.1,
  placeholderRadius: 0.05,
} as const;
