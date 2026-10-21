import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { PanelPropertiesGameComponentsSection } from '@/game_entity/ui/panel_properties_game_components_section.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
  testDoorField,
} from '../game_entity_test_classes.js';

/**
 * Creates the section with plain chrome and an undo stack.
 *
 * @returns Section and its stack.
 */
function sectionCreate(): { section: PanelPropertiesGameComponentsSection; stack: CommandStack } {
  const section = new PanelPropertiesGameComponentsSection({
    createSectionContainer: () => document.createElement('section'),
    createSectionHeader: (title) => Object.assign(document.createElement('h3'), { textContent: title }),
  });
  const stack = new CommandStack(16);
  section.setCommandStack(stack);
  return { section, stack };
}

/**
 * Returns the row of a field inside a component block.
 *
 * @param section Section.
 * @param typePath Component type path.
 * @param path Field path.
 * @returns Row element, or null.
 */
function fieldRow(section: PanelPropertiesGameComponentsSection, typePath: string, path: string): HTMLElement | null {
  return section.getElement().querySelector(`[data-game-component="${typePath}"] [data-field-path="${path}"]`);
}

/**
 * The inspector shows the components the whole selection shares, highlights
 * overridden fields and turns edits, resets, additions and removals into
 * undoable steps for every selected object.
 */
describe('PanelPropertiesGameComponentsSection', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('shows shared components only and counts the others', () => {
    const { section } = sectionCreate();
    const first = new THREE.Mesh();
    const second = new THREE.Mesh();
    GameEntityComponentStore.write(first, { [TEST_SPINNER_TYPE_PATH]: {}, [TEST_DOOR_TYPE_PATH]: {} });
    GameEntityComponentStore.write(second, { [TEST_SPINNER_TYPE_PATH]: {} });
    section.updateFromObjects([first, second]);
    expect(section.getElement().style.display).toBe('block');
    const blocks = [...section.getElement().querySelectorAll('[data-game-component]')];
    expect(blocks.map((block) => (block as HTMLElement).dataset['gameComponent'])).toEqual([TEST_SPINNER_TYPE_PATH]);
    expect(section.getElement().textContent).toContain('1 more on part of the selection');
  });

  it('highlights overrides, resets them and undoes the reset', () => {
    const { section, stack } = sectionCreate();
    const object = new THREE.Mesh();
    const speed = testDoorField('speed');
    GameEntityComponentStore.write(object, { [TEST_DOOR_TYPE_PATH]: { speed: (speed.default as number) + 2 } });
    section.updateFromObjects([object]);
    expect(fieldRow(section, TEST_DOOR_TYPE_PATH, 'speed')?.dataset['overridden']).toBe('true');
    expect(fieldRow(section, TEST_DOOR_TYPE_PATH, 'locked')?.dataset['overridden']).toBe('false');
    fieldRow(section, TEST_DOOR_TYPE_PATH, 'speed')?.querySelector('button')?.click();
    expect(GameEntityComponentStore.read(object)).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
    expect(fieldRow(section, TEST_DOOR_TYPE_PATH, 'speed')?.dataset['overridden']).toBe('false');
    stack.undo();
    section.updateFromObjects([object]);
    expect(fieldRow(section, TEST_DOOR_TYPE_PATH, 'speed')?.dataset['overridden']).toBe('true');
  });

  it('edits a field of every selected object in one undoable step', () => {
    const { section, stack } = sectionCreate();
    const objects = [new THREE.Mesh(), new THREE.Group()];
    objects.forEach((object) => GameEntityComponentStore.write(object, { [TEST_DOOR_TYPE_PATH]: {} }));
    section.updateFromObjects(objects);
    const input = fieldRow(section, TEST_DOOR_TYPE_PATH, 'uses')?.querySelector('input');
    if (!input) throw new Error('the uses field has an input');
    input.value = '9';
    input.dispatchEvent(new Event('change'));
    objects.forEach((object) =>
      expect(GameEntityComponentStore.read(object)).toEqual({ [TEST_DOOR_TYPE_PATH]: { uses: 9 } }),
    );
    expect(stack.getUndoCount()).toBe(1);
  });

  it('adds and removes components, offering point classes on game entities only', () => {
    const { section } = sectionCreate();
    const mesh = new THREE.Mesh();
    section.updateFromObjects([mesh]);
    const select = section.getElement().querySelector('select[aria-label="Add game component"]') as HTMLSelectElement;
    const offered = [...select.options].map((option) => option.value);
    expect(offered).toContain(TEST_SPINNER_TYPE_PATH);
    expect(offered).not.toContain(TEST_DOOR_TYPE_PATH);
    select.value = TEST_SPINNER_TYPE_PATH;
    select.dispatchEvent(new Event('change'));
    expect(GameEntityComponentStore.read(mesh)).toEqual({ [TEST_SPINNER_TYPE_PATH]: {} });
    section
      .getElement()
      .querySelector<HTMLButtonElement>(`[data-game-component="${TEST_SPINNER_TYPE_PATH}"] button`)
      ?.click();
    expect(GameEntityComponentStore.hasAny(mesh)).toBe(false);
    section.updateFromObjects([GameEntityOwner.createDefault('Point')]);
    const pointSelect = section
      .getElement()
      .querySelector('select[aria-label="Add game component"]') as HTMLSelectElement;
    expect([...pointSelect.options].map((option) => option.value)).toContain(TEST_DOOR_TYPE_PATH);
  });

  it('shows classes the game does not report read-only and keeps their data', () => {
    const { section } = sectionCreate();
    const object = new THREE.Mesh();
    GameEntityComponentStore.write(object, { 'old_game::Gone': { power: 3 } });
    section.updateFromObjects([object]);
    const block = section.getElement().querySelector('[data-game-component="old_game::Gone"]');
    expect(block?.textContent).toContain('not in game');
    expect(block?.querySelector('input')).toBeNull();
    expect(block?.textContent).toContain('3');
  });

  it('keeps its fields when refreshed without changes', () => {
    const { section } = sectionCreate();
    const object = new THREE.Mesh();
    GameEntityComponentStore.write(object, { [TEST_SPINNER_TYPE_PATH]: {} });
    section.updateFromObjects([object]);
    const before = section.getElement().querySelector('input');
    section.updateFromObjects([object]);
    expect(section.getElement().querySelector('input')).toBe(before);
  });
});
