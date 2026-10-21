import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { VIEWPORT_KIND_MENU_ORDER, ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';

/**
 * Builds menu entries for switching a viewport pane kind, with a check mark on
 * the active kind.
 *
 * @param currentKind Currently active kind for the pane.
 * @param onSelect Invoked when the user chooses a kind.
 * @returns Menu entries for MenuPanel.
 */
export function buildViewportTypeMenuEntries(
  currentKind: ViewportKind,
  onSelect: (kind: ViewportKind) => void,
): ToolbarMenuEntry[] {
  return VIEWPORT_KIND_MENU_ORDER.map((kind) => ({
    label: getViewportKindDisplayLabel(kind),
    onClick: () => onSelect(kind),
    isChecked: () => kind === currentKind,
  }));
}
