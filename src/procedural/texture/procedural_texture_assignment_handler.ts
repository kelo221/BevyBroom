import type * as THREE from 'three';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { entityOwnerOfPart } from '@/entity/model/entity_owner_keys.js';
import type { ProceduralMaterialSlot } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import {
  TextureAssignmentObjectHandler,
  type TextureAssignmentObjectChange,
} from '@/texture/assignment/texture_assignment_object_handler.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Gives a texture picked in the texture browser to selected procedural objects.
 * A see-through texture such as glass fills their glass slots, any other
 * texture fills the rest; an object without slots of that sort gets the texture
 * in every slot.
 */
export class ProceduralTextureAssignmentHandler extends TextureAssignmentObjectHandler {
  /**
   * Builds the undo step that gives the selected procedural objects a texture.
   *
   * @param objects Selected objects or parts of them.
   * @param textureId Picked texture id.
   * @returns The change, or null when no procedural object is selected.
   */
  changeBuild(objects: readonly THREE.Object3D[], textureId: string): TextureAssignmentObjectChange | null {
    const owners = ProceduralTextureAssignmentHandler.ownersOf(objects);
    if (owners.length === 0) {
      return null;
    }
    const isGlassTexture = getTextureMapCache().blendOpacityOf(textureId) !== null;
    const command = new CommandEntitySettingsSet(ProceduralOwner, owners, (settings) =>
      ProceduralTextureAssignmentHandler.settingsTextured(settings, textureId, isGlassTexture),
    );
    return { command, objectCount: owners.length, objectNoun: 'procedural object(s)' };
  }

  /**
   * Returns the slots a picked texture fills.
   *
   * @param slots Material slots of a generator.
   * @param isGlassTexture True when the texture is see-through.
   * @returns The glass slots for a see-through texture, the other slots for any
   *   other texture, or every slot when the generator has none of that sort.
   */
  static slotsForTexture(
    slots: readonly ProceduralMaterialSlot[],
    isGlassTexture: boolean,
  ): readonly ProceduralMaterialSlot[] {
    const matching = slots.filter((slot) => (slot.isGlass === true) === isGlassTexture);
    return matching.length > 0 ? matching : slots;
  }

  /**
   * Returns settings whose slots that match the texture hold it.
   *
   * @param settings Current settings.
   * @param textureId Picked texture id.
   * @param isGlassTexture True when the texture is see-through.
   * @returns New settings; unchanged when the generator is unknown.
   */
  private static settingsTextured(
    settings: ProceduralSettings,
    textureId: string,
    isGlassTexture: boolean,
  ): ProceduralSettings {
    const slots = ProceduralGeneratorRegistry.find(settings.generatorId)?.materialSlots() ?? [];
    const materials = { ...settings.materials };
    ProceduralTextureAssignmentHandler.slotsForTexture(slots, isGlassTexture).forEach((slot) => {
      materials[slot.name] = textureId;
    });
    return { ...settings, materials };
  }

  /**
   * Returns the procedural owners of the selected objects, each once.
   *
   * @param objects Selected objects or parts of them.
   * @returns Procedural owner groups in selection order.
   */
  private static ownersOf(objects: readonly THREE.Object3D[]): THREE.Object3D[] {
    const owners = objects
      .map((object) => entityOwnerOfPart(object))
      .filter((owner): owner is THREE.Object3D => owner !== null && ProceduralOwner.isOwner(owner));
    return [...new Set(owners)];
  }
}
