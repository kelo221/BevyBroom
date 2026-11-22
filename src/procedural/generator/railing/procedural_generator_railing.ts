import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralGenerator, type ProceduralMaterialSlot } from '@/procedural/generator/procedural_generator.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import {
  PROCEDURAL_RAILING_SLOT_POSTS,
  PROCEDURAL_RAILING_SLOT_RAILS,
  ProceduralRailingBuilder,
  type ProceduralRailingSpec,
} from '@/procedural/generator/railing/procedural_railing_builder.js';
import { PROCEDURAL_LAYOUT_RUN_MIN_LENGTH, ProceduralLayoutRun } from '@/procedural/layout/procedural_layout_run.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Identifier of the railing generator. */
export const PROCEDURAL_GENERATOR_RAILING_ID = 'railing';

/** Field path of the first end. */
export const PROCEDURAL_RAILING_START = 'start';

/** Field path of the second end. */
export const PROCEDURAL_RAILING_END = 'end';

/** Field path of the post height. */
export const PROCEDURAL_RAILING_HEIGHT = 'height';

/** Field path of the post edge length. */
export const PROCEDURAL_RAILING_POST_SIZE = 'post_size';

/** Field path of the largest distance between post starts. */
export const PROCEDURAL_RAILING_MAX_POST_SPACING = 'max_post_spacing';

/** Field path of the number of rails below the top rail. */
export const PROCEDURAL_RAILING_MID_RAIL_COUNT = 'mid_rail_count';

/** Field path of the rail edge length. */
export const PROCEDURAL_RAILING_RAIL_SIZE = 'rail_size';

/** Field path of the switch for the posts at both ends. */
export const PROCEDURAL_RAILING_END_POSTS = 'end_posts';

/** Fields of a railing. */
const PROCEDURAL_RAILING_FIELDS: readonly GameEntityField[] = [
  { path: PROCEDURAL_RAILING_START, label: 'Start', kind: 'vector3', default: [0, 0, 0] },
  { path: PROCEDURAL_RAILING_END, label: 'End', kind: 'vector3', default: [4, 0, 0] },
  {
    path: PROCEDURAL_RAILING_HEIGHT,
    label: 'Height',
    kind: 'number',
    default: 1,
    minimum: 0.25,
    maximum: 3,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_RAILING_POST_SIZE,
    label: 'Post Size',
    kind: 'number',
    default: 0.0625,
    minimum: 0.03125,
    maximum: 0.5,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_RAILING_MAX_POST_SPACING,
    label: 'Max Post Spacing',
    kind: 'number',
    default: 1.5,
    minimum: 0.25,
    maximum: 8,
    step: 0.03125,
  },
  {
    path: PROCEDURAL_RAILING_MID_RAIL_COUNT,
    label: 'Mid Rails',
    kind: 'integer',
    default: 1,
    minimum: 0,
    maximum: 8,
    step: 1,
  },
  {
    path: PROCEDURAL_RAILING_RAIL_SIZE,
    label: 'Rail Size',
    kind: 'number',
    default: 0.0625,
    minimum: 0.03125,
    maximum: 0.25,
    step: 0.03125,
  },
  { path: PROCEDURAL_RAILING_END_POSTS, label: 'End Posts', kind: 'bool', default: true },
];

/** Material slots of a railing. */
const PROCEDURAL_RAILING_SLOTS: readonly ProceduralMaterialSlot[] = [
  { name: PROCEDURAL_RAILING_SLOT_POSTS, label: 'Posts' },
  { name: PROCEDURAL_RAILING_SLOT_RAILS, label: 'Rails' },
];

/**
 * A guard rail between two points. Posts and rails keep their size while the
 * ends move: the posts are re-spaced to stay within the largest spacing and the
 * rails stretch along the run, following its slope.
 */
export class ProceduralGeneratorRailing extends ProceduralGenerator {
  readonly generatorId: string = PROCEDURAL_GENERATOR_RAILING_ID;
  readonly label = 'Railing';
  readonly version = 1;
  readonly iconName: IconName = 'shape-polyhedron';

  /**
   * Returns the ends, posts and rails fields.
   *
   * @returns Field descriptions.
   */
  fields(): readonly GameEntityField[] {
    return PROCEDURAL_RAILING_FIELDS;
  }

  /**
   * Returns the post and rail slots.
   *
   * @returns Material slots.
   */
  materialSlots(): readonly ProceduralMaterialSlot[] {
    return PROCEDURAL_RAILING_SLOTS;
  }

  /**
   * Shows both ends as handles.
   *
   * @returns End field paths.
   */
  override handlePointPaths(): readonly string[] {
    return [PROCEDURAL_RAILING_START, PROCEDURAL_RAILING_END];
  }

  /**
   * Builds the posts and rails; refused parameters build nothing.
   *
   * @param parameters Valid parameters.
   * @returns Parts in a stable order: posts, top rail, mid rails.
   */
  partsBuild(parameters: ProceduralParameters): ProceduralPart[] {
    if (this.issuesDescribe(parameters).length > 0) {
      return [];
    }
    return ProceduralRailingBuilder.build(ProceduralGeneratorRailing.specOf(parameters));
  }

  /**
   * Explains why a railing is refused.
   *
   * @param parameters Valid parameters.
   * @returns Problems of a too short run, too wide posts or rails that do not
   *   fit the height.
   */
  override issuesDescribe(parameters: ProceduralParameters): string[] {
    const spec = ProceduralGeneratorRailing.specOf(parameters);
    const issues: string[] = [];
    if (!spec.run.isUsable()) {
      issues.push(`Railing ends are closer than ${PROCEDURAL_LAYOUT_RUN_MIN_LENGTH} m horizontally`);
    }
    if (spec.run.run < spec.postSize) {
      issues.push('Railing is shorter than a post');
    }
    if (spec.maxPostSpacing <= spec.postSize) {
      issues.push('Railing post spacing is not larger than a post');
    }
    if ((spec.midRailCount + 1) * spec.railSize >= spec.height) {
      issues.push('Railing rails do not fit between the base and the top');
    }
    return issues;
  }

  /**
   * Reads the measures of the railing.
   *
   * @param parameters Valid parameters.
   * @returns Run and sizes.
   */
  private static specOf(parameters: ProceduralParameters): ProceduralRailingSpec {
    return {
      run: new ProceduralLayoutRun(
        ProceduralParametersRead.vector3(parameters, PROCEDURAL_RAILING_START),
        ProceduralParametersRead.vector3(parameters, PROCEDURAL_RAILING_END),
      ),
      height: ProceduralParametersRead.number(parameters, PROCEDURAL_RAILING_HEIGHT),
      postSize: ProceduralParametersRead.number(parameters, PROCEDURAL_RAILING_POST_SIZE),
      maxPostSpacing: ProceduralParametersRead.number(parameters, PROCEDURAL_RAILING_MAX_POST_SPACING),
      midRailCount: ProceduralParametersRead.number(parameters, PROCEDURAL_RAILING_MID_RAIL_COUNT),
      railSize: ProceduralParametersRead.number(parameters, PROCEDURAL_RAILING_RAIL_SIZE),
      hasEndPosts: parameters[PROCEDURAL_RAILING_END_POSTS] === true,
    };
  }
}
