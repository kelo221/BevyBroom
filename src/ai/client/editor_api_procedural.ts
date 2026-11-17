import type { EditorApiHost } from './editor_api_host.js';
import { EditorApiEntities, type EntityAddArgs, type EntitySettingsSetArgs } from './editor_api_entities.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { PROCEDURAL_GENERATOR_BOX_ID } from '@/procedural/generator/box/procedural_generator_box.js';
import type { ProceduralGenerator } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { PROCEDURAL_ENTITY_KIND } from '@/procedural/model/procedural_definition.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** Lists procedural generators and adds and edits procedural objects. */
export class EditorApiProcedural {
  private readonly entities: EditorApiEntities;

  /**
   * Creates the procedural object tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.entities = new EditorApiEntities(host);
  }

  /**
   * Runs a procedural object tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no procedural object tool.
   */
  proceduralToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'list_procedural_generators':
        return this.generatorsList();
      case 'add_procedural':
        return this.proceduralAdd(args as EntityAddArgs);
      case 'set_procedural_settings':
        return this.entities.entitySettingsSet(PROCEDURAL_ENTITY_KIND, args as unknown as EntitySettingsSetArgs);
      default:
        return null;
    }
  }

  /**
   * Describes every generator.
   *
   * @returns Result with the generators.
   */
  private generatorsList(): McpToolResult {
    const generators = ProceduralGeneratorRegistry.list().map((generator) => ({
      id: generator.generatorId,
      label: generator.label,
      version: generator.version,
      fields: generator.fields(),
      handlePoints: generator.handlePointPaths(),
      materialSlots: generator.materialSlots(),
      defaultParameters: generator.parametersCreateDefault(),
    }));
    return okResult(`${generators.length} procedural generators`, { generators });
  }

  /**
   * Adds an object built by the requested generator with the requested
   * parameters and textures over the generator's defaults.
   *
   * @param args Name, transform and partial settings.
   * @returns Result naming the new object's id and its settings.
   */
  private proceduralAdd(args: EntityAddArgs): McpToolResult {
    const generatorId = args.settings?.['generatorId'] ?? PROCEDURAL_GENERATOR_BOX_ID;
    const generator = typeof generatorId === 'string' ? ProceduralGeneratorRegistry.find(generatorId) : null;
    if (generator === null) {
      return failResult(`Unknown procedural generator ${String(generatorId)}`);
    }
    const settings = this.settingsCreate(generator, args.settings ?? {});
    if (settings === null) {
      return failResult('Invalid procedural settings');
    }
    return this.entities.entityOwnerAdd(ProceduralOwner, settings, args.name ?? generator.label, args);
  }

  /**
   * Returns a generator's default settings with a partial edit applied.
   *
   * @param generator Generator of the new object.
   * @param patch Partial settings.
   * @returns Valid settings, or null when the edit is not settings.
   */
  private settingsCreate(generator: ProceduralGenerator, patch: Record<string, unknown>): object | null {
    const defaults = ProceduralSettingsRules.createForGenerator(generator);
    return ProceduralOwner.definition.settingsFromUnknown(ProceduralOwner.definition.settingsPatch(defaults, patch));
  }
}
