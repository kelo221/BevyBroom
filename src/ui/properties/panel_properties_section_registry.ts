import type {
  PanelPropertiesSection,
  PanelPropertiesSectionChrome,
  PanelPropertiesSectionFactory,
} from '@/ui/properties/panel_properties_section.js';
import { panelPropertiesSectionFactoriesBuiltin } from '@/ui/properties/panel_properties_section_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Lists the inspector sections every properties panel creates: the built-in
 * ones followed by sections features register. Register before the panel is
 * created.
 */
export class PanelPropertiesSectionRegistry {
  private static readonly factories = new RegistryExtensible<PanelPropertiesSectionFactory>(
    panelPropertiesSectionFactoriesBuiltin,
  );

  /**
   * Adds a section factory after the built-in ones.
   *
   * @param factory Section factory.
   */
  static register(factory: PanelPropertiesSectionFactory): void {
    PanelPropertiesSectionRegistry.factories.register(factory);
  }

  /**
   * Removes a section factory added with {@link register}.
   *
   * @param factory Section factory.
   */
  static unregister(factory: PanelPropertiesSectionFactory): void {
    PanelPropertiesSectionRegistry.factories.unregister(factory);
  }

  /**
   * Creates one instance of every registered section.
   *
   * @param chrome Element factories of the hosting panel.
   * @returns Sections in display order.
   */
  static sectionsCreate(chrome: PanelPropertiesSectionChrome): PanelPropertiesSection[] {
    return PanelPropertiesSectionRegistry.factories.list().map((factory) => factory(chrome));
  }
}
