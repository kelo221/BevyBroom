import type { IconHammerIdScope } from './icon_hammer_id_scope.js';

/** Draws the inner markup of one icon on the 32 by 32 icon grid. */
export type IconHammerDrawer = (scope: IconHammerIdScope) => string;

/**
 * Base of every group of classic Hammer icons. A group draws a related set of
 * icons and lists its drawers by icon name.
 */
export abstract class IconHammerGroup<GroupIconName extends string> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  abstract drawersRead(): Readonly<Record<GroupIconName, IconHammerDrawer>>;
}
