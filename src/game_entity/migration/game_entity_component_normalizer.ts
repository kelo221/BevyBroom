import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import {
  type GameEntityClassAbsorb,
  gameEntityClassRenameNormalize,
} from '@/game_entity/class/game_entity_class_migration_schema.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewComponentFields, PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** What one rewrite of a component changed. */
export type GameEntityComponentRewriteKind = 'class' | 'variant' | 'default';

/** One change normalizing made to an object's components. */
export interface GameEntityComponentRewrite {
  readonly kind: GameEntityComponentRewriteKind;
  /** Sentence naming the old and the new name or value. */
  readonly description: string;
}

/** Components after normalizing, with every change made. */
export interface GameEntityComponentNormalization {
  readonly components: GameEntityComponents;
  readonly rewrites: readonly GameEntityComponentRewrite[];
}

/** Where a component of an old type path goes, with what it left out meant. */
interface GameEntityComponentMove {
  readonly gameClass: GameEntityClass;
  readonly fields: PreviewComponentFields;
}

/**
 * Brings an object's components up to the current classes: components of
 * renamed or absorbed classes move into the class that now holds them, old enum
 * values become their new names, and every enum field a component leaves out
 * gets the value it means written in, so a later change of a class default
 * never changes the object.
 */
export class GameEntityComponentNormalizer {
  private static cached: GameEntityComponentNormalizer | null = null;
  private static cachedGeneration = -1;
  private readonly classesByTypePath: ReadonlyMap<string, GameEntityClass>;
  private readonly formerClassesByTypePath: ReadonlyMap<string, GameEntityClass>;
  private readonly classes: readonly GameEntityClass[];

  /**
   * Creates a normalizer.
   *
   * @param classes Current classes.
   * @param formerClasses Classes as an older copy knew them, such as the copy a
   *   level carries; read for what old components left out.
   */
  constructor(classes: readonly GameEntityClass[], formerClasses: readonly GameEntityClass[]) {
    this.classes = classes;
    this.classesByTypePath = new Map(classes.map((gameClass) => [gameClass.type_path, gameClass]));
    this.formerClassesByTypePath = new Map(formerClasses.map((gameClass) => [gameClass.type_path, gameClass]));
  }

  /**
   * Returns a normalizer of the classes the editor shows, reading old defaults
   * from the copy the open level carries. The normalizer is reused until the
   * classes change.
   *
   * @returns Normalizer.
   */
  static current(): GameEntityComponentNormalizer {
    const generation = GameEntityClassRegistry.generation();
    if (
      GameEntityComponentNormalizer.cached === null ||
      GameEntityComponentNormalizer.cachedGeneration !== generation
    ) {
      GameEntityComponentNormalizer.cached = new GameEntityComponentNormalizer(
        GameEntityClassRegistry.classesList(),
        GameEntityClassProviderScene.shared.listRead().classes,
      );
      GameEntityComponentNormalizer.cachedGeneration = generation;
    }
    return GameEntityComponentNormalizer.cached;
  }

  /**
   * Returns an object's components brought up to the current classes.
   *
   * @param components Component overrides of the object.
   * @returns New components and the changes made; the input is left alone.
   */
  normalize(components: GameEntityComponents): GameEntityComponentNormalization {
    const filled: GameEntityComponents = {};
    const explicit: GameEntityComponents = {};
    const rewrites: GameEntityComponentRewrite[] = [];
    for (const [typePath, fields] of Object.entries(components)) {
      const move = this.moveOf(typePath, fields);
      if (move !== null) {
        rewrites.push({ kind: 'class', description: `${this.labelOf(typePath)} became ${move.gameClass.label}` });
      }
      const targetTypePath = move?.gameClass.type_path ?? typePath;
      filled[targetTypePath] = { ...(move?.fields ?? fields), ...(filled[targetTypePath] ?? {}) };
      explicit[targetTypePath] = { ...fields, ...(explicit[targetTypePath] ?? {}) };
    }
    const normalized = GameEntityComponentNormalizer.explicitOverFilled(filled, explicit);
    this.enumFieldsSettle(normalized, rewrites);
    return { components: normalized, rewrites };
  }

  /**
   * Joins the values components were stored with over the values filled in for
   * what they left out, so a value someone set always beats a filled one when
   * two old components land in one class.
   *
   * @param filled Components with filled-in values, by type path.
   * @param explicit The values the components were stored with, by type path.
   * @returns Joined components.
   */
  private static explicitOverFilled(
    filled: GameEntityComponents,
    explicit: GameEntityComponents,
  ): GameEntityComponents {
    return Object.fromEntries(
      Object.entries(filled).map(([typePath, fields]) => [typePath, { ...fields, ...(explicit[typePath] ?? {}) }]),
    );
  }

  /**
   * Returns where a component goes when a class absorbs it or was renamed from
   * its type path.
   *
   * @param typePath Type path the component is stored under.
   * @param fields Its overrides.
   * @returns The class taking it with its overrides, or null when it stays.
   */
  private moveOf(typePath: string, fields: PreviewComponentFields): GameEntityComponentMove | null {
    for (const gameClass of this.classes) {
      const absorb = (gameClass.absorbs ?? []).find((candidate) => this.absorbMatches(candidate, typePath, fields));
      if (absorb !== undefined) {
        return { gameClass, fields: { [absorb.field]: this.absorbValueOf(absorb, typePath, fields), ...fields } };
      }
    }
    return this.classesByTypePath.has(typePath) ? null : this.renameMoveOf(typePath, fields);
  }

  /**
   * Returns whether an absorbed class rule takes a component.
   *
   * @param absorb Rule of the absorbing class.
   * @param typePath Type path the component is stored under.
   * @param fields Its overrides.
   * @returns True when the component's class matches and its field holds a
   *   listed value.
   */
  private absorbMatches(absorb: GameEntityClassAbsorb, typePath: string, fields: PreviewComponentFields): boolean {
    if (absorb.from !== typePath) {
      return false;
    }
    const value = this.absorbValueOf(absorb, typePath, fields);
    return typeof value === 'string' && absorb.variants.includes(value);
  }

  /**
   * Returns the value a component holds in the field an absorbed class rule
   * reads.
   *
   * @param absorb Rule of the absorbing class.
   * @param typePath Type path the component is stored under.
   * @param fields Its overrides.
   * @returns The override, otherwise the rule's old default, otherwise the old
   *   class's default from the older copy, otherwise the current default.
   */
  private absorbValueOf(
    absorb: GameEntityClassAbsorb,
    typePath: string,
    fields: PreviewComponentFields,
  ): PreviewFieldValue {
    if (absorb.field in fields) {
      return fields[absorb.field] ?? null;
    }
    const formerDefault = this.defaultOf(this.formerClassesByTypePath.get(typePath), absorb.field);
    return (
      absorb.default ?? formerDefault ?? this.defaultOf(this.classesByTypePath.get(typePath), absorb.field) ?? null
    );
  }

  /**
   * Returns where a component of a renamed type path goes.
   *
   * @param typePath Old type path.
   * @param fields Its overrides.
   * @returns The renamed class with the overrides, the rule's old defaults and
   *   the old class's defaults that differ from the new ones filled in, or null
   *   when no class was renamed from the type path.
   */
  private renameMoveOf(typePath: string, fields: PreviewComponentFields): GameEntityComponentMove | null {
    for (const gameClass of this.classes) {
      const rename = (gameClass.renamed_from ?? [])
        .map(gameEntityClassRenameNormalize)
        .find((entry) => entry.type_path === typePath);
      if (rename !== undefined) {
        const formerDefaults = this.formerDefaultsDiffering(this.formerClassesByTypePath.get(typePath), gameClass);
        return { gameClass, fields: { ...formerDefaults, ...(rename.defaults ?? {}), ...fields } };
      }
    }
    return null;
  }

  /**
   * Returns the defaults an old class gave fields the new class defaults
   * differently.
   *
   * @param formerClass Old class from an older copy, or undefined.
   * @param gameClass New class.
   * @returns Old defaults by field path.
   */
  private formerDefaultsDiffering(
    formerClass: GameEntityClass | undefined,
    gameClass: GameEntityClass,
  ): PreviewComponentFields {
    const defaults: PreviewComponentFields = {};
    for (const field of GameEntityComponentResolver.fieldsLeaf(formerClass?.fields ?? [])) {
      const current = GameEntityComponentResolver.fieldFind(gameClass, field.path);
      if (current !== null && JSON.stringify(current.default) !== JSON.stringify(field.default)) {
        defaults[field.path] = field.default;
      }
    }
    return defaults;
  }

  /**
   * Renames old enum values and writes in the values of enum fields left out,
   * for every component of a known class.
   *
   * @param components Components being normalized, changed in place.
   * @param rewrites Receives the changes.
   */
  private enumFieldsSettle(components: GameEntityComponents, rewrites: GameEntityComponentRewrite[]): void {
    for (const [typePath, fields] of Object.entries(components)) {
      const gameClass = this.classesByTypePath.get(typePath);
      const enumFields = GameEntityComponentResolver.fieldsLeaf(gameClass?.fields ?? []).filter(
        (field) => field.kind === 'enum',
      );
      for (const field of enumFields) {
        const rewrite = this.enumFieldSettle(gameClass?.label ?? typePath, field, fields);
        if (rewrite !== null) {
          rewrites.push(rewrite);
        }
      }
    }
  }

  /**
   * Renames an old value of one enum field or writes in its default.
   *
   * @param classLabel Label of the class, for the description.
   * @param field Enum field.
   * @param fields Overrides of the component, changed in place.
   * @returns The change made, or null when the field already holds a current
   *   value.
   */
  private enumFieldSettle(
    classLabel: string,
    field: GameEntityClass['fields'][number],
    fields: PreviewComponentFields,
  ): GameEntityComponentRewrite | null {
    const value = fields[field.path];
    if (value === undefined) {
      fields[field.path] = field.default;
      const description = `${classLabel} ${field.label} had no value; filled from the class default "${String(field.default)}"`;
      return { kind: 'default', description };
    }
    const renamed = typeof value === 'string' ? field.renamed_variants?.[value] : undefined;
    if (renamed === undefined) {
      return null;
    }
    fields[field.path] = renamed;
    return { kind: 'variant', description: `${classLabel} ${field.label} "${String(value)}" became "${renamed}"` };
  }

  /**
   * Returns the default of a field of a class.
   *
   * @param gameClass Class, or undefined.
   * @param path Field path.
   * @returns Default, or undefined when the class or field is unknown.
   */
  private defaultOf(gameClass: GameEntityClass | undefined, path: string): PreviewFieldValue | undefined {
    const field = gameClass === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, path);
    return field === null ? undefined : field.default;
  }

  /**
   * Returns the label of a type path: the label an older copy gives it, else
   * its last segment.
   *
   * @param typePath Type path.
   * @returns Label.
   */
  private labelOf(typePath: string): string {
    return this.formerClassesByTypePath.get(typePath)?.label ?? typePath.split('::').pop() ?? typePath;
  }
}
