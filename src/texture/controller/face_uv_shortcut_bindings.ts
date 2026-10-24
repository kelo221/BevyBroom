import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ControllerFaceUvTools } from './controller_face_uv_tools.js';

/** One keyboard binding: its settings action and the tool it runs. */
interface FaceUvShortcutBinding {
  actionId: KeyboardShortcutAction;
  run: (controller: ControllerFaceUvTools) => void;
}

/** Face UV keyboard bindings in registration order. */
const FACE_UV_SHORTCUT_BINDINGS: readonly FaceUvShortcutBinding[] = [
  { actionId: 'face_uv_nudge_left', run: (controller) => controller.nudgeOffset('left') },
  { actionId: 'face_uv_nudge_right', run: (controller) => controller.nudgeOffset('right') },
  { actionId: 'face_uv_nudge_up', run: (controller) => controller.nudgeOffset('up') },
  { actionId: 'face_uv_nudge_down', run: (controller) => controller.nudgeOffset('down') },
  { actionId: 'face_uv_rotate_ccw', run: (controller) => controller.rotateByGridStep(1) },
  { actionId: 'face_uv_rotate_cw', run: (controller) => controller.rotateByGridStep(-1) },
  { actionId: 'face_uv_flip_h', run: (controller) => controller.flip('horizontal') },
  { actionId: 'face_uv_flip_v', run: (controller) => controller.flip('vertical') },
  { actionId: 'face_uv_reset_face', run: (controller) => controller.resetToFace() },
  { actionId: 'face_uv_reset_world', run: (controller) => controller.resetToWorld() },
];

/**
 * Registers the face UV keyboard shortcuts. Every action runs only while face
 * mode has selected faces; otherwise it does nothing so other modes keep their
 * behaviour.
 *
 * @param keyboardShortcutHandler Keyboard handler receiving the callbacks.
 * @param controller Face UV tools controller.
 */
export function faceUvShortcutsRegister(
  keyboardShortcutHandler: HandlerKeyboardShortcut,
  controller: ControllerFaceUvTools,
): void {
  FACE_UV_SHORTCUT_BINDINGS.forEach((binding) => {
    keyboardShortcutHandler.actionCallbackSet(binding.actionId, () => bindingGuardedRun(binding, controller));
  });
}

/**
 * Runs one binding when the face mode gate allows it.
 *
 * @param binding Binding to run.
 * @param controller Face UV tools controller.
 */
function bindingGuardedRun(binding: FaceUvShortcutBinding, controller: ControllerFaceUvTools): void {
  if (!controller.faceModeHasSelectedFaces()) {
    return;
  }
  binding.run(controller);
}
