import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { proceduralFieldValueSanitize } from '@/procedural/generator/procedural_field_value_sanitize.js';
import type { ProceduralMaterials, ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** One material slot of a generator: the parts that share one texture. */
export interface ProceduralMaterialSlot {
  readonly name: string;
  readonly label: string;
}

/**
 * Rules of one kind of procedural object: the fields it is edited through, the
 * point fields shown as handles, its material slots, and how parameters turn
 * into convex parts. The same parameters must always build the same parts.
 */
export abstract class ProceduralGenerator {
  /** Identifier stored in scene files and sent to the game. */
  abstract readonly generatorId: string;

  /** Name shown in menus and the inspector. */
  abstract readonly label: string;

  /** Version of the parameter layout; raised when the layout changes. */
  abstract readonly version: number;

  /** Icon of objects built by this generator. */
  abstract readonly iconName: IconName;

  /**
   * Returns the editable fields with their defaults and ranges.
   *
   * @returns Field descriptions in display order.
   */
  abstract fields(): readonly GameEntityField[];

  /**
   * Returns the material slots the parts are textured through.
   *
   * @returns Slots in display order.
   */
  abstract materialSlots(): readonly ProceduralMaterialSlot[];

  /**
   * Builds the convex parts of an object, in its local space.
   *
   * @param parameters Valid parameters.
   * @returns Parts in a stable order.
   */
  abstract partsBuild(parameters: ProceduralParameters): ProceduralPart[];

  /**
   * Returns the paths of the vector3 fields shown as draggable points. None
   * unless a generator names them.
   *
   * @returns Field paths.
   */
  handlePointPaths(): readonly string[] {
    return [];
  }

  /**
   * Returns values worked out from the parameters that the game should read
   * instead of computing them again. None unless a generator adds them.
   *
   * @param parameters Valid parameters.
   * @returns Derived values by name.
   */
  derivedValues(parameters: ProceduralParameters): ProceduralParameters {
    void parameters;
    return {};
  }

  /**
   * Describes why parameters cannot be built, for the Issues list. None unless
   * a generator refuses some parameters.
   *
   * @param parameters Valid parameters.
   * @returns Problem descriptions.
   */
  issuesDescribe(parameters: ProceduralParameters): string[] {
    void parameters;
    return [];
  }

  /**
   * Returns the parameters of a new object: every field's default.
   *
   * @returns Fresh parameters.
   */
  parametersCreateDefault(): ProceduralParameters {
    return this.parametersSanitize({});
  }

  /**
   * Returns parameters holding a valid value for every field and nothing else.
   *
   * @param candidate Untrusted parameters.
   * @returns Valid parameters.
   */
  parametersSanitize(candidate: Readonly<Record<string, unknown>>): ProceduralParameters {
    const parameters: ProceduralParameters = {};
    for (const field of this.fields()) {
      parameters[field.path] = structuredClone(proceduralFieldValueSanitize(field, candidate[field.path]));
    }
    return this.parametersConstrain(parameters);
  }

  /**
   * Returns a texture for every material slot: the candidate's texture when it
   * names one, else the checker texture.
   *
   * @param candidate Untrusted textures by slot name.
   * @returns Valid textures by slot name.
   */
  materialsSanitize(candidate: Readonly<Record<string, unknown>>): ProceduralMaterials {
    const materials: ProceduralMaterials = {};
    for (const slot of this.materialSlots()) {
      const textureId = candidate[slot.name];
      materials[slot.name] = typeof textureId === 'string' && textureId !== '' ? textureId : DEFAULT_CHECKER_TEXTURE_ID;
    }
    return materials;
  }

  /**
   * Applies rules between fields after each field was sanitized on its own.
   * Generators with such rules override it; the default keeps the parameters.
   *
   * @param parameters Parameters with valid field values.
   * @returns Parameters that satisfy every rule.
   */
  protected parametersConstrain(parameters: ProceduralParameters): ProceduralParameters {
    return parameters;
  }
}
