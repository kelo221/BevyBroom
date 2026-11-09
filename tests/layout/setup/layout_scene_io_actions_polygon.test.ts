import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyLayoutHistoryChange,
  handleLayoutSceneLoaded,
  type LayoutSceneRefreshContext,
} from '@/layout/setup/layout_scene_io_actions.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { polygonOutlineRecipeWrite } from '@/tools/polygon/polygon_outline_recipe.js';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import type { ControllerSnapSettings } from '@/tools/snap/controller_snap_settings.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';

/**
 * Builds a scene refresh context over a world with stubbed face and snap
 * helpers.
 *
 * @param worldObject World root.
 * @param commandStack Undo stack.
 * @returns Scene refresh context.
 */
function sceneRefreshContextCreate(worldObject: THREE.Object3D, commandStack: CommandStack): LayoutSceneRefreshContext {
  const faceExtrusionController = { clearFaceSelection: () => undefined, pruneInvalidFaceSelection: () => undefined };
  return {
    selectionManager: new ManagerSelection(),
    faceModeCoordinator: {
      getFaceExtrusionController: () => faceExtrusionController,
    } as unknown as CoordinatorFaceMode,
    commandStack,
    clipPlaneHandler: null,
    snapSettingsController: { rebakeWorldTexturesIfLocked: () => undefined } as unknown as ControllerSnapSettings,
    worldObject,
    propertiesPanel: {} as PanelProperties,
    refreshAfterWorldMutation: () => undefined,
  };
}

/**
 * Builds a brush carrying a square Polygon recipe and loads it into the Polygon
 * state for re-editing.
 *
 * @returns The brush being re-edited.
 */
function polygonEditingTargetLoad(): THREE.Object3D {
  const brush = new THREE.Object3D();
  polygonOutlineRecipeWrite(brush, {
    points2d: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    origin: [0, 0, 0],
    axisU: [1, 0, 0],
    axisV: [0, 0, 1],
    axisNormal: [0, 1, 0],
    extrusionMin: 0,
    extrusionMax: 1,
  });
  expect(getStatePolygonTool().loadFromTarget(brush)).toBe(true);
  return brush;
}

describe('scene IO keeps the Polygon state in sync with the world', () => {
  afterEach(() => {
    getStatePolygonTool().clear();
  });

  it('drops the outline and re-edit target when a scene is loaded or created', () => {
    const world = new THREE.Group();
    world.add(polygonEditingTargetLoad());
    handleLayoutSceneLoaded(sceneRefreshContextCreate(world, new CommandStack(4)));
    expect(getStatePolygonTool().verticesRead()).toHaveLength(0);
    expect(getStatePolygonTool().editingTargetRead()).toBeNull();
  });

  it('keeps the re-edit target across undo while it is still in the world', () => {
    const world = new THREE.Group();
    const brush = polygonEditingTargetLoad();
    world.add(brush);
    applyLayoutHistoryChange(sceneRefreshContextCreate(world, new CommandStack(4)), 'undo');
    expect(getStatePolygonTool().editingTargetRead()).toBe(brush);
  });

  it('forgets the re-edit target once undo removed it from the world', () => {
    const world = new THREE.Group();
    polygonEditingTargetLoad();
    applyLayoutHistoryChange(sceneRefreshContextCreate(world, new CommandStack(4)), 'redo');
    expect(getStatePolygonTool().editingTargetRead()).toBeNull();
  });
});
