import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
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
});
