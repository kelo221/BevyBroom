/**
 * Which pieces a clip keeps. Side A lies on the side the plane normal points
 * to, Side B on the other side; Both keeps the two pieces as separate brushes.
 */
export enum ClipKeepMode {
  SIDE_A = 'side_a',
  SIDE_B = 'side_b',
  BOTH = 'both',
}

/** Order the keep modes cycle through. */
export const CLIP_KEEP_MODE_CYCLE_ORDER: readonly ClipKeepMode[] = [
  ClipKeepMode.SIDE_A,
  ClipKeepMode.SIDE_B,
  ClipKeepMode.BOTH,
];

/**
 * Returns the keep mode that follows a mode in the cycle order.
 *
 * @param mode Current keep mode.
 * @returns Next keep mode, wrapping from Both back to Side A.
 */
export function clipKeepModeNext(mode: ClipKeepMode): ClipKeepMode {
  const index = CLIP_KEEP_MODE_CYCLE_ORDER.indexOf(mode);
  const nextIndex = (index + 1) % CLIP_KEEP_MODE_CYCLE_ORDER.length;
  return CLIP_KEEP_MODE_CYCLE_ORDER[nextIndex] ?? ClipKeepMode.SIDE_A;
}

/**
 * Returns the short label of a keep mode for buttons and status text.
 *
 * @param mode Keep mode.
 * @returns Label such as "Side A".
 */
export function clipKeepModeLabel(mode: ClipKeepMode): string {
  if (mode === ClipKeepMode.SIDE_A) return 'Side A';
  if (mode === ClipKeepMode.SIDE_B) return 'Side B';
  return 'Both';
}

/**
 * Returns whether a keep mode keeps the piece on the side the plane normal
 * points to.
 *
 * @param mode Keep mode.
 * @returns True for Side A and Both.
 */
export function clipKeepModeKeepsFront(mode: ClipKeepMode): boolean {
  return mode !== ClipKeepMode.SIDE_B;
}

/**
 * Returns whether a keep mode keeps the piece on the side opposite the plane
 * normal.
 *
 * @param mode Keep mode.
 * @returns True for Side B and Both.
 */
export function clipKeepModeKeepsBack(mode: ClipKeepMode): boolean {
  return mode !== ClipKeepMode.SIDE_A;
}
