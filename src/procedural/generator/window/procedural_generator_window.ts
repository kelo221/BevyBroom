import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralCornerConstrain } from '@/procedural/generator/procedural_corner_constrain.js';
import {
  ProceduralGenerator,
  proceduralHandleBoxFacesOf,
  type ProceduralHandleFaceDefinition,
  type ProceduralMaterialSlot,
} from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import {
  PROCEDURAL_WINDOW_SLOT_FRAME,
  PROCEDURAL_WINDOW_SLOT_GLASS,
  ProceduralWindowBuilder,
  type ProceduralWindowSpec,
} from '@/procedural/generator/window/procedural_window_builder.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Identifier of the window generator. */
export const PROCEDURAL_GENERATOR_WINDOW_ID = 'window';

/** Field path of the first corner of the window's bounding box. */
export const PROCEDURAL_WINDOW_CORNER_A = 'corner_a';

/** Field path of the opposite corner of the window's bounding box. */
export const PROCEDURAL_WINDOW_CORNER_B = 'corner_b';

/** Field path of the frame width. */
export const PROCEDURAL_WINDOW_FRAME_WIDTH = 'frame_width';

/** Field path of the number of pane columns. */
export const PROCEDURAL_WINDOW_COLUMNS = 'columns';

/** Field path of the number of pane rows. */
export const PROCEDURAL_WINDOW_ROWS = 'rows';

/** Field path of the mullion width. */
export const PROCEDURAL_WINDOW_MULLION_WIDTH = 'mullion_width';

/** Smallest edge length of the window box in meters. */
export const PROCEDURAL_WINDOW_MIN_SIZE = GRID_INTERVAL_MINIMUM;

/** Fields of a window. */
const PROCEDURAL_WINDOW_FIELDS: readonly GameEntityField[] = [
  { path: PROCEDURAL_WINDOW_CORNER_A, label: 'Corner A', kind: 'vector3', default: [-0.5, 0, -0.0625] },
  { path: PROCEDURAL_WINDOW_CORNER_B, label: 'Corner B', kind: 'vector3', default: [0.5, 1.25, 0.0625] },
  {
    path: PROCEDURAL_WINDOW_FRAME_WIDTH,
    label: 'Frame Width',
    kind: 'number',
    default: 0.0625,
    minimum: 0.03125,
    maximum: 0.5,
    step: 0.03125,
  },
  { path: PROCEDURAL_WINDOW_COLUMNS, label: 'Columns', kind: 'integer', default: 1, minimum: 1, maximum: 12, step: 1 },
  { path: PROCEDURAL_WINDOW_ROWS, label: 'Rows', kind: 'integer', default: 1, minimum: 1, maximum: 12, step: 1 },
  {
    path: PROCEDURAL_WINDOW_MULLION_WIDTH,
    label: 'Mullion Width',
    kind: 'number',
    default: 0.03125,
    minimum: 0.03125,
    maximum: 0.25,
    step: 0.03125,
  },
];

/** Face handles of the window box: both sides of each axis. */
const PROCEDURAL_WINDOW_FACES: readonly ProceduralHandleFaceDefinition[] = proceduralHandleBoxFacesOf(
  PROCEDURAL_WINDOW_CORNER_A,
  PROCEDURAL_WINDOW_CORNER_B,
  PROCEDURAL_WINDOW_MIN_SIZE,
);

/** Material slots of a window. */
const PROCEDURAL_WINDOW_SLOTS: readonly ProceduralMaterialSlot[] = [
  { name: PROCEDURAL_WINDOW_SLOT_FRAME, label: 'Frame' },
  { name: PROCEDURAL_WINDOW_SLOT_GLASS, label: 'Glass', isGlass: true },
];

/**
 * A window in the XY plane: a frame around columns and rows of glass panes. A
 * new window is one pane with no mullions; more columns add upright mullions
 * and more rows add crossing ones. The frame and the mullions keep their width
 * when the box is resized; the panes absorb the change.
 */
export class ProceduralGeneratorWindow extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_WINDOW_ID;
  readonly label = 'Window';
  readonly version = 1;
  readonly iconName: IconName = 'square-outline';

  /**
   * Returns the corner and pane layout fields.
   *
   * @returns Field descriptions.
   */
  fields(): readonly GameEntityField[] {
    return PROCEDURAL_WINDOW_FIELDS;
  }

  /**
   * Returns the frame and glass slots.
   *
   * @returns Material slots.
   */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return PROCEDURAL_WINDOW_SLOTS;
  }

  /**
   * Shows each of the six faces of the window box as a handle.
   *
   * @returns Face handle definitions.
   */
  override handleFaces(): readonly ProceduralHandleFaceDefinition[] {
    return PROCEDURAL_WINDOW_FACES;
  }

  /**
   * Builds frame, mullions and glass panes; refused parameters build nothing.
   *
   * @param parameters Valid parameters.
   * @returns Parts in a stable order: frame, mullions, glass.
   */
  partsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    const spec = ProceduralGeneratorWindow.specOf(parameters);
    return ProceduralWindowBuilder.issuesOf(spec).length > 0 ? [] : ProceduralWindowBuilder.build(spec);
  }

  /**
   * Explains why a window is refused.
   *
   * @param parameters Valid parameters.
   * @returns Problems of a window too small for its frame, columns or rows.
   */
  override issuesDescribe(parameters: ProceduralParameters): string[] {
    return ProceduralWindowBuilder.issuesOf(ProceduralGeneratorWindow.specOf(parameters));
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
      PROCEDURAL_WINDOW_CORNER_A,
      PROCEDURAL_WINDOW_CORNER_B,
      PROCEDURAL_WINDOW_MIN_SIZE,
    );
  }

  /**
   * Reads the measures of the window.
   *
   * @param parameters Valid parameters.
   * @returns Box, frame and pane layout.
   */
  private static specOf(parameters: ProceduralParameters): ProceduralWindowSpec {
    return {
      box: new THREE.Box3().setFromPoints([
        ProceduralParametersRead.vector3(parameters, PROCEDURAL_WINDOW_CORNER_A),
        ProceduralParametersRead.vector3(parameters, PROCEDURAL_WINDOW_CORNER_B),
      ]),
      frameWidth: ProceduralParametersRead.number(parameters, PROCEDURAL_WINDOW_FRAME_WIDTH),
      mullionWidth: ProceduralParametersRead.number(parameters, PROCEDURAL_WINDOW_MULLION_WIDTH),
      columns: ProceduralParametersRead.number(parameters, PROCEDURAL_WINDOW_COLUMNS),
      rows: ProceduralParametersRead.number(parameters, PROCEDURAL_WINDOW_ROWS),
    };
  }
}
