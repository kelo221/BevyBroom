import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PlayerSystem, type PlayerSystemHost } from '@/player/player_system.js';
import {
  playerCharacterLoadModelFromArrayBuffer,
  playerCharacterResetModelLoader,
} from '@/player/character/player_character_model_loader.js';
import { ViewportToolbar } from '@/ui/viewport_chrome/viewport_toolbar.js';
import { VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL } from '@/ui/viewport_chrome/viewport_type_menu.js';
import { ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import type { ManagerInput } from '@/input/manager_input.js';
import type { EditorWindow } from '@/editor/window/editor_window.js';

/** Perspective viewport stand-in with a real toolbar and camera. */
interface PlayerSystemTestViewport {
  viewport: Viewport3D;
  toolbar: ViewportToolbar;
  camera: THREE.PerspectiveCamera;
}

/**
 * Creates a perspective viewport stand-in that play mode can enter.
 *
 * @returns Viewport, its toolbar and its camera.
 */
function playerSystemTestViewportCreate(): PlayerSystemTestViewport {
  const toolbar = new ViewportToolbar(
    document.createElement('div'),
    getViewportKindDisplayLabel(ViewportKind.PERSPECTIVE),
  );
  toolbar.setViewportKind(ViewportKind.PERSPECTIVE);
  const camera = new THREE.PerspectiveCamera();
  const viewport = {
    getViewportToolbar: () => toolbar,
    getCamera: () => camera,
    getContentElement: () => document.createElement('div'),
    setFlyingCameraEnabled: vi.fn(),
    syncFlyingCameraOrientation: vi.fn(),
  } as unknown as Viewport3D;
  return { viewport, toolbar, camera };
}

/**
 * Creates a player system host over perspective viewport stand-ins.
 *
 * @param viewports Perspective viewports the host reports.
 * @param editorWindow Editor window the play tool is handed to.
 * @returns Player system host.
 */
function playerSystemTestHostCreate(viewports: readonly Viewport3D[], editorWindow: EditorWindow): PlayerSystemHost {
  return {
    worldRoot: new THREE.Group(),
    inputManager: { isKeyDown: () => false, isCtrlDown: () => false } as unknown as ManagerInput,
    getEditorWindow: () => editorWindow,
    getPerspectiveViewports: () => viewports,
    showStatusMessage: vi.fn(),
  };
}

/**
 * Creates an idle editor window stand-in that records the tool it is given.
 *
 * @returns Editor window stand-in.
 */
function playerSystemTestEditorWindowCreate(): EditorWindow {
  return { activeTool: null, useTool: vi.fn() } as unknown as EditorWindow;
}

/**
 * Clicks the Play from here row of a toolbar view menu.
 *
 * @param toolbar Toolbar whose menu is used.
 */
function playerSystemTestPlayFromHereClick(toolbar: ViewportToolbar): void {
  toolbar.getTitleElement().click();
  const row = Array.from(toolbar.getViewMenuPanel()?.getElement().querySelectorAll('button') ?? []).find((button) =>
    (button.textContent ?? '').includes(VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL),
  );
  if (!row) {
    throw new Error('Play from here row missing');
  }
  row.click();
}

describe('PlayerSystem', () => {
  const systems: PlayerSystem[] = [];

  beforeAll(async () => {
    playerCharacterResetModelLoader();
    const buffer = readFileSync(resolve(process.cwd(), 'src/player/assets/character.glb'));
    await playerCharacterLoadModelFromArrayBuffer(buffer);
  });

  afterEach(() => {
    systems.splice(0).forEach((system) => system.dispose());
  });

  it('offers Play from here on every perspective viewport menu', () => {
    const viewports = [playerSystemTestViewportCreate(), playerSystemTestViewportCreate()];
    const host = playerSystemTestHostCreate(
      viewports.map((entry) => entry.viewport),
      playerSystemTestEditorWindowCreate(),
    );
    systems.push(new PlayerSystem(host));
    viewports.forEach((entry) => expect(entry.toolbar.isPlayFromHereAvailable()).toBe(true));
  });

  it('starts play mode in the viewport whose menu was used', () => {
    const viewports = [playerSystemTestViewportCreate(), playerSystemTestViewportCreate()];
    const chosen = viewports[1];
    if (!chosen) {
      throw new Error('Viewport missing');
    }
    const editorWindow = playerSystemTestEditorWindowCreate();
    const system = new PlayerSystem(
      playerSystemTestHostCreate(
        viewports.map((entry) => entry.viewport),
        editorWindow,
      ),
    );
    systems.push(system);
    playerSystemTestPlayFromHereClick(chosen.toolbar);
    expect(system.getIsPlaying()).toBe(true);
    expect(editorWindow.useTool).toHaveBeenCalledOnce();
    expect(chosen.viewport.setFlyingCameraEnabled).toHaveBeenCalledWith(false);
    expect(viewports[0]?.viewport.setFlyingCameraEnabled).not.toHaveBeenCalled();
  });

  it('removes Play from here from the menus on dispose', () => {
    const entry = playerSystemTestViewportCreate();
    const system = new PlayerSystem(playerSystemTestHostCreate([entry.viewport], playerSystemTestEditorWindowCreate()));
    system.dispose();
    expect(entry.toolbar.isPlayFromHereAvailable()).toBe(false);
  });

  it('moves Play from here to the new viewport set on refresh without duplicates', () => {
    const kept = playerSystemTestViewportCreate();
    const dropped = playerSystemTestViewportCreate();
    const added = playerSystemTestViewportCreate();
    const liveViewports: Viewport3D[] = [kept.viewport, dropped.viewport];
    const system = new PlayerSystem(playerSystemTestHostCreate(liveViewports, playerSystemTestEditorWindowCreate()));
    systems.push(system);
    const spies = [kept, dropped, added].map((entry) => vi.spyOn(entry.toolbar, 'setOnPlayFromHere'));
    liveViewports.splice(0, liveViewports.length, kept.viewport, added.viewport);
    system.refreshViewportChrome();
    expect(dropped.toolbar.isPlayFromHereAvailable()).toBe(false);
    expect(spies[1]?.mock.calls).toEqual([[null]]);
    expect(spies[2]?.mock.calls.filter((call) => call[0] !== null)).toHaveLength(1);
    expect(spies[0]?.mock.calls.filter((call) => call[0] !== null)).toHaveLength(1);
    expect(kept.toolbar.isPlayFromHereAvailable()).toBe(true);
    expect(added.toolbar.isPlayFromHereAvailable()).toBe(true);
  });

  it('starts play mode from the Play command once and refuses while already playing', () => {
    const entry = playerSystemTestViewportCreate();
    const editorWindow = playerSystemTestEditorWindowCreate();
    const system = new PlayerSystem(playerSystemTestHostCreate([entry.viewport], editorWindow));
    systems.push(system);
    expect(system.playModeStart()).toBe(true);
    expect(system.getIsPlaying()).toBe(true);
    expect(entry.viewport.setFlyingCameraEnabled).toHaveBeenCalledWith(false);
    expect(system.playModeStart()).toBe(false);
    expect(editorWindow.useTool).toHaveBeenCalledOnce();
  });

  it('does not start play mode without a perspective viewport', () => {
    const editorWindow = playerSystemTestEditorWindowCreate();
    const system = new PlayerSystem(playerSystemTestHostCreate([], editorWindow));
    systems.push(system);
    expect(system.playModeStart()).toBe(false);
    expect(system.getIsPlaying()).toBe(false);
    expect(editorWindow.useTool).not.toHaveBeenCalled();
  });
});
