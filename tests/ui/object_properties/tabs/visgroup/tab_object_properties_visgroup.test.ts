import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { TabObjectPropertiesVisGroup } from '@/ui/object_properties/tabs/visgroup/tab_object_properties_visgroup.js';
import { objectPropertiesTestContextCreate, objectPropertiesTestQuery } from '../../object_properties_test_support.js';

/**
 * The VisGroup tab lists every user VisGroup with the membership of the edited
 * objects and toggles it for all of them as one undoable edit.
 */
describe('TabObjectPropertiesVisGroup', () => {
  it('adds and removes every edited object and undoes each toggle', () => {
    const store = new VisGroupStore();
    const doors = store.userGroupCreate('Doors');
    const objects = [new THREE.Mesh(), new THREE.Group()];
    store.objectGroupAdd(objects[0] as THREE.Object3D, doors.id);
    const { context, commandStack } = objectPropertiesTestContextCreate(objects);
    const tab = new TabObjectPropertiesVisGroup(context, store);
    tab.refresh(objects);
    const checkboxSelector = `[data-visgroup-id="${doors.id}"] input`;
    expect(objectPropertiesTestQuery<HTMLInputElement>(context.container, checkboxSelector).indeterminate).toBe(true);
    objectPropertiesTestQuery<HTMLInputElement>(context.container, checkboxSelector).click();
    const membership = (): boolean[] => objects.map((object) => store.objectGroupIdsRead(object).includes(doors.id));
    const afterFirstToggle = membership();
    expect(new Set(afterFirstToggle).size).toBe(1);
    objectPropertiesTestQuery<HTMLInputElement>(context.container, checkboxSelector).click();
    expect(membership()).toEqual(afterFirstToggle.map((isMember) => !isMember));
    commandStack.undo();
    expect(membership()).toEqual(afterFirstToggle);
    commandStack.undo();
    expect(membership()).toEqual([true, false]);
  });

  it('explains how to create a VisGroup when none exists', () => {
    const { context } = objectPropertiesTestContextCreate([new THREE.Mesh()]);
    const tab = new TabObjectPropertiesVisGroup(context, new VisGroupStore());
    tab.refresh(context.selectedObjectsRead());
    expect(context.container.textContent).toContain('No VisGroups');
  });
});
