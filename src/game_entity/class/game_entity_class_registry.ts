import type { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { gameEntityClassProvidersBuiltin } from '@/game_entity/class/game_entity_class_registry_builtin.js';
import type { GameEntityAssetType, GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Every game component class the editor knows, merged from its providers: a
 * class reported by a more trusted provider hides the same class from the
 * others. Listeners hear about every change of any provider.
 */
export class GameEntityClassRegistry {
  private static readonly providers = new RegistryExtensible<GameEntityClassProvider>(gameEntityClassProvidersBuiltin);
  private static readonly subscribedProviders = new WeakSet<GameEntityClassProvider>();
  private static readonly changeListeners = new Set<() => void>();
  private static changeGeneration = 0;

  /**
   * Adds a provider after the built-in ones.
   *
   * @param provider Class provider.
   */
  static providerRegister(provider: GameEntityClassProvider): void {
    GameEntityClassRegistry.providers.register(provider);
    GameEntityClassRegistry.changedNotify();
  }

  /**
   * Removes a provider added with {@link providerRegister}.
   *
   * @param provider Class provider.
   */
  static providerUnregister(provider: GameEntityClassProvider): void {
    GameEntityClassRegistry.providers.unregister(provider);
    GameEntityClassRegistry.changedNotify();
  }

  /**
   * Returns every known class, sorted by category and label.
   *
   * @returns Merged classes.
   */
  static classesList(): GameEntityClass[] {
    const classes = GameEntityClassRegistry.mergedByTypePath((provider) => provider.listRead().classes);
    return classes.sort((first, second) =>
      `${first.category}\u0000${first.label}`.localeCompare(`${second.category}\u0000${second.label}`),
    );
  }

  /**
   * Returns the class with a type path.
   *
   * @param typePath Component type path.
   * @returns The class, or null when no provider knows it.
   */
  static classFind(typePath: string): GameEntityClass | null {
    return GameEntityClassRegistry.classesList().find((entry) => entry.type_path === typePath) ?? null;
  }

  /**
   * Returns every known asset type.
   *
   * @returns Merged asset types.
   */
  static assetTypesList(): GameEntityAssetType[] {
    return GameEntityClassRegistry.mergedByTypePath((provider) => provider.listRead().asset_types);
  }

  /**
   * Returns the asset type with a type path.
   *
   * @param typePath Asset type path.
   * @returns The asset type, or null when no provider knows it.
   */
  static assetTypeFind(typePath: string): GameEntityAssetType | null {
    return GameEntityClassRegistry.assetTypesList().find((entry) => entry.type_path === typePath) ?? null;
  }

  /**
   * Returns a number that changes whenever any provider changed.
   *
   * @returns Change counter.
   */
  static generation(): number {
    GameEntityClassRegistry.providersSubscribed();
    return GameEntityClassRegistry.changeGeneration;
  }

  /**
   * Registers a callback run whenever any provider changed.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  static changeListenerAdd(listener: () => void): () => void {
    GameEntityClassRegistry.providersSubscribed();
    GameEntityClassRegistry.changeListeners.add(listener);
    return () => GameEntityClassRegistry.changeListeners.delete(listener);
  }

  /**
   * Collects entries from every provider, keeping the first entry of each type
   * path.
   *
   * @param entriesOf Returns the entries of one provider.
   * @returns Unique entries in provider priority order.
   */
  private static mergedByTypePath<TEntry extends { type_path: string }>(
    entriesOf: (provider: GameEntityClassProvider) => readonly TEntry[],
  ): TEntry[] {
    const merged = new Map<string, TEntry>();
    for (const provider of GameEntityClassRegistry.providersSubscribed()) {
      for (const entry of entriesOf(provider)) {
        if (!merged.has(entry.type_path)) {
          merged.set(entry.type_path, entry);
        }
      }
    }
    return [...merged.values()];
  }

  /**
   * Returns the providers after making sure the registry hears their changes.
   *
   * @returns Providers in priority order.
   */
  private static providersSubscribed(): readonly GameEntityClassProvider[] {
    const providers = GameEntityClassRegistry.providers.list();
    for (const provider of providers) {
      if (!GameEntityClassRegistry.subscribedProviders.has(provider)) {
        GameEntityClassRegistry.subscribedProviders.add(provider);
        provider.changeListenerAdd(() => GameEntityClassRegistry.changedNotify());
      }
    }
    return providers;
  }

  /** Counts a change and tells every listener. */
  private static changedNotify(): void {
    GameEntityClassRegistry.changeGeneration += 1;
    GameEntityClassRegistry.changeListeners.forEach((listener) => listener());
  }
}
