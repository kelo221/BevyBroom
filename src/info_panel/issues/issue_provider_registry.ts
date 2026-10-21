import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { issueProvidersBuiltin } from '@/info_panel/issues/issue_provider_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Lists the checks run when the map is validated: the built-in providers
 * followed by providers features register.
 */
export class IssueProviderRegistry {
  private static readonly providers = new RegistryExtensible<IssueProvider>(issueProvidersBuiltin);

  /**
   * Adds a provider after the built-in ones.
   *
   * @param provider Issue provider.
   */
  static register(provider: IssueProvider): void {
    IssueProviderRegistry.providers.register(provider);
  }

  /**
   * Removes a provider added with {@link register}.
   *
   * @param provider Issue provider.
   */
  static unregister(provider: IssueProvider): void {
    IssueProviderRegistry.providers.unregister(provider);
  }

  /**
   * Returns every provider in report order.
   *
   * @returns Shared read-only list.
   */
  static providersList(): readonly IssueProvider[] {
    return IssueProviderRegistry.providers.list();
  }

  /**
   * Runs every provider over the world.
   *
   * @param worldGroup Editor world root.
   * @returns Issues of every provider, in provider order.
   */
  static issuesCollect(worldGroup: THREE.Object3D): Issue[] {
    return IssueProviderRegistry.providersList().flatMap((provider) => provider.collect(worldGroup));
  }
}
