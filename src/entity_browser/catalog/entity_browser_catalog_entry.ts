import type { AddMenuCatalogObjectMatcher } from '@/layout/setup/add_menu_catalog.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** One placeable kind the entity browser lists as a tile. */
export interface EntityBrowserCatalogEntry {
  /** Stable identifier of the kind. */
  readonly id: string;
  /** Visible name. */
  readonly label: string;
  /** Category path, such as "Lights" or "Game Entities / Doors". */
  readonly category: string;
  /** Position of the category in Add menu order. */
  readonly categoryIndex: number;
  /** Position of the entry in Add menu order. */
  readonly catalogIndex: number;
  /** Icon drawn on the tile, or null for a text glyph. */
  readonly iconName: IconName | null;
  /** CSS color of the icon, or null for the default text color. */
  readonly iconColor: string | null;
  /** Extra help text such as a game type path; empty when none. */
  readonly tooltip: string;
  /** Recognizes scene objects of this kind, or null when usage is unknown. */
  readonly objectMatches: AddMenuCatalogObjectMatcher | null;
  /** Adds the kind the way its Add menu entry does. */
  readonly activate: () => void;
}
