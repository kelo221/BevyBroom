import type * as THREE from 'three';
import type { EntityClassPointVariant } from '@/entity/class/entity_class_point_variant.js';
import type { EntityHandle } from '@/entity/handles/entity_handle.js';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralHandlePoint } from '@/procedural/handles/procedural_handle_point.js';
import { ProceduralHandleSpan } from '@/procedural/handles/procedural_handle_span.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import { PROCEDURAL_ICON_UNKNOWN, ProceduralVisualBuilder } from '@/procedural/visual/procedural_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Entity kind of procedural objects. */
export const PROCEDURAL_ENTITY_KIND: EntityKind = 'procedural';

/** Prefix of the point class identifier of every generator. */
export const PROCEDURAL_POINT_CLASS_PREFIX = 'procedural.';

/**
 * Rules of procedural objects: objects whose mesh a generator builds from
 * parameters. They are resized through their point handles, never scaled.
 */
export class ProceduralDefinition extends EntityDefinition<ProceduralSettings> {
  readonly kind: EntityKind = PROCEDURAL_ENTITY_KIND;

  /**
   * Returns the settings of a new two-corner box.
   *
   * @returns Fresh settings object.
   */
  settingsCreateDefault(): ProceduralSettings {
    return ProceduralSettingsRules.createDefault();
  }

  /**
   * Returns settings whose parameters and materials satisfy their generator.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  settingsSanitize(settings: ProceduralSettings): ProceduralSettings {
    return ProceduralSettingsRules.sanitize(settings);
  }

  /**
   * Reads untrusted data into valid settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value names no generator.
   */
  settingsFromUnknown(value: unknown): ProceduralSettings | null {
    return ProceduralSettingsRules.fromUnknown(value);
  }

  /**
   * Rebuilds the generated mesh when the settings changed.
   *
   * @param owner Procedural owner group.
   * @param settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, settings: ProceduralSettings): void {
    ProceduralVisualBuilder.refresh(owner, settings);
  }

  /**
   * Returns the icon of the object's generator.
   *
   * @param settings Valid settings.
   * @returns Icon name.
   */
  iconName(settings: ProceduralSettings): IconName {
    return ProceduralGeneratorRegistry.find(settings.generatorId)?.iconName ?? PROCEDURAL_ICON_UNKNOWN;
  }

  /**
   * Turns scaling off: the handles change the size.
   *
   * @returns False.
   */
  override transformScaleAllowed(): boolean {
    return false;
  }

  /**
   * Turns the resize bars of the selection bounds off.
   *
   * @returns False.
   */
  override boundsResizable(): boolean {
    return false;
  }

  /**
   * Returns one point handle per point field of the generator, then one span
   * handle per length field it shows across a line.
   *
   * @param settings Valid settings.
   * @returns Point handles.
   */
  override handlesCreate(settings: ProceduralSettings): EntityHandle<ProceduralSettings>[] {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    if (generator === null) {
      return [];
    }
    return [
      ...generator.handlePointPaths().map((path) => new ProceduralHandlePoint(path)),
      ...generator.handleSpans().map((definition) => new ProceduralHandleSpan(definition)),
    ];
  }

  /**
   * Returns current settings with an outside edit applied: parameters and
   * materials given in the patch are merged over the current ones.
   *
   * @param settings Current valid settings.
   * @param patch Fields to change, not yet validated.
   * @returns Merged settings, not yet validated.
   */
  override settingsPatch(
    settings: ProceduralSettings,
    patch: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    return {
      ...settings,
      ...patch,
      parameters: { ...settings.parameters, ...ProceduralDefinition.recordOf(patch['parameters']) },
      materials: { ...settings.materials, ...ProceduralDefinition.recordOf(patch['materials']) },
    };
  }

  /**
   * Returns one point class per generator.
   *
   * @returns Point class variants in generator order.
   */
  override pointClassVariants(): readonly EntityClassPointVariant<ProceduralSettings>[] {
    return ProceduralGeneratorRegistry.list().map((generator) => ({
      id: `${PROCEDURAL_POINT_CLASS_PREFIX}${generator.generatorId}`,
      label: generator.label,
      category: 'Procedural',
      helpText: `A procedural ${generator.label.toLowerCase()} whose mesh is built from its fields and handles.`,
      settingsCreate: (previous: ProceduralSettings | null) =>
        previous?.generatorId === generator.generatorId
          ? previous
          : ProceduralSettingsRules.createForGenerator(generator),
      settingsMatch: (settings: ProceduralSettings) => settings.generatorId === generator.generatorId,
    }));
  }

  /**
   * Returns a value as a record.
   *
   * @param value Any value.
   * @returns The value when it is a non-list object, else an empty record.
   */
  private static recordOf(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
