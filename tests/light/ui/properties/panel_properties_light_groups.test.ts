import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { PanelPropertiesLightSection } from '@/ui/properties/panel_properties_light_section.js';

/** A light section over a fresh undo stack. */
interface LightGroupRig {
  section: PanelPropertiesLightSection;
  commandStack: CommandStack;
}

/**
 * Creates the light section with plain containers and an undo stack, with every
 * collapsible group expanded.
 *
 * @returns The rig.
 */
function lightGroupRigCreate(): LightGroupRig {
  const section = new PanelPropertiesLightSection(
    () => document.createElement('div'),
    (title) => Object.assign(document.createElement('h3'), { textContent: title }),
  );
  const commandStack = new CommandStack(32);
  section.setCommandStack(commandStack);
  section
    .getElement()
    .querySelectorAll<HTMLElement>('[role="button"]')
    .forEach((header) => header.click());
  return { section, commandStack };
}

/**
 * Finds a field by its accessible name or fails the test.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name.
 * @returns The input or select element.
 */
function fieldFind(section: PanelPropertiesLightSection, ariaLabel: string): HTMLInputElement | HTMLSelectElement {
  const field = section.getElement().querySelector(`[aria-label="${ariaLabel}"]`);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
    throw new Error(`missing field ${ariaLabel}`);
  }
  return field;
}

/**
 * Sets a field's value and fires its commit event.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name.
 * @param value New value text.
 */
function fieldCommit(section: PanelPropertiesLightSection, ariaLabel: string, value: string): void {
  const field = fieldFind(section, ariaLabel);
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * Returns whether the row and group around a field are shown.
 *
 * @param section Light section.
 * @param ariaLabel Accessible name.
 * @returns True when no ancestor up to the section is hidden.
 */
function fieldShown(section: PanelPropertiesLightSection, ariaLabel: string): boolean {
  let element: HTMLElement | null = fieldFind(section, ariaLabel).parentElement;
  while (element && element !== section.getElement()) {
    if (element.style.display === 'none') {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}

/**
 * Creates a light of a kind and binds it to the section.
 *
 * @param rig The rig.
 * @param kind Point or spot.
 * @returns The light owner.
 */
function lightBind(rig: LightGroupRig, kind: 'point' | 'spot'): THREE.Object3D {
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault(kind));
  rig.section.updateFromObjects([light]);
  return light;
}

/** The effect, cookie, fog, shimmer and baking groups of the light section. */
describe('light section feature groups', () => {
  it('commits an effect as one undoable edit and shows its fields once animated', () => {
    const rig = lightGroupRigCreate();
    const light = lightBind(rig, 'point');
    expect(fieldShown(rig.section, 'Light effect minimum')).toBe(false);
    fieldCommit(rig.section, 'Light effect', 'candle');
    expect(LightOwner.settingsRead(light)?.effectKind).toBe('candle');
    expect(fieldShown(rig.section, 'Light effect minimum')).toBe(true);
    rig.commandStack.undo();
    expect(LightOwner.settingsRead(light)?.effectKind).toBe('steady');
  });

  it('shows the cookie group for spot lights only and commits a typed path', () => {
    const rig = lightGroupRigCreate();
    lightBind(rig, 'point');
    expect(fieldShown(rig.section, 'Light cookie')).toBe(false);
    const spot = lightBind(rig, 'spot');
    expect(fieldShown(rig.section, 'Light cookie')).toBe(true);
    fieldCommit(rig.section, 'Light cookie', 'textures/gobo.png');
    expect(LightOwner.settingsRead(spot)?.cookieTexture).toBe('textures/gobo.png');
    rig.commandStack.undo();
    expect(LightOwner.settingsRead(spot)?.cookieTexture).toBe('');
  });

  it('reveals the fog fields when fog is turned on and edits the fog radius', () => {
    const rig = lightGroupRigCreate();
    const light = lightBind(rig, 'spot');
    expect(fieldShown(rig.section, 'Light fog radius')).toBe(false);
    fieldCommit(rig.section, 'Light fog', 'on');
    expect(fieldShown(rig.section, 'Light fog radius')).toBe(true);
    const requestedRadius = lightSettingsCreateDefault('spot').fogRadius + 1.5;
    fieldCommit(rig.section, 'Light fog radius', String(requestedRadius));
    expect(LightOwner.settingsRead(light)?.fogRadius).toBeCloseTo(requestedRadius);
    expect(rig.commandStack.getUndoCount()).toBe(2);
  });

  it('commits shimmer and bounce settings', () => {
    const rig = lightGroupRigCreate();
    const light = lightBind(rig, 'point');
    fieldCommit(rig.section, 'Light shimmer', 'water');
    fieldCommit(rig.section, 'Light illumination', 'single_bounce');
    fieldCommit(rig.section, 'Light bounce samples', '64');
    const settings = LightOwner.settingsRead(light);
    expect(settings?.shimmer).toBe('water');
    expect(settings?.illumination).toBe('single_bounce');
    expect(settings?.bounceSamples).toBe(64);
  });

  it('scales the fog radius of every bound light by its own factor when a radius is typed', () => {
    const rig = lightGroupRigCreate();
    const small = LightOwner.create('A', lightSettingsCreateDefault('spot'));
    const smallSettings = LightOwner.settingsRead(small);
    if (!smallSettings) throw new Error('settings');
    const large = LightOwner.create('B', { ...smallSettings, radius: smallSettings.radius * 2 });
    rig.section.updateFromObjects([small, large]);
    const typedRadius = smallSettings.radius * 3;
    fieldCommit(rig.section, 'Light radius', String(typedRadius));
    expect(LightOwner.settingsRead(small)?.fogRadius).toBeCloseTo(smallSettings.fogRadius * 3);
    expect(LightOwner.settingsRead(large)?.fogRadius).toBeCloseTo(smallSettings.fogRadius * 1.5);
    rig.commandStack.undo();
    expect(LightOwner.settingsRead(small)?.fogRadius).toBeCloseTo(smallSettings.fogRadius);
  });

  it('does not overwrite mixed choices when the select is left blank', () => {
    const rig = lightGroupRigCreate();
    const steady = LightOwner.create('A', lightSettingsCreateDefault('point'));
    const flicker = LightOwner.create('B', { ...lightSettingsCreateDefault('point'), effectKind: 'flicker' });
    rig.section.updateFromObjects([steady, flicker]);
    fieldCommit(rig.section, 'Light effect', '');
    expect(rig.commandStack.getUndoCount()).toBe(0);
    expect(LightOwner.settingsRead(flicker)?.effectKind).toBe('flicker');
  });
});
