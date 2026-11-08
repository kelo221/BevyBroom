import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { vec3FromUnknown } from './editor_api_math.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  SPRINKLE_PLACEMENT_MODES,
  type SprinkleConfig,
  type SprinklePlacementMode,
  type SprinkleSurfaceHit,
} from '@/tools/sprinkle/sprinkle_types.js';
import {
  sprinkleStrokeCreate,
  sprinkleSurfaceProjectorCreate,
  type SprinkleStrokeServices,
} from '@/tools/sprinkle/stroke/sprinkle_stroke_factory.js';

/** Normal a stamp uses when the call names none. */
const EDITOR_API_SPRINKLE_DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0);

/** Lists sprinkle types and paints Entity Sprinkle strokes for MCP. */
export class EditorApiSprinkle {
  /**
   * Creates the sprinkle tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a sprinkle tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no sprinkle tool.
   */
  sprinkleToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    if (name === 'sprinkle_definitions_list') {
      return this.definitionsList();
    }
    return name === 'sprinkle_stamp' ? this.stamp(args) : null;
  }

  /**
   * Lists the loaded sprinkle definitions.
   *
   * @returns Result with the definitions and load problems.
   */
  private definitionsList(): McpToolResult {
    const library = getStateSprinkleDefinitionLibrary();
    const definitions = library.definitionsRead().map((definition) => EditorApiSprinkle.definitionSummary(definition));
    return okResult(`${definitions.length} sprinkle types`, { definitions, problems: [...library.problemsRead()] });
  }

  /**
   * Paints one stroke at a world point as one undo step.
   *
   * @param args Tool arguments.
   * @returns Result counting the entities added and removed.
   */
  private stamp(args: Record<string, unknown>): McpToolResult {
    const center = vec3FromUnknown(args['center']);
    const normal =
      args['normal'] === undefined ? EDITOR_API_SPRINKLE_DEFAULT_NORMAL.clone() : vec3FromUnknown(args['normal']);
    const config = EditorApiSprinkle.stampConfigRead(args);
    if (!center || !normal || normal.lengthSq() === 0 || typeof config === 'string') {
      return failResult(typeof config === 'string' ? config : 'center and normal must be { x, y, z } numbers');
    }
    return this.stampRun({ point: center, normal: normal.normalize() }, config);
  }

  /**
   * Runs one stroke with a single dab and records it.
   *
   * @param centerHit Surface point and normal of the stroke.
   * @param config Configuration of the stroke.
   * @returns Result counting the entities added and removed.
   */
  private stampRun(centerHit: SprinkleSurfaceHit, config: SprinkleConfig): McpToolResult {
    const warnings: string[] = [];
    const services = this.strokeServicesCreate(warnings);
    const created = sprinkleStrokeCreate(services, sprinkleSurfaceProjectorCreate(services), config, {
      mode: config.mode,
      seed: config.seed,
    });
    if (!created.ok) {
      return failResult(created.message);
    }
    created.stroke.dabApply(centerHit);
    const result = created.stroke.finish();
    const message = `Sprinkled ${result.added} added, ${result.removed} removed`;
    return okResult(
      message,
      { added: result.added, removed: result.removed },
      warnings.length > 0 ? { warnings } : undefined,
    );
  }

  /**
   * Builds the stroke services over the host, collecting status messages.
   *
   * @param warnings List receiving status messages of the stroke.
   * @returns Stroke services.
   */
  private strokeServicesCreate(warnings: string[]): SprinkleStrokeServices {
    return {
      commandStack: this.host.commandStack,
      worldObject: this.host.worldObject,
      statusShow: (message) => warnings.push(message),
      afterWorldMutation: () => this.host.refreshAfterWorldMutation(),
    };
  }

  /**
   * Reads the stamp's configuration: the shared configuration with the call's
   * definition and options laid over it.
   *
   * @param args Tool arguments.
   * @returns Configuration, or a message naming the bad argument.
   */
  private static stampConfigRead(args: Record<string, unknown>): SprinkleConfig | string {
    const definitionName = args['definition'];
    const mode = args['mode'] ?? getStateSprinkleTool().configRead().mode;
    if (typeof definitionName !== 'string' || definitionName.length === 0) {
      return 'definition must be a sprinkle type name';
    }
    if (!SPRINKLE_PLACEMENT_MODES.includes(mode as SprinklePlacementMode)) {
      return `mode must be one of ${SPRINKLE_PLACEMENT_MODES.join(', ')}`;
    }
    return {
      ...getStateSprinkleTool().configRead(),
      ...EditorApiSprinkle.numberOptionsRead(args),
      definitionName,
      mode: mode as SprinklePlacementMode,
    };
  }

  /**
   * Reads the optional number options of a stamp.
   *
   * @param args Tool arguments.
   * @returns The radius, density and seed the call names.
   */
  private static numberOptionsRead(args: Record<string, unknown>): Partial<SprinkleConfig> {
    const options: Partial<SprinkleConfig> = {};
    for (const key of ['radius', 'densityPercent', 'seed'] as const) {
      const value = args[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        options[key] = value;
      }
    }
    return options;
  }

  /**
   * Summarizes a definition for the list tool.
   *
   * @param definition Sprinkle definition.
   * @returns Name, source, grid and case count.
   */
  private static definitionSummary(definition: SprinkleDefinition): Record<string, unknown> {
    return {
      name: definition.name,
      sourcePath: definition.sourcePath,
      grid: definition.grid ? { sizeU: definition.grid.sizeU, sizeV: definition.grid.sizeV } : null,
      caseCount: definition.cases.length,
    };
  }
}
