import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { ControllerFaceUvTools } from '@/texture/controller/controller_face_uv_tools.js';
import { faceUvShortcutsRegister } from '@/texture/controller/face_uv_shortcut_bindings.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { ManagerInput } from '@/input/manager_input.js';

describe('face UV shortcut bindings', () => {
  let world: THREE.Group;
  let faceController: ControllerFaceExtrusion;
  let commandStack: CommandStack;
  let controller: ControllerFaceUvTools;
  let keyboardHandler: HandlerKeyboardShortcut;
  let inputManager: ManagerInput;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    commandStack = new CommandStack(64);
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
    inputManager = new ManagerInput(window);
    keyboardHandler = new HandlerKeyboardShortcut(inputManager);
    keyboardHandler.register();
    controller = new ControllerFaceUvTools(
      new ManagerSelection(),
      faceController,
      commandStack,
      new GridSnap(false, 1),
      () => ({ right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) }),
      () => ({ shift: false, ctrl: false }),
    );
    faceUvShortcutsRegister(keyboardHandler, controller);
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    initializeMeshTextureUVs(mesh, DEFAULT_CHECKER_TEXTURE_ID);
    world.add(mesh);
  });

  afterEach(() => {
    keyboardHandler.unregister();
    inputManager.dispose();
  });

  it('nudges the texture from arrow keys in face mode with faces selected', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(commandStack.getUndoCount()).toBe(1);
  });

  it('does not run UV shortcuts outside face mode', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    faceController.setSelectionMode(SelectionMode.OBJECT);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('does not run UV shortcuts in face mode without selected faces', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('rotates from PageUp and resets from Shift+R in face mode', () => {
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'PageUp', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', shiftKey: true, bubbles: true }));
    expect(commandStack.getUndoCount()).toBe(2);
  });
});
