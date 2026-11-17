import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { PanelPropertiesCollisionSection } from '@/level_export/ui/panel_properties_collision_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../collision/collision_test_models.js';

const chrome = {
  createSectionContainer: (): HTMLElement => document.createElement('div'),
  createSectionHeader: (title: string): HTMLElement =>
    Object.assign(document.createElement('h3'), { textContent: title }),
};

/**
 * Picks a kind in the section's select.
 *
 * @param section Section.
 * @param value Option value.
 */
function kindPick(section: PanelPropertiesCollisionSection, value: string): void {
  const select = section.getElement().querySelector('select');
  if (!select) throw new Error('missing select');
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

/** The inspector shows and overrides the collision kind of solid models. */
describe('PanelPropertiesCollisionSection', () => {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));

  it('is a properties section shown for solid models and their brushes only', () => {
    expect(
      PanelPropertiesSectionRegistry.sectionsCreate(chrome).some(
        (section) => section instanceof PanelPropertiesCollisionSection,
      ),
    ).toBe(true);
    const section = new PanelPropertiesCollisionSection(chrome);
    const model = collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]);
    section.updateFromObjects([new THREE.Group()]);
    expect(section.getElement().style.display).toBe('none');
    const brushMesh = model.findBrush('brush-0')?.mesh ?? model.root;
    section.updateFromObjects([brushMesh]);
    expect(section.getElement().style.display).toBe('block');
  });

  it('overrides the kind of the selected solid models as one undo step and clears it again', () => {
    const models = [
      collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]),
      collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]),
    ];
    const roots = models.map((model) => model.root);
    const stack = new CommandStack(8);
    const section = new PanelPropertiesCollisionSection(chrome);
    section.setCommandStack(stack);
    section.updateFromObjects(roots);
    kindPick(section, 'volume');
    expect(roots.map((root) => CollisionKindStore.resolve(root))).toEqual(['volume', 'volume']);
    kindPick(section, 'declared');
    expect(roots.map((root) => CollisionKindStore.overrideRead(root))).toEqual([null, null]);
    stack.undo();
    expect(roots.map((root) => CollisionKindStore.overrideRead(root))).toEqual(['volume', 'volume']);
  });
});
