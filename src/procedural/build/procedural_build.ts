import type * as THREE from 'three';
import { MaterialColorNeutral } from '@/materials/material_color_neutral.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { createSurfaceMaterial } from '@/texture/material/builder_surface_material.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Builds what a procedural object's settings stand for: its parts, the material
 * of every part, and a key that changes exactly when they would.
 */
export class ProceduralBuild {
  /**
   * Returns the parts the object's generator builds.
   *
   * @param settings Valid settings.
   * @returns Parts, or null when the generator is unknown.
   */
  static partsOf(settings: ProceduralSettings): ProceduralPart[] | null {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    return generator === null ? null : generator.partsBuild(settings.parameters);
  }

  /**
   * Returns a key equal for settings that build the same parts with the same
   * textures.
   *
   * @param settings Valid settings.
   * @returns Build key.
   */
  static keyOf(settings: ProceduralSettings): string {
    return JSON.stringify([settings.generatorId, settings.generatorVersion, settings.parameters, settings.materials]);
  }

  /**
   * Creates one surface material per part, textured by the part's slot.
   *
   * @param parts Parts in draw group order.
   * @param settings Valid settings holding the slot textures.
   * @returns Materials by part index.
   */
  static materialsCreate(parts: readonly ProceduralPart[], settings: ProceduralSettings): THREE.Material[] {
    const cache = getTextureMapCache();
    return parts.map((part) =>
      createSurfaceMaterial(
        MaterialColorNeutral.white,
        settings.materials[part.materialSlot] ?? DEFAULT_CHECKER_TEXTURE_ID,
        cache,
      ),
    );
  }
}
