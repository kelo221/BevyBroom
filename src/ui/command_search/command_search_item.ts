import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** One menu the command search lists the commands of. */
export interface CommandSearchMenuSource {
  /** Menu title, the first part of every command path. */
  readonly label: string;
  /**
   * Builds the menu entries as they are right now.
   *
   * @returns Menu entries.
   */
  entriesBuild(): ToolbarMenuEntry[];
}

/** One command the command search can find and run. */
export interface CommandSearchItem {
  /** Identity that stays the same between searches: path and label. */
  readonly key: string;
  /** Command label as shown in its menu. */
  readonly label: string;
  /** Menu and submenu titles leading to the command, outermost first. */
  readonly path: readonly string[];
  /** Shortcut label, or an empty string when the command has none. */
  readonly shortcut: string;
  /**
   * Returns whether the command can run now.
   *
   * @returns True when enabled.
   */
  readonly isEnabled: () => boolean;
  /** Runs the command. */
  readonly run: () => void;
}
