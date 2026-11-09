import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputHeldButtons } from '@/editor/window/editor_input_held_buttons.js';
import { EditorStalePressRelease } from '@/editor/window/editor_stale_press_release.js';
import { RouterSprinklePointer } from '@/tools/sprinkle/pointer/router_sprinkle_pointer.js';
import { sprinklePointerRoutingSharedInstall } from '@/tools/sprinkle/pointer/sprinkle_pointer_routing_shared.js';
import { SprinklePointerViewportRouting } from '@/tools/sprinkle/pointer/sprinkle_pointer_viewport_routing.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { editorTestServicesCreate } from '../editor_test_services.js';
import {
  SPRINKLE_TEST_DEFINITION_NAME,
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  sprinkleTestViewCreate,
} from '../../tools/sprinkle/sprinkle_test_support.js';

/** Center of the floor the Sprinkle resize press is made over. */
const STALE_PRESS_SPRINKLE_FLOOR_CENTER = new THREE.Vector3(1.5, 0.2, -2.5);

/** Mouse button index of the right button. */
const STALE_PRESS_RIGHT_BUTTON = 2;

/**
 * Builds a held-buttons tracker that last saw the given buttons bitfield.
 *
 * @param buttons Held buttons bitfield.
 * @returns Tracker.
 */
function heldButtonsWith(buttons: number): EditorInputHeldButtons {
  const heldButtons = new EditorInputHeldButtons();
  heldButtons.record(new PointerEvent('pointermove', { buttons }));
  return heldButtons;
}

describe('EditorStalePressRelease with a Sprinkle right-button resize', () => {
  let editor: EditorWindow;
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    cleanups.push(sprinkleTestLibraryInstall());
    const scene = sprinkleTestSceneCreate(STALE_PRESS_SPRINKLE_FLOOR_CENTER, 30);
    const view = sprinkleTestViewCreate(STALE_PRESS_SPRINKLE_FLOOR_CENTER, new THREE.Vector3(0, 1, 0), 10);
    const router = new RouterSprinklePointer({ ...scene.services, isCtrlDown: () => false });
    cleanups.push(sprinklePointerRoutingSharedInstall(new SprinklePointerViewportRouting(router, () => [view])));
    getStateSprinkleTool().toolActiveWrite(true);
    getStateSprinkleTool().configPatch({ definitionName: SPRINKLE_TEST_DEFINITION_NAME });
    editor = new EditorWindow();
    editor.setServices(editorTestServicesCreate());
    editor.validateTools();
    editor.lastPointerClientX = view.centerClientX;
    editor.lastPointerClientY = view.centerClientY;
    editor.onMouseDown(STALE_PRESS_RIGHT_BUTTON);
  });

  afterEach(() => {
    getStateSprinkleTool().reset();
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('keeps a held right-button resize when a tool shortcut asks whether the tool is busy', () => {
    expect(editor.isActiveEventReceiverBusy).toBe(true);
    const heldButtons = heldButtonsWith(STALE_PRESS_RIGHT_BUTTON);
    expect(EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editor, heldButtons)).toBe(true);
  });

  it('drops the resize once the browser reports the right button up', () => {
    expect(EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editor, heldButtonsWith(0))).toBe(false);
  });
});
