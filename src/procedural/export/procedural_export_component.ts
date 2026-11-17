import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import type {
  PreviewAuthoredComponents,
  PreviewComponentFields,
} from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Type path of the bridge component that carries a procedural object's
 * parameters to the game.
 */
export const PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH = 'broom_bridge::placeables::procedural::BroomProceduralProp';

/**
 * Builds the `BroomProceduralProp` fields the game reads from a procedural
 * object: the generator, its version, the parameters and the values derived
 * from them, the last two as JSON text.
 */
export class ProceduralExportComponent {
  /**
   * Returns the component fields of an object.
   *
   * @param settings Valid settings.
   * @returns Component fields.
   */
  static fieldsCreate(settings: ProceduralSettings): PreviewComponentFields {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    return {
      generator: settings.generatorId,
      version: settings.generatorVersion,
      parameters: JSON.stringify(settings.parameters),
      derived: JSON.stringify(generator?.derivedValues(settings.parameters) ?? {}),
    };
  }

  /**
   * Returns a component map with the object's `BroomProceduralProp` added to
   * the components it already carries.
   *
   * @param components Components already on the object, if any.
   * @param settings Valid settings.
   * @returns New component map.
   */
  static componentsMerge(
    components: PreviewAuthoredComponents | undefined,
    settings: ProceduralSettings,
  ): PreviewAuthoredComponents {
    return {
      ...(components ?? {}),
      [PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]: ProceduralExportComponent.fieldsCreate(settings),
    };
  }
}
