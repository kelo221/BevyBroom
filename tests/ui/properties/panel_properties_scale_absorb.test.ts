import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

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

/**
 * Selections holding a light or a point game entity hide the Scale fields;
 * meshes and rooms keep them and scale through them.
 */
describe('PanelProperties scale absorb', () => {
  let container: HTMLElement;
  let panel: PanelProperties;
  let commandStack: CommandStack;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    commandStack = new CommandStack(64);
    panel = new PanelProperties(Theme, new ManagerSelection());
    panel.hostAttach(container);
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

  it('hides the Scale fields on a mixed selection holding a light or a game entity', () => {
    const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
    panel.bindObjects([new THREE.Mesh(), light]);
    expect(scaleSectionRead(panel).style.display).toBe('none');
    panel.bindObjects([new THREE.Mesh(), GameEntityOwner.createDefault('door_main')]);
    expect(scaleSectionRead(panel).style.display).toBe('none');
  });

  it('keeps the Scale fields for rooms and scales a typed value in one undo step', () => {
    const room = RoomOwner.createDefault('Hall');
    panel.bindObjects([new THREE.Mesh(), room]);
    expect(scaleSectionRead(panel).style.display).not.toBe('none');
    scaleFirstInputCommit(panel, '2');
    expect(room.scale.x).toBeCloseTo(2);
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(room.scale.x).toBeCloseTo(1);
  });
});
