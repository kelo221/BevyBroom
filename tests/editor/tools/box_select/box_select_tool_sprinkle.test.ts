import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BoxSelectTool } from '@/editor/tools/box_select/box_select_tool.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { BRUSH_RESIZE_PIXELS_PER_DOUBLING } from '@/tools/brush_resize/brush_resize_radius.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { RouterSprinklePointer } from '@/tools/sprinkle/pointer/router_sprinkle_pointer.js';
import { sprinklePointerRoutingSharedInstall } from '@/tools/sprinkle/pointer/sprinkle_pointer_routing_shared.js';
import { SprinklePointerViewportRouting } from '@/tools/sprinkle/pointer/sprinkle_pointer_viewport_routing.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { editorTestServicesCreate } from '../../editor_test_services.js';
import {
  SPRINKLE_TEST_DEFINITION_NAME,
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  sprinkleTestViewCreate,
  type SprinkleTestScene,
  type SprinkleTestView,
} from '../../../tools/sprinkle/sprinkle_test_support.js';

/** Center of the floor's top face in the object tool Sprinkle tests. */
const BOX_SELECT_SPRINKLE_TEST_FLOOR_CENTER = new THREE.Vector3(2.3, 0.4, -1.8);

/**
 * Moves the editor's pointer and sends a drag sample to the tool.
 *
 * @param tool Object tool.
 * @param editor Editor window.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param button Button reported with the drag.
 */
function boxSelectSprinkleTestDrag(
  tool: BoxSelectTool,
  editor: EditorWindow,
  clientX: number,
  clientY: number,
  button: number,
): void {
  editor.lastPointerClientX = clientX;
  editor.lastPointerClientY = clientY;
  tool.onGlobalMouseDrag(button, new THREE.Vector2(), new THREE.Vector2());
}

/**
 * The object tool hands presses over surfaces to the Sprinkle tool while it is
 * active: left drags paint without selecting, right drags resize the brush and
 * keep the press from the view navigation.
 */
describe('BoxSelectTool with the Sprinkle tool', () => {
  let scene: SprinkleTestScene;
  let view: SprinkleTestView;
  let tool: BoxSelectTool;
  let editor: EditorWindow;
  let objectClick: ReturnType<typeof vi.fn<EditorServices['applyObjectClickSelectionAtClientPoint']>>;
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    cleanups.push(sprinkleTestLibraryInstall());
    scene = sprinkleTestSceneCreate(BOX_SELECT_SPRINKLE_TEST_FLOOR_CENTER, 30);
    view = sprinkleTestViewCreate(BOX_SELECT_SPRINKLE_TEST_FLOOR_CENTER, new THREE.Vector3(0, 1, 0), 10);
    const router = new RouterSprinklePointer({ ...scene.services, isCtrlDown: () => false });
    cleanups.push(sprinklePointerRoutingSharedInstall(new SprinklePointerViewportRouting(router, () => [view])));
    getStateSprinkleTool().toolActiveWrite(true);
    getStateSprinkleTool().configPatch({ definitionName: SPRINKLE_TEST_DEFINITION_NAME, densityPercent: 100 });
    objectClick = vi.fn<EditorServices['applyObjectClickSelectionAtClientPoint']>();
    editor = new EditorWindow();
    editor.setServices(editorTestServicesCreate({ applyObjectClickSelectionAtClientPoint: objectClick }));
    editor.validateTools();
    tool = new BoxSelectTool();
    tool.editor = editor;
    editor.lastPointerClientX = view.centerClientX;
    editor.lastPointerClientY = view.centerClientY;
  });

  afterEach(() => {
    getStateSprinkleTool().reset();
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('paints a left drag as one undo step without selecting', () => {
    tool.onMouseDown(0);
    expect(tool.isBusy()).toBe(true);
    boxSelectSprinkleTestDrag(tool, editor, view.centerClientX + 20, view.centerClientY, 0);
    tool.onGlobalMouseUp(0);
    expect(tool.isBusy()).toBe(false);
    expect(SprinkleMark.objectsCollect(scene.world).length).toBeGreaterThan(0);
    expect(scene.commandStack.getUndoCount()).toBe(1);
    expect(objectClick).not.toHaveBeenCalled();
  });

  it('resizes the brush with a right drag and claims the press from navigation', () => {
    const startRadius = getStateSprinkleTool().configRead().radius;
    tool.onMouseDown(2);
    expect(tool.claimsViewportNavigationPress(2)).toBe(true);
    boxSelectSprinkleTestDrag(
      tool,
      editor,
      view.centerClientX - BRUSH_RESIZE_PIXELS_PER_DOUBLING,
      view.centerClientY,
      1,
    );
    tool.onGlobalMouseUp(2);
    expect(getStateSprinkleTool().configRead().radius).toBeCloseTo(startRadius / 2, 9);
    expect(tool.claimsViewportNavigationPress(2)).toBe(false);
    expect(SprinkleMark.objectsCollect(scene.world)).toEqual([]);
  });

  it('leaves right presses off every surface to the view navigation', () => {
    editor.lastPointerClientY = -400;
    tool.onMouseDown(2);
    expect(tool.claimsViewportNavigationPress(2)).toBe(false);
  });
});
