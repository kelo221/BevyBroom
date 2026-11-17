import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';
import { proceduralFieldValueSanitize } from '@/procedural/generator/procedural_field_value_sanitize.js';
import type { ProceduralMaterials, ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/**
 * Edge length of the cube shown for objects whose parameters build nothing, in
 * meters.
 */
const PROCEDURAL_GENERATOR_PLACEHOLDER_SIZE = 0.25;

/** One material slot of a generator: the parts that share one texture. */
export interface ProceduralMaterialSlot {
  readonly name: string;
  readonly label: string;
}

/**
 * A length field shown as a handle beside the line between two point fields,
 * such as a width: the handle sits across the line at half the length.
 */
export interface ProceduralHandleSpanDefinition {
  readonly path: string;
  readonly lineStartPath: string;
  readonly lineEndPath: string;
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
   * Returns the length fields shown as handles across a line between two
   * points. None unless a generator names them.
   *
   * @returns Span handle definitions.
   */
  handleSpans(): readonly ProceduralHandleSpanDefinition[] {
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
   * Returns the names of the derived values that are points in the object's own
   * space, which exports also give in world space. None unless a generator
   * names them.
   *
   * @returns Derived value names.
   */
  derivedPointNames(): readonly string[] {
    return [];
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
   * Returns what the editor shows of an object whose parameters build no parts,
   * so it can still be seen, clicked and fixed. Never exported. The default is
   * a small cube on the object's origin.
   *
   * @param parameters Valid parameters.
   * @returns Placeholder parts.
   */
  placeholderPartsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    void parameters;
    const half = PROCEDURAL_GENERATOR_PLACEHOLDER_SIZE / 2;
    const slot = this.materialSlots()[0]?.name ?? '';
    return [
      ProceduralPartBox.create(
        'Placeholder',
        slot,
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, half * 2, half),
      ),
    ];
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
