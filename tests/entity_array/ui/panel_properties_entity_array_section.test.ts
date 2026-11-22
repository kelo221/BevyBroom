import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { ENTITY_ARRAY_FIELDS, ENTITY_ARRAY_FIELD_COUNT_X } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import { PanelPropertiesEntityArraySection } from '@/entity_array/ui/panel_properties_entity_array_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import { entityArrayTestRigCreate, entityArrayTestShelfPlace, type EntityArrayTestRig } from '../entity_array_test_rig.js';

const chrome = {
  createSectionContainer: (): HTMLElement => document.createElement('div'),
  createSectionHeader: (title: string): HTMLElement =>
    Object.assign(document.createElement('h3'), { textContent: title }),
};

/**
 * Creates the section bound to a rig's undo stack and the given objects.
 *
 * @param rig Test rig.
 * @param objects Selected objects.
 * @returns Section.
 */
function sectionCreate(rig: EntityArrayTestRig, objects: THREE.Object3D[]): PanelPropertiesEntityArraySection {
  const section = new PanelPropertiesEntityArraySection(chrome);
  section.setCommandStack(rig.stack);
  section.updateFromObjects(objects);
  return section;
}

/**
 * Turns repeating on or off through the section's switch.
 *
 * @param section Section.
 * @param isOn True for on.
 */
function switchPick(section: PanelPropertiesEntityArraySection, isOn: boolean): void {
  const select = section.getElement().querySelector('select');
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('missing switch');
  }
  const option = Array.from(select.options).find((candidate) => candidate.text === (isOn ? 'On' : 'Off'));
  select.value = option?.value ?? '';
  select.dispatchEvent(new Event('change'));
}

/**
 * Types a value into the field with a path and commits it.
 *
 * @param section Section.
 * @param path Field path.
 * @param value New value text.
 */
function fieldCommit(section: PanelPropertiesEntityArraySection, path: string, value: string): void {
  const label = ENTITY_ARRAY_FIELDS.find((field) => field.path === path)?.label ?? path;
  const input = section.getElement().querySelector(`[aria-label="${label}"]`);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`missing field ${label}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('change'));
}

/** The inspector makes entities repeat, edits the counts and bakes the copies. */
describe('PanelPropertiesEntityArraySection', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('is a registered section shown for entities and hidden for plain objects', () => {
    const sections = PanelPropertiesSectionRegistry.sectionsCreate(chrome);
    expect(sections.some((section) => section instanceof PanelPropertiesEntityArraySection)).toBe(true);
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    expect(sectionCreate(rig, [shelf]).getElement().style.display).toBe('block');
    expect(sectionCreate(rig, [new THREE.Group()]).getElement().style.display).toBe('none');
  });

  it('turns repeating on, sets the count and undoes both steps', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    const section = sectionCreate(rig, [shelf]);
    switchPick(section, true);
    const defaultCopies = EntityArrayCopyMark.copiesOf(shelf).length;
    expect(defaultCopies).toBeGreaterThan(0);
    const countX = 5;
    fieldCommit(section, ENTITY_ARRAY_FIELD_COUNT_X, String(countX));
    expect(EntityArrayStore.read(shelf)?.counts.x).toBe(countX);
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(countX - 1);
    rig.stack.undo();
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(defaultCopies);
    rig.stack.undo();
    expect(EntityArrayCopyMark.copiesOf(shelf)).toHaveLength(0);
  });

  it('bakes the copies into entities beside the source and hides itself for copies', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    const section = sectionCreate(rig, [shelf]);
    switchPick(section, true);
    const copies = EntityArrayCopyMark.copiesOf(shelf);
    const copy = copies[0];
    expect(copy).toBeDefined();
    if (copy === undefined) {
      return;
    }
    expect(sectionCreate(rig, [copy]).getElement().style.display).toBe('none');
    const bake = Array.from(section.getElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Bake'),
    );
    bake?.click();
    expect(EntityArrayStore.read(shelf)).toBeNull();
    copies.forEach((baked) => expect(baked.parent).toBe(rig.world));
  });
});
