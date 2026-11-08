import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RouterSprinklePointer } from '@/tools/sprinkle/pointer/router_sprinkle_pointer.js';
import { SprinklePointerViewportRouting } from '@/tools/sprinkle/pointer/sprinkle_pointer_viewport_routing.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  SPRINKLE_TEST_DEFINITION_NAME,
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  sprinkleTestViewCreate,
  type SprinkleTestView,
} from '../sprinkle_test_support.js';

/** Center of the floor's top face in the routing tests. */
const ROUTING_TEST_FLOOR_CENTER = new THREE.Vector3(1.4, -2.2, 0.9);

/** Client-point presses fed into the Sprinkle pointer router. */
describe('SprinklePointerViewportRouting', () => {
  let routing: SprinklePointerViewportRouting;
  let view: SprinkleTestView;
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall();
    const scene = sprinkleTestSceneCreate(ROUTING_TEST_FLOOR_CENTER, 30);
    view = sprinkleTestViewCreate(ROUTING_TEST_FLOOR_CENTER, new THREE.Vector3(0, 1, 0), 12);
    routing = new SprinklePointerViewportRouting(
      new RouterSprinklePointer({ ...scene.services, isCtrlDown: () => false }),
      () => [view],
    );
    getStateSprinkleTool().toolActiveWrite(true);
    getStateSprinkleTool().configPatch({ definitionName: SPRINKLE_TEST_DEFINITION_NAME, densityPercent: 100 });
  });

  afterEach(() => {
    routing.router.dispose();
    getStateSprinkleTool().reset();
    uninstall();
  });

  it('holds a left press in the viewport under it until that button is released', () => {
    expect(routing.pressBegin(view.centerClientX, view.centerClientY, 0, null)).toBe(true);
    expect(routing.isPressHeldBy(0)).toBe(true);
    expect(routing.isPressHeldBy(2)).toBe(false);
    routing.pressMove(view.centerClientX + 15, view.centerClientY);
    expect(routing.pressEnd(2)).toBeNull();
    expect(routing.pressEnd(0)?.added).toBeGreaterThan(0);
    expect(routing.isPressActive()).toBe(false);
  });

  it('ignores the middle button and presses outside every viewport', () => {
    expect(routing.pressBegin(view.centerClientX, view.centerClientY, 1, null)).toBe(false);
    expect(routing.pressBegin(-50, -50, 0, null)).toBe(false);
    expect(routing.isPressActive()).toBe(false);
  });
});
