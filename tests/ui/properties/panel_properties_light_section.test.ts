import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { IconRegistry } from '@/ui/icons/icon_registry.js';
import { PanelPropertiesLightSection } from '@/ui/properties/panel_properties_light_section.js';

/**
 * Creates the section with plain containers.
 *
 * @returns Light section.
 */
function createSection(): PanelPropertiesLightSection {
  return new PanelPropertiesLightSection(
    () => document.createElement('div'),
    (title) => {
      const header = document.createElement('h3');
      header.textContent = title;
      return header;
    },
  );
}

/**
 * Finds a field by its accessible name.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name.
 * @returns The input or select element, or null.
 */
function fieldFind(
  section: PanelPropertiesLightSection,
  ariaLabel: string,
): HTMLInputElement | HTMLSelectElement | null {
  const field = section.getElement().querySelector(`[aria-label="${ariaLabel}"]`);
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field : null;
}

/**
 * Types a value into a field and commits it.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name.
 * @param value New value text.
 */
function fieldCommit(section: PanelPropertiesLightSection, ariaLabel: string, value: string): void {
  const field = fieldFind(section, ariaLabel);
  if (!field) throw new Error(`missing field ${ariaLabel}`);
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * Returns whether the row holding a field is visible.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name of the row field.
 * @returns True when the row is shown.
 */
function fieldRowShown(section: PanelPropertiesLightSection, ariaLabel: string): boolean {
  return fieldFind(section, ariaLabel)?.parentElement?.style.display !== 'none';
}

/**
 * Creates fixture groups that each hold a fixture mesh and one light, like
 * copies of a lamp prefab.
 *
 * @param fixtureCount Number of fixtures.
 * @returns Fixture groups.
 */
function fixturesCreate(fixtureCount: number): THREE.Group[] {
  return Array.from({ length: fixtureCount }, (_unused, index) => {
    const fixture = new THREE.Group();
    fixture.name = `Fixture.${index}`;
    fixture.add(new THREE.Mesh(), LightOwner.createDefault('Lamp', 'point'));
    return fixture;
  });
}

/**
 * Returns the light inside a fixture group.
 *
 * @param fixture Fixture group.
 * @returns The fixture's light.
 */
function fixtureLightRead(fixture: THREE.Group): THREE.Object3D {
  const light = fixture.children.find((child) => LightOwner.isOwner(child));
  if (!light) throw new Error('fixture without light');
  return light;
}

/**
 * The light inspector edits authored lights with undo and hides itself for
 * other objects.
 */
describe('light inspector section', () => {
  it('appears only when every selected object is a light', () => {
    const section = createSection();
    section.updateFromObjects([LightOwner.createDefault('Lamp', 'point')]);
    expect(section.getElement().style.display).toBe('block');
    section.updateFromObjects([LightOwner.createDefault('Lamp', 'point'), new THREE.Group()]);
    expect(section.getElement().style.display).toBe('none');
  });

  it('edits the lights inside every selected fixture group as one undo step', () => {
    const stack = new CommandStack(8);
    const section = createSection();
    const fixtures = fixturesCreate(4);
    const lights = fixtures.map(fixtureLightRead);
    const originalIntensity = LightOwner.settingsRead(lights[0] ?? new THREE.Group())?.intensity;
    const editedIntensity = (originalIntensity ?? 0) + 3;
    section.setCommandStack(stack);
    section.updateFromObjects(fixtures);
    expect(section.getElement().style.display).toBe('block');
    expect(section.getElement().querySelector('h3')?.textContent).toContain(`(${fixtures.length})`);
    fieldCommit(section, 'Light intensity', String(editedIntensity));
    expect(lights.map((light) => LightOwner.settingsRead(light)?.intensity)).toEqual(lights.map(() => editedIntensity));
    stack.undo();
    expect(lights.map((light) => LightOwner.settingsRead(light)?.intensity)).toEqual(
      lights.map(() => originalIntensity),
    );
  });

  it('hides when one selected group holds no light', () => {
    const section = createSection();
    const emptyGroup = new THREE.Group();
    emptyGroup.add(new THREE.Mesh());
    section.updateFromObjects([...fixturesCreate(2), emptyGroup]);
    expect(section.getElement().style.display).toBe('none');
  });

  it('edits the light of an array source and leaves its copies to the source', () => {
    const section = createSection();
    const [source, copy] = fixturesCreate(2);
    if (!source || !copy) throw new Error('fixtures missing');
    EntityArrayCopyMark.write(copy, { cell: [1, 0, 0], signature: 'copy-signature' });
    source.add(copy);
    const copyIntensity = LightOwner.settingsRead(fixtureLightRead(copy))?.intensity;
    section.updateFromObjects([source]);
    expect(section.getElement().querySelector('h3')?.textContent).toBe('Light');
    fieldCommit(section, 'Light intensity', String((copyIntensity ?? 0) + 5));
    expect(LightOwner.settingsRead(fixtureLightRead(source))?.intensity).toBe((copyIntensity ?? 0) + 5);
    expect(LightOwner.settingsRead(fixtureLightRead(copy))?.intensity).toBe(copyIntensity);
  });

  it('shows no count for a single light', () => {
    const section = createSection();
    section.updateFromObjects(fixturesCreate(1));
    expect(section.getElement().querySelector('h3')?.textContent).toBe('Light');
  });

  it('shows the cone angles only for spot lights', () => {
    const section = createSection();
    section.updateFromObjects([LightOwner.createDefault('Lamp', 'point')]);
    expect(fieldRowShown(section, 'Spot outer angle')).toBe(false);
    section.updateFromObjects([LightOwner.createDefault('Spot', 'spot')]);
    expect(fieldRowShown(section, 'Spot outer angle')).toBe(true);
  });

  it('commits radius, type and color edits through undo', () => {
    const stack = new CommandStack(8);
    const section = createSection();
    const light = LightOwner.createDefault('Lamp', 'point');
    const originalRadius = LightOwner.settingsRead(light)?.radius;
    section.setCommandStack(stack);
    section.updateFromObjects([light]);
    fieldCommit(section, 'Light radius', '11');
    fieldCommit(section, 'Light type', 'spot');
    fieldCommit(section, 'Light color', '#00ff00');
    expect(LightOwner.settingsRead(light)).toMatchObject({ radius: 11, kind: 'spot', colorHex: 0x00ff00 });
    stack.undo();
    stack.undo();
    stack.undo();
    expect(LightOwner.settingsRead(light)?.radius).toBe(originalRadius);
    expect(LightOwner.settingsRead(light)?.kind).toBe('point');
  });

  it('turns a light off and back on and restores invalid numeric text', () => {
    const section = createSection();
    const light = LightOwner.createDefault('Lamp', 'point');
    section.updateFromObjects([light]);
    fieldCommit(section, 'Light enabled', 'off');
    expect(LightOwner.settingsRead(light)?.enabled).toBe(false);
    fieldCommit(section, 'Light enabled', 'on');
    expect(LightOwner.settingsRead(light)?.enabled).toBe(true);
    const intensity = LightOwner.settingsRead(light)?.intensity;
    fieldCommit(section, 'Light intensity', 'not a number');
    expect(LightOwner.settingsRead(light)?.intensity).toBe(intensity);
  });

  it('shows the icon of the inspected light kind in its header', () => {
    const section = createSection();
    const headerIconPath = (): string | null | undefined =>
      section.getElement().querySelector('h3 svg path')?.getAttribute('d');
    section.updateFromObjects([LightOwner.createDefault('Spot', 'spot')]);
    const spotIcon = LightOwner.definition.iconName(lightSettingsCreateDefault('spot'));
    expect(headerIconPath()).toBe(IconRegistry.pathOf(spotIcon));
    section.updateFromObjects([LightOwner.createDefault('Point', 'point')]);
    const pointIcon = LightOwner.definition.iconName(lightSettingsCreateDefault('point'));
    expect(headerIconPath()).toBe(IconRegistry.pathOf(pointIcon));
    expect(section.getElement().querySelectorAll('h3 svg')).toHaveLength(1);
  });
});
