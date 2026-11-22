import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';
import { ProceduralCornerConstrain } from '@/procedural/generator/procedural_corner_constrain.js';
import {
  ProceduralGenerator,
  proceduralHandleBoxFacesOf,
  type ProceduralHandleFaceDefinition,
  type ProceduralMaterialSlot,
} from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Identifier of the two-corner box generator. */
export const PROCEDURAL_GENERATOR_BOX_ID = 'box';

/** Field path of the first box corner. */
export const PROCEDURAL_GENERATOR_BOX_CORNER_A = 'corner_a';

/** Field path of the opposite box corner. */
export const PROCEDURAL_GENERATOR_BOX_CORNER_B = 'corner_b';

/** Material slot of every box face. */
export const PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE = 'surface';

/** Smallest edge length of a box in meters. */
export const PROCEDURAL_GENERATOR_BOX_MIN_SIZE = 0.01;

/** Fields of the box: its two opposite corners. */
const PROCEDURAL_GENERATOR_BOX_FIELDS: readonly GameEntityField[] = [
  { path: PROCEDURAL_GENERATOR_BOX_CORNER_A, label: 'Corner A', kind: 'vector3', default: [-0.5, 0, -0.5] },
  { path: PROCEDURAL_GENERATOR_BOX_CORNER_B, label: 'Corner B', kind: 'vector3', default: [0.5, 1, 0.5] },
];

/** Face handles of the box: both sides of each axis. */
const PROCEDURAL_GENERATOR_BOX_FACES: readonly ProceduralHandleFaceDefinition[] = proceduralHandleBoxFacesOf(
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_MIN_SIZE,
);

/** Material slots of the box. */
const PROCEDURAL_GENERATOR_BOX_SLOTS: readonly ProceduralMaterialSlot[] = [
  { name: PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE, label: 'Surface' },
];

/**
 * Axis-aligned box spanned by two opposite corners: the simplest generator,
 * which proves handles, snapping, texturing and export.
 */
export class ProceduralGeneratorBox extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_BOX_ID;
  readonly label = 'Box';
  readonly version = 1;
  readonly iconName: IconName = 'cube-outline';

  /**
   * Returns the two corner fields.
   *
   * @returns Field descriptions.
   */
  fields(): readonly GameEntityField[] {
    return PROCEDURAL_GENERATOR_BOX_FIELDS;
  }

  /**
   * Returns the one surface slot.
   *
   * @returns Material slots.
   */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return PROCEDURAL_GENERATOR_BOX_SLOTS;
  }

  /**
   * Shows each of the six faces as a handle that moves only that face.
   *
   * @returns Face handle definitions.
   */
  override handleFaces(): readonly ProceduralHandleFaceDefinition[] {
    return PROCEDURAL_GENERATOR_BOX_FACES;
  }

  /**
   * Returns the box size the game reads.
   *
   * @param parameters Valid parameters.
   * @returns The edge lengths as `size`.
   */
  override derivedValues(parameters: ProceduralParameters): ProceduralParameters {
    const box = ProceduralGeneratorBox.boxOf(parameters);
    return { size: ProceduralParametersRead.vector3Value(box.getSize(new THREE.Vector3())) };
  }

  /**
   * Builds the box as one part.
   *
   * @param parameters Valid parameters.
   * @returns The box part.
   */
  partsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    const box = ProceduralGeneratorBox.boxOf(parameters);
    return [ProceduralPartBox.create('Box', PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE, box.min, box.max)];
  }

  /**
   * Moves corner B away from corner A along every axis where the box would be
   * thinner than the smallest size.
   *
   * @param parameters Parameters with valid corners.
   * @returns Parameters of a box with a volume.
   */
  protected override parametersConstrain(parameters: ProceduralParameters): ProceduralParameters {
    return ProceduralCornerConstrain.minimumSizeKeep(
      parameters,
      PROCEDURAL_GENERATOR_BOX_CORNER_A,
      PROCEDURAL_GENERATOR_BOX_CORNER_B,
      PROCEDURAL_GENERATOR_BOX_MIN_SIZE,
    );
  }

  /**
   * Returns the box between the two corners.
   *
   * @param parameters Valid parameters.
   * @returns Local box.
   */
  private static boxOf(parameters: ProceduralParameters): THREE.Box3 {
    return new THREE.Box3().setFromPoints([
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_A),
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B),
    ]);
  }
}
