import { vi } from 'vitest';
import type { CommandSearchItem, CommandSearchMenuSource } from '@/ui/command_search/command_search_item.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** A command search item whose run is a spy. */
export interface CommandSearchTestItem extends CommandSearchItem {
  readonly run: ReturnType<typeof vi.fn<() => void>>;
}

/**
 * Builds a command with a spy run.
 *
 * @param label Command label.
 * @param path Menu titles leading to the command.
 * @param isEnabled Whether the command can run.
 * @returns Command.
 */
export function commandSearchTestItemCreate(
  label: string,
  path: readonly string[] = ['Edit'],
  isEnabled = true,
): CommandSearchTestItem {
  return {
    key: [...path, label].join('/'),
    label,
    path,
    shortcut: '',
    isEnabled: () => isEnabled,
    run: vi.fn<() => void>(),
  };
}

/**
 * Builds a menu source that returns fixed entries.
 *
 * @param label Menu title.
 * @param entries Entries the menu builds.
 * @returns Menu source.
 */
export function commandSearchTestSourceCreate(label: string, entries: ToolbarMenuEntry[]): CommandSearchMenuSource {
  return { label, entriesBuild: () => entries };
}
