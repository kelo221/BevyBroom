import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { PROCEDURAL_GENERATOR_WINDOW_ID } from '@/procedural/generator/window/procedural_generator_window.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import {
  PROCEDURAL_TEST_TEXTURE_IDS,
  proceduralTestTextureLibraryInstall,
  proceduralTestTextureLibraryRemove,
} from '../../procedural/texture/procedural_texture_test_library.js';

/** Picking a texture in the browser textures selected procedural objects. */
describe('ControllerTextureAssignment procedural objects', () => {
  let commandStack: CommandStack;
  let selection: ManagerSelection;
  let controller: ControllerTextureAssignment;
  let windowOwner: THREE.Group;

  beforeEach(() => {
    proceduralTestTextureLibraryInstall();
    setStateTexturePaintForTests(new StateTexturePaint());
    const world = new THREE.Group();
    commandStack = new CommandStack(16);
    selection = new ManagerSelection();
    const faces = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
    controller = new ControllerTextureAssignment(selection, faces, commandStack);
    const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_WINDOW_ID);
    if (generator === null) throw new Error('the window is built in');
    windowOwner = ProceduralOwner.create('Window', ProceduralSettingsRules.createForGenerator(generator));
    world.add(windowOwner);
  });

  afterEach(() => {
    proceduralTestTextureLibraryRemove();
    setStateTexturePaintForTests(null);
    vi.restoreAllMocks();
  });

  it('gives a picked glass texture to the glass slot of a selected window as one undo step', () => {
    const before = ProceduralOwner.settingsRead(windowOwner);
    selection.setSelection([windowOwner as unknown as THREE.Mesh]);
    const glass = getTextureMapCache().getLibrary()?.getEntryById(PROCEDURAL_TEST_TEXTURE_IDS.glass);
    if (!glass) throw new Error('the test library holds glass');
    controller.onTextureSelected(glass);
    expect(commandStack.getUndoCount()).toBe(1);
    const glassSlots = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_WINDOW_ID)
      ?.materialSlots()
      .filter((slot) => slot.isGlass === true)
      .map((slot) => slot.name);
    const materials = ProceduralOwner.settingsRead(windowOwner)?.materials ?? {};
    expect(Object.keys(materials).filter((slot) => materials[slot] === glass.id)).toEqual(glassSlots);
    commandStack.undo();
    expect(ProceduralOwner.settingsRead(windowOwner)).toEqual(before);
  });
});
