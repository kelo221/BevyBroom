import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/** The section index of the Scale fields inside the panel element. */
const PANEL_SECTION_INDEX_SCALE = 2;

/**
 * Returns the Scale section element of a panel.
 *
 * @param panel The properties panel.
 * @returns The Scale section element.
 */
function scaleSectionRead(panel: PanelProperties): HTMLElement {
  const section = panel.getContainer().children[PANEL_SECTION_INDEX_SCALE];
  if (!(section instanceof HTMLElement)) {
    throw new Error('panel has no Scale section');
  }
  return section;
}

/**
 * Types a value into the first Scale input and commits it.
 *
 * @param panel The properties panel.
 * @param text Text to commit.
 */
function scaleFirstInputCommit(panel: PanelProperties, text: string): void {
  const input = scaleSectionRead(panel).querySelector('input');
  if (!input) {
    throw new Error('Scale section has no input');
  }
  input.value = text;
  input.dispatchEvent(new Event('change'));
}

/** Lights hide the Scale fields; scaling a mixed selection changes light radii. */
describe('PanelProperties scale absorb', () => {
  let container: HTMLElement;
  let panel: PanelProperties;
  let commandStack: CommandStack;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    commandStack = new CommandStack(64);
    panel = new PanelProperties(container, Theme, new ManagerSelection());
    panel.setCommandStack(commandStack);
  });

  afterEach(() => {
    panel.dispose();
    container.remove();
  });

  it('hides the Scale fields when only lights are inspected and shows them for meshes', () => {
    panel.bindObjects([LightOwner.createDefault('Lamp', 'point')]);
    expect(scaleSectionRead(panel).style.display).toBe('none');
    panel.bindObject(new THREE.Mesh());
    expect(scaleSectionRead(panel).style.display).not.toBe('none');
  });

  it('turns a typed scale on a mixed selection into a light radius in one undo step', () => {
    const settings = lightSettingsCreateDefault('point');
    const light = LightOwner.create('Lamp', settings);
    const mesh = new THREE.Mesh();
    panel.bindObjects([mesh, light]);
    expect(scaleSectionRead(panel).style.display).not.toBe('none');
    scaleFirstInputCommit(panel, '2');
    expect(mesh.scale.x).toBeCloseTo(2);
    expect(light.scale.toArray()).toEqual([1, 1, 1]);
    expect(LightOwner.settingsRead(light)?.radius).toBeCloseTo(settings.radius * 2);
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(mesh.scale.x).toBeCloseTo(1);
    expect(LightOwner.settingsRead(light)?.radius).toBe(settings.radius);
  });
});
