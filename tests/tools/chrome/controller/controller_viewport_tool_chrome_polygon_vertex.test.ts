import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  ControllerViewportToolChrome,
  VIEWPORT_TOOL_CHROME_STATUS_VERTEX_NEEDS_SELECTION,
  VIEWPORT_TOOL_CHROME_STATUS_VERTEX_READY,
  type ControllerViewportToolChromeDependencies,
} from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { EditorInteractionMode } from '@/types/editor_interaction_mode.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { getStateBlockDrawSettings } from '@/tools/block/state_block_draw_settings.js';
import { getStateTextureStampTool } from '@/tools/texture_stamp/state_texture_stamp_tool.js';

/** Spies for the editor tool switches a controller test inspects. */
interface ControllerFixtureSpies {
  showStatus: ReturnType<typeof vi.fn<(message: string) => void>>;
  switchToPolygonTool: ReturnType<typeof vi.fn<(onLeft: () => void) => void>>;
  switchToObjectSelect: ReturnType<typeof vi.fn<() => void>>;
  switchToEditSelect: ReturnType<typeof vi.fn<() => void>>;
}

/** Controller under test together with its spies. */
interface ControllerFixture extends ControllerFixtureSpies {
  controller: ControllerViewportToolChrome;
}

/**
 * Builds a tool chrome controller wired to spies for the editor tool switches.
 *
 * @param enterEditModeResult Value the Edit Mode session opener returns.
 * @returns Controller and its spies.
 */
function controllerFixtureCreate(enterEditModeResult: boolean): ControllerFixture {
  const fixtureSpies: ControllerFixtureSpies = {
    showStatus: vi.fn<(message: string) => void>(),
    switchToPolygonTool: vi.fn<(onLeft: () => void) => void>(),
    switchToObjectSelect: vi.fn<() => void>(),
    switchToEditSelect: vi.fn<() => void>(),
  };
  const controller = new ControllerViewportToolChrome(controllerDepsCreate(fixtureSpies, enterEditModeResult));
  controller.attachPane(document.createElement('div'));
  return { controller, ...fixtureSpies };
}

/**
 * Builds controller dependencies around real helpers and the given spies.
 *
 * @param fixtureSpies Spies for the editor tool switches and status.
 * @param enterEditModeResult Value the Edit Mode session opener returns.
 * @returns Controller dependencies.
 */
function controllerDepsCreate(
  fixtureSpies: ControllerFixtureSpies,
  enterEditModeResult: boolean,
): ControllerViewportToolChromeDependencies {
  const clipTool = new ToolClipPlane();
  return {
    faceExtrusionController: controllerFaceExtrusionCreate(),
    clipPlaneTool: clipTool,
    clipPlaneHandler: { cancel: () => clipTool.deactivate() } as unknown as HandlerClipPlane,
    selectionManager: new ManagerSelection(),
    editorOverlayPolicy: new PolicyEditorOverlay(),
    modalToolSessionRegistry: new RegistryModalToolSession(),
    showStatusMessage: fixtureSpies.showStatus,
    onTransformMode: () => undefined,
    faceInspectorReveal: () => undefined,
    onExtrudeFaces: () => undefined,
    onStampCurrentTexture: () => undefined,
    switchToPolygonTool: fixtureSpies.switchToPolygonTool,
    switchToObjectSelect: fixtureSpies.switchToObjectSelect,
    switchToEditSelect: fixtureSpies.switchToEditSelect,
    onEnterEditMode: () => enterEditModeResult,
  };
}

/**
 * Builds a face extrusion controller over an empty scene.
 *
 * @returns Face extrusion controller.
 */
function controllerFaceExtrusionCreate(): ControllerFaceExtrusion {
  return new ControllerFaceExtrusion(new THREE.Scene(), new CommandStack(8), new GridSnap(false, 1), new THREE.Group());
}

/**
 * Reads whether any click-owning tool still reports itself active.
 *
 * @returns True while Block, Entity, Polygon, Sprinkle or Stamp is flagged
 *   active.
 */
function anyHammerToolFlagActive(): boolean {
  return (
    getStateBlockDrawSettings().blockToolActiveRead() ||
    getStateEntityPlace().toolActiveRead() ||
    getStatePolygonTool().toolActiveRead() ||
    getStateSprinkleTool().toolActiveRead() ||
    getStateTextureStampTool().toolActiveRead()
  );
}

describe('ControllerViewportToolChrome Polygon and Vertex tools', () => {
  afterEach(() => {
    getStatePolygonTool().toolActiveWrite(false);
    getStateEntityPlace().toolActiveWrite(false);
    getStateSprinkleTool().toolActiveWrite(false);
    getStateBlockDrawSettings().blockToolActiveWrite(false);
    getStateTextureStampTool().toolActiveWrite(false);
  });

  it('switches the editor to the dedicated Polygon tool instead of object select', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.switchToObjectSelect.mockClear();
    fixture.controller.selectTool(EditorToolId.POLYGON);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.POLYGON);
    expect(fixture.switchToPolygonTool).toHaveBeenCalledTimes(1);
    expect(fixture.switchToObjectSelect).not.toHaveBeenCalled();
    expect(getStatePolygonTool().toolActiveRead()).toBe(true);
  });

  it('returns the rail to Object Select when the editor leaves the Polygon tool on its own', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    const onLeft = fixture.switchToPolygonTool.mock.calls[0]?.[0];
    expect(onLeft).toBeTypeOf('function');
    onLeft?.();
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.OBJECT);
    expect(getStatePolygonTool().toolActiveRead()).toBe(false);
  });

  it('ignores a stale Polygon leave after another rail tool was chosen', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    const onLeft = fixture.switchToPolygonTool.mock.calls[0]?.[0];
    fixture.controller.selectTool(EditorToolId.SPRINKLE);
    onLeft?.();
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.SPRINKLE);
    expect(getStateSprinkleTool().toolActiveRead()).toBe(true);
  });

  it('turns the Polygon flag off when another tool is chosen after Polygon', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    fixture.controller.selectTool(EditorToolId.BLOCK);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.BLOCK);
    expect(getStatePolygonTool().toolActiveRead()).toBe(false);
    fixture.controller.selectTool(EditorToolId.OBJECT);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.OBJECT);
  });

  it('opens Vertex Edit Mode, clears every other tool flag and reports how to use it', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    fixture.controller.selectTool(EditorToolId.VERTEX);
    expect(fixture.controller.getActiveInteractionMode()).toBe(EditorInteractionMode.EDIT_MODE);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.VERTEX);
    expect(fixture.controller.getActiveComponentMode()).toBe(EditorComponentMode.VERTEX);
    expect(anyHammerToolFlagActive()).toBe(false);
    expect(fixture.switchToEditSelect).toHaveBeenCalled();
    expect(fixture.showStatus.mock.calls.at(-1)?.[0]).toBe(VIEWPORT_TOOL_CHROME_STATUS_VERTEX_READY);
  });

  it('returns to Object Select and asks for a brush when Vertex finds nothing editable', () => {
    const fixture = controllerFixtureCreate(false);
    fixture.controller.selectTool(EditorToolId.SPRINKLE);
    fixture.controller.selectTool(EditorToolId.VERTEX);
    expect(fixture.controller.getActiveInteractionMode()).toBe(EditorInteractionMode.OBJECT_MODE);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.OBJECT);
    expect(anyHammerToolFlagActive()).toBe(false);
    expect(fixture.showStatus.mock.calls.at(-1)?.[0]).toBe(VIEWPORT_TOOL_CHROME_STATUS_VERTEX_NEEDS_SELECTION);
  });

  it('leaves Vertex Edit Mode and activates the chosen Object Mode tool', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.VERTEX);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    expect(fixture.controller.getActiveInteractionMode()).toBe(EditorInteractionMode.OBJECT_MODE);
    expect(fixture.controller.getActiveTool()).toBe(EditorToolId.POLYGON);
    expect(getStatePolygonTool().toolActiveRead()).toBe(true);
    expect(fixture.switchToPolygonTool).toHaveBeenCalledTimes(1);
  });

  it('clears the Sprinkle and Polygon flags on every path that leaves them', () => {
    const leavingPaths: ReadonlyArray<readonly [string, (controller: ControllerViewportToolChrome) => void]> = [
      ['Shift+Tab face mode', (controller) => controller.onExternalSelectionModeChanged(SelectionMode.FACE)],
      ['external object mode', (controller) => controller.onExternalSelectionModeChanged(SelectionMode.OBJECT)],
      ['Tab Edit Mode', (controller) => controller.toggleInteractionMode()],
      ['Vertex tool', (controller) => controller.selectTool(EditorToolId.VERTEX)],
    ];
    for (const toolId of [EditorToolId.SPRINKLE, EditorToolId.POLYGON]) {
      for (const [pathName, leave] of leavingPaths) {
        const fixture = controllerFixtureCreate(true);
        fixture.controller.selectTool(toolId);
        expect(anyHammerToolFlagActive(), `${toolId} active before ${pathName}`).toBe(true);
        leave(fixture.controller);
        expect(anyHammerToolFlagActive(), `${toolId} flag after ${pathName}`).toBe(false);
        fixture.controller.dispose();
      }
    }
  });

  it('turns a tool flag back on when Edit Mode returns to Object Mode with that tool', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.VERTEX);
    fixture.controller.selectTool(EditorToolId.SPRINKLE);
    expect(getStateSprinkleTool().toolActiveRead()).toBe(true);
    expect(getStatePolygonTool().toolActiveRead()).toBe(false);
  });

  it('clears the Polygon flag when Tab opens Edit Mode', () => {
    const fixture = controllerFixtureCreate(true);
    fixture.controller.selectTool(EditorToolId.POLYGON);
    fixture.controller.toggleInteractionMode();
    expect(fixture.controller.getActiveInteractionMode()).toBe(EditorInteractionMode.EDIT_MODE);
    expect(getStatePolygonTool().toolActiveRead()).toBe(false);
  });
});
