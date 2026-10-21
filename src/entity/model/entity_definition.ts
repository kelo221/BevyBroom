import type * as THREE from 'three';
import type { EntityHandle } from '@/entity/handles/entity_handle.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Icon color of entity kinds that do not choose their own. */
export const ENTITY_ICON_DEFAULT_COLOR = 0xb0b0b0;

/**
 * Rules of one entity kind: default, valid and parsed settings, and how its
 * editor-only visuals are drawn.
 */
export abstract class EntityDefinition<TSettings extends object> {
  /** Kind stored on owners of this definition. */
  abstract readonly kind: EntityKind;

  /**
   * Returns default settings for a new owner.
   *
   * @returns Fresh settings object.
   */
  abstract settingsCreateDefault(): TSettings;

  /**
   * Returns settings that satisfy every rule of this kind.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  abstract settingsSanitize(settings: TSettings): TSettings;

  /**
   * Reads untrusted data into valid settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object.
   */
  abstract settingsFromUnknown(value: unknown): TSettings | null;

  /**
   * Rebuilds the owner's editor-only visuals for the settings.
   *
   * @param owner Entity owner group.
   * @param settings Valid settings.
   */
  abstract visualsRefresh(owner: THREE.Object3D, settings: TSettings): void;

  /**
   * Returns the icon that stands for an owner with these settings in menus, the
   * outliner, the properties panel and the viewports.
   *
   * @param settings Valid settings.
   * @returns Icon name.
   */
  abstract iconName(settings: TSettings): IconName;

  /**
   * Returns the color the icon of an owner is drawn in. Kinds with their own
   * colors override it; the default is a neutral grey.
   *
   * @param owner Entity owner group.
   * @param settings Valid settings.
   * @returns Icon color as a hex number.
   */
  iconColorHex(owner: THREE.Object3D, settings: TSettings): number {
    void owner;
    void settings;
    return ENTITY_ICON_DEFAULT_COLOR;
  }

  /**
   * Returns whether owners of this kind turn scale edits into settings and
   * always keep a unit scale. Off unless a kind enables it.
   *
   * @returns True when scale edits change settings instead of the transform.
   */
  scaleAbsorbs(): boolean {
    return false;
  }

  /**
   * Returns the settings an owner gets when it is scaled uniformly by a factor.
   * Kinds that absorb scale override it; the default keeps the settings.
   *
   * @param settings Current valid settings.
   * @param factor Positive uniform scale factor.
   * @returns Settings after the scale, before sanitizing.
   */
  scaleAbsorb(settings: TSettings, factor: number): TSettings {
    void factor;
    return settings;
  }

  /**
   * Returns the box, in the owner's local space, that the selection bounds of
   * an owner show. Kinds whose volume is larger than their marker override it;
   * the default null measures the marker itself.
   *
   * @param settings Valid settings.
   * @returns Local selection box, or null to use the marker geometry.
   */
  boundsLocal(settings: TSettings): THREE.Box3 | null {
    void settings;
    return null;
  }

  /**
   * Returns whether the selection bounds of owners of this kind offer resize
   * bars. On unless a kind turns it off.
   *
   * @returns True when the bounds may be resized.
   */
  boundsResizable(): boolean {
    return true;
  }

  /**
   * Returns the draggable handles a selected owner with these settings shows.
   * Kinds with handles override it; the default has none.
   *
   * @param settings Valid settings.
   * @returns Handles, in drawing order.
   */
  handlesCreate(settings: TSettings): EntityHandle<TSettings>[] {
    void settings;
    return [];
  }

  /**
   * Returns current settings with a partial edit from an outside caller
   * applied. Kinds whose fields depend on each other override it; the default
   * copies the given fields over the current ones.
   *
   * @param settings Current valid settings.
   * @param patch Fields to change, not yet validated.
   * @returns Merged settings, not yet validated.
   */
  settingsPatch(settings: TSettings, patch: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return { ...settings, ...patch };
  }

  /**
   * Copies settings so later edits do not alias the source.
   *
   * @param settings Source settings.
   * @returns Independent deep copy.
   */
  settingsClone(settings: TSettings): TSettings {
    return structuredClone(settings);
  }
}
