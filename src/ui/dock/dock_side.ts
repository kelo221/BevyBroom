/** Edges of the main window a tool window can dock to, in menu order. */
export const DOCK_SIDES = ['left', 'right', 'bottom'] as const;

/** Edge of the main window a tool window can dock to. */
export type DockSide = (typeof DOCK_SIDES)[number];

/** Menu labels of the dock edges. */
export const DOCK_SIDE_LABELS: Readonly<Record<DockSide, string>> = {
  left: 'Dock Left',
  right: 'Dock Right',
  bottom: 'Dock Bottom',
};

/**
 * Returns whether a value names a dock edge.
 *
 * @param value Value to check.
 * @returns True for left, right or bottom.
 */
export function dockSideIs(value: unknown): value is DockSide {
  return typeof value === 'string' && (DOCK_SIDES as readonly string[]).includes(value);
}
