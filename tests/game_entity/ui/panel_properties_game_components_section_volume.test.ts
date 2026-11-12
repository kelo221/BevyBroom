import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PanelPropertiesGameComponentsSection } from '@/game_entity/ui/panel_properties_game_components_section.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import type { PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';
import { testClassesInstall } from '../game_entity_test_classes.js';

/** Element factories a test section is built with. */
const SECTION_CHROME: PanelPropertiesSectionChrome = {
  createSectionContainer: () => document.createElement('div'),
  createSectionHeader: () => document.createElement('div'),
};

/**
 * Creates a plain world brush, a box with no class of its own.
 *
 * @returns Brush mesh.
 */
function plainBrushCreate(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

/**
 * The Game Components section stays hidden for modifier volumes, which the game
 * never receives, and shows for plain brushes.
 */
describe('PanelPropertiesGameComponentsSection for modifier volumes', () => {
  let uninstall: () => void = () => {};

  afterEach(() => {
    uninstall();
    uninstall = () => {};
  });

  it('hides the section for a selected modifier volume', () => {
    uninstall = testClassesInstall().uninstall;
    const section = new PanelPropertiesGameComponentsSection(SECTION_CHROME);
    section.updateFromObjects([ModifierVolume.create({})]);
    expect(section.getElement().style.display).toBe('none');
  });

  it('shows the section for a selected plain brush', () => {
    uninstall = testClassesInstall().uninstall;
    const section = new PanelPropertiesGameComponentsSection(SECTION_CHROME);
    section.updateFromObjects([plainBrushCreate()]);
    expect(section.getElement().style.display).toBe('block');
  });

  it('hides the section for a mixed selection that holds a modifier volume', () => {
    uninstall = testClassesInstall().uninstall;
    const section = new PanelPropertiesGameComponentsSection(SECTION_CHROME);
    section.updateFromObjects([plainBrushCreate(), ModifierVolume.create({})]);
    expect(section.getElement().style.display).toBe('none');
  });
});
