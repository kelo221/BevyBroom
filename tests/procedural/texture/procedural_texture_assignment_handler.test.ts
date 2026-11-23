import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { PROCEDURAL_GENERATOR_WINDOW_ID } from '@/procedural/generator/window/procedural_generator_window.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import { ProceduralTextureAssignmentHandler } from '@/procedural/texture/procedural_texture_assignment_handler.js';
import { ProceduralVisualBuilder } from '@/procedural/visual/procedural_visual_builder.js';
import { TextureAssignmentObjectHandlerRegistry } from '@/texture/assignment/texture_assignment_object_handler_registry.js';
import {
  PROCEDURAL_TEST_TEXTURE_IDS,
  proceduralTestTextureLibraryInstall,
  proceduralTestTextureLibraryRemove,
} from './procedural_texture_test_library.js';

/**
 * Creates a procedural window object.
 *
 * @returns Window owner.
 */
function windowCreate(): THREE.Group {
  const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_WINDOW_ID);
  if (generator === null) throw new Error('the window is built in');
  return ProceduralOwner.create('Window', ProceduralSettingsRules.createForGenerator(generator));
}

/**
 * Returns the names of an object's slots holding a texture.
 *
 * @param owner Procedural owner.
 * @param textureId Texture id.
 * @returns Slot names.
 */
function slotsHolding(owner: THREE.Object3D, textureId: string): string[] {
  const materials = ProceduralOwner.settingsRead(owner)?.materials ?? {};
  return Object.keys(materials).filter((slot) => materials[slot] === textureId);
}

/**
 * Returns the names of the slots of an object's generator that are, or are not,
 * glass.
 *
 * @param owner Procedural owner.
 * @param isGlass Whether to list glass slots.
 * @returns Slot names.
 */
function slotsOfSort(owner: THREE.Object3D, isGlass: boolean): string[] {
  const generatorId = ProceduralOwner.settingsRead(owner)?.generatorId ?? '';
  const slots = ProceduralGeneratorRegistry.find(generatorId)?.materialSlots() ?? [];
  return slots.filter((slot) => (slot.isGlass === true) === isGlass).map((slot) => slot.name);
}

/** A texture picked for whole procedural objects fills the slots of its sort. */
describe('ProceduralTextureAssignmentHandler', () => {
  beforeEach(() => {
    proceduralTestTextureLibraryInstall();
  });

  afterEach(() => {
    proceduralTestTextureLibraryRemove();
    vi.restoreAllMocks();
  });

  it('is the registered handler for procedural objects and ignores other objects', () => {
    expect(TextureAssignmentObjectHandlerRegistry.changeBuild([new THREE.Group()], 'any')).toBeNull();
    const change = TextureAssignmentObjectHandlerRegistry.changeBuild([windowCreate()], 'any');
    expect(change?.objectCount).toBe(1);
  });

  it('fills glass slots with a see-through texture and the other slots with any other texture, as undo steps', () => {
    const windowOwner = windowCreate();
    const before = ProceduralOwner.settingsRead(windowOwner);
    const stack = new CommandStack(8);
    const handler = new ProceduralTextureAssignmentHandler();
    for (const [textureId, isGlass] of [
      [PROCEDURAL_TEST_TEXTURE_IDS.glass, true],
      [PROCEDURAL_TEST_TEXTURE_IDS.brick, false],
    ] as const) {
      const change = handler.changeBuild([windowOwner], textureId);
      if (change === null) throw new Error('the window is procedural');
      stack.push(change.command);
      expect(slotsHolding(windowOwner, textureId)).toEqual(slotsOfSort(windowOwner, isGlass));
    }
    stack.undo();
    stack.undo();
    expect(ProceduralOwner.settingsRead(windowOwner)).toEqual(before);
  });

  it('gives a texture of either sort to every slot of an object without slots of that sort', () => {
    const box = ProceduralOwner.createDefault('Box');
    const change = new ProceduralTextureAssignmentHandler().changeBuild([box], PROCEDURAL_TEST_TEXTURE_IDS.glass);
    change?.command.execute();
    expect(slotsHolding(box, PROCEDURAL_TEST_TEXTURE_IDS.glass)).toEqual(slotsOfSort(box, false));
  });

  it('finds the object through a selected part of it, once per object', () => {
    const windowOwner = windowCreate();
    const mesh = ProceduralVisualBuilder.meshFind(windowOwner);
    if (mesh === null) throw new Error('the window shows a mesh');
    const change = new ProceduralTextureAssignmentHandler().changeBuild(
      [mesh, windowOwner],
      PROCEDURAL_TEST_TEXTURE_IDS.brick,
    );
    expect(change?.objectCount).toBe(1);
  });
});
