import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { sprinkleRadiusScaleByDoublings } from './sprinkle_radius_scale.js';

/** Keyboard handler part the Sprinkle radius shortcuts register with. */
export type SprinkleRadiusShortcutHost = Pick<HandlerKeyboardShortcut, 'actionCallbackSet'>;

/** One Sprinkle radius shortcut: its settings action and radius doublings. */
interface SprinkleRadiusShortcutBinding {
  readonly actionId: KeyboardShortcutAction;
  readonly doublings: number;
}

/** Sprinkle radius shortcuts: shrink halves the radius, grow doubles it. */
const SPRINKLE_RADIUS_SHORTCUT_BINDINGS: readonly SprinkleRadiusShortcutBinding[] = [
  { actionId: 'sprinkle_radius_shrink', doublings: -1 },
  { actionId: 'sprinkle_radius_grow', doublings: 1 },
];

/**
 * Registers the Sprinkle radius shrink and grow shortcuts. They are available
 * only while the Sprinkle tool is active; otherwise their keys stay free for
 * other shortcuts and the browser.
 *
 * @param host Keyboard handler receiving the callbacks.
 * @returns Function that removes the callbacks again.
 */
export function sprinkleRadiusShortcutsRegister(host: SprinkleRadiusShortcutHost): () => void {
  SPRINKLE_RADIUS_SHORTCUT_BINDINGS.forEach((binding) => {
    host.actionCallbackSet(
      binding.actionId,
      () => sprinkleRadiusScaleByDoublings(binding.doublings),
      sprinkleRadiusShortcutIsAvailable,
    );
  });
  return () => {
    SPRINKLE_RADIUS_SHORTCUT_BINDINGS.forEach((binding) => host.actionCallbackSet(binding.actionId, null));
  };
}

/**
 * Returns whether the Sprinkle radius shortcuts handle their keys now.
 *
 * @returns True while the Sprinkle tool is active.
 */
function sprinkleRadiusShortcutIsAvailable(): boolean {
  return getStateSprinkleTool().toolActiveRead();
}
