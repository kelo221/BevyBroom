import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import {
  PROCEDURAL_GIRDER_PROFILE_I_BEAM,
  PROCEDURAL_GIRDER_PROFILES,
  ProceduralGirderProfile,
  type ProceduralGirderSection,
  type ProceduralGirderSize,
} from '@/procedural/generator/girder/procedural_girder_profile.js';
import { ProceduralGenerator, type ProceduralMaterialSlot } from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { PROCEDURAL_LAYOUT_RUN_MIN_LENGTH, ProceduralLayoutRun } from '@/procedural/layout/procedural_layout_run.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Identifier of the girder generator. */
export const PROCEDURAL_GENERATOR_GIRDER_ID = 'girder';

/** Field path of the first end. */
export const PROCEDURAL_GIRDER_START = 'start';

/** Field path of the second end. */
export const PROCEDURAL_GIRDER_END = 'end';

/** Field path of the profile choice. */
export const PROCEDURAL_GIRDER_PROFILE = 'profile';

/** Field path of the profile height. */
export const PROCEDURAL_GIRDER_HEIGHT = 'height';

/** Field path of the flange width. */
export const PROCEDURAL_GIRDER_FLANGE_WIDTH = 'flange_width';

/** Field path of the web thickness. */
export const PROCEDURAL_GIRDER_WEB_THICKNESS = 'web_thickness';

/** Field path of the flange thickness. */
export const PROCEDURAL_GIRDER_FLANGE_THICKNESS = 'flange_thickness';

/** Material slot of every girder part. */
export const PROCEDURAL_GIRDER_SLOT_STEEL = 'steel';

/** Fields of a girder. */
const PROCEDURAL_GIRDER_FIELDS: readonly GameEntityField[] = [
  { path: PROCEDURAL_GIRDER_START, label: 'Start', kind: 'vector3', default: [0, 0, 0] },
  { path: PROCEDURAL_GIRDER_END, label: 'End', kind: 'vector3', default: [4, 0, 0] },
  {
    path: PROCEDURAL_GIRDER_PROFILE,
    label: 'Profile',
    kind: 'enum',
    default: PROCEDURAL_GIRDER_PROFILE_I_BEAM,
    variants: [...PROCEDURAL_GIRDER_PROFILES],
  },
  {
    path: PROCEDURAL_GIRDER_HEIGHT,
    label: 'Height',
    kind: 'number',
    default: 0.25,
    minimum: 0.0625,
    maximum: 2,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_GIRDER_FLANGE_WIDTH,
    label: 'Flange Width',
    kind: 'number',
    default: 0.25,
    minimum: 0.0625,
    maximum: 2,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_GIRDER_WEB_THICKNESS,
    label: 'Web Thickness',
    kind: 'number',
    default: 0.0625,
    minimum: 0.03125,
    maximum: 0.5,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_GIRDER_FLANGE_THICKNESS,
    label: 'Flange Thickness',
    kind: 'number',
    default: 0.0625,
    minimum: 0.03125,
    maximum: 0.5,
    step: 0.03125,
  },
];

/** Material slots of a girder. */
const PROCEDURAL_GIRDER_SLOTS: readonly ProceduralMaterialSlot[] = [
  { name: PROCEDURAL_GIRDER_SLOT_STEEL, label: 'Steel' },
];

/**
 * A structural steel beam between two points. The profile keeps its measures
 * while the ends move; only the run between them stretches, and a sloped run
 * shears the pieces so they stay convex.
 */
export class ProceduralGeneratorGirder extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_GIRDER_ID;
  readonly label = 'Girder';
  readonly version = 1;
  readonly iconName: IconName = 'shape-outline';

  /**
   * Returns the ends and profile fields.
   *
   * @returns Field descriptions.
   */
  fields(): readonly GameEntityField[] {
    return PROCEDURAL_GIRDER_FIELDS;
  }

  /**
   * Returns the one steel slot.
   *
   * @returns Material slots.
   */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return PROCEDURAL_GIRDER_SLOTS;
  }

  /**
   * Shows both ends as handles.
   *
   * @returns End field paths.
   */
  override handlePointPaths(): readonly string[] {
    return [PROCEDURAL_GIRDER_START, PROCEDURAL_GIRDER_END];
  }

  /**
   * Builds one box per rectangle of the profile along the run; refused
   * parameters build nothing.
   *
   * @param parameters Valid parameters.
   * @returns Parts in a stable order.
   */
  partsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    if (this.issuesDescribe(parameters).length > 0) {
      return [];
    }
    const run = ProceduralGeneratorGirder.runOf(parameters);
    const profile = ProceduralGeneratorGirder.profileOf(parameters);
    const sections = ProceduralGirderProfile.sectionsOf(profile, ProceduralGeneratorGirder.sizeOf(parameters));
    return sections.map((section) => ProceduralGeneratorGirder.sectionPartBuild(run, section));
  }

  /**
   * Builds the part of one profile rectangle stretched along the whole run.
   *
   * @param run Run the girder follows.
   * @param section Rectangle of the profile.
   * @returns Convex part.
   */
  private static sectionPartBuild(run: ProceduralLayoutRun, section: ProceduralGirderSection): ProceduralPart {
    const box = { runFrom: 0, runTo: run.run, ...section };
    return run.frame.boxPart(section.name, PROCEDURAL_GIRDER_SLOT_STEEL, box, run.slope());
  }

  /**
   * Explains why a girder is refused.
   *
   * @param parameters Valid parameters.
   * @returns Problems of a too short run or a profile its measures do not fit.
   */
  override issuesDescribe(parameters: ProceduralParameters): string[] {
    const issues = ProceduralGirderProfile.issuesOf(
      ProceduralGeneratorGirder.profileOf(parameters),
      ProceduralGeneratorGirder.sizeOf(parameters),
    );
    if (!ProceduralGeneratorGirder.runOf(parameters).isUsable()) {
      issues.push(`Girder ends are closer than ${PROCEDURAL_LAYOUT_RUN_MIN_LENGTH} m horizontally`);
    }
    return issues;
  }

  /**
   * Returns the run between the two ends.
   *
   * @param parameters Valid parameters.
   * @returns The run.
   */
  private static runOf(parameters: ProceduralParameters): ProceduralLayoutRun {
    return new ProceduralLayoutRun(
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_GIRDER_START),
      ProceduralParametersRead.vector3(parameters, PROCEDURAL_GIRDER_END),
    );
  }

  /**
   * Returns the chosen profile name.
   *
   * @param parameters Valid parameters.
   * @returns Profile name, empty when the parameter is not text.
   */
  private static profileOf(parameters: ProceduralParameters): string {
    const profile = parameters[PROCEDURAL_GIRDER_PROFILE];
    return typeof profile === 'string' ? profile : '';
  }

  /**
   * Returns the profile measures.
   *
   * @param parameters Valid parameters.
   * @returns Height, flange width and thicknesses.
   */
  private static sizeOf(parameters: ProceduralParameters): ProceduralGirderSize {
    return {
      height: ProceduralParametersRead.number(parameters, PROCEDURAL_GIRDER_HEIGHT),
      flangeWidth: ProceduralParametersRead.number(parameters, PROCEDURAL_GIRDER_FLANGE_WIDTH),
      webThickness: ProceduralParametersRead.number(parameters, PROCEDURAL_GIRDER_WEB_THICKNESS),
      flangeThickness: ProceduralParametersRead.number(parameters, PROCEDURAL_GIRDER_FLANGE_THICKNESS),
    };
  }
}
