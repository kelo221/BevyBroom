import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { PANEL_PROPERTIES_COLLISION_APPLIES_TO_CLASS } from '@/level_export/ui/panel_properties_collision_applies_to.js';
import { PanelPropertiesCollisionSection } from '@/level_export/ui/panel_properties_collision_section.js';
import { PanelPropertiesSectionRegistry } from '@/ui/properties/panel_properties_section_registry.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../collision/collision_test_models.js';
import { collisionTestBoxMeshCreate } from '../collision/mesh/collision_mesh_test_boxes.js';

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

/**
 * The inspector shows and overrides the collision kind of solid models and
 * plain meshes.
 */
describe('PanelPropertiesCollisionSection', () => {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));

  it('is a properties section shown for solid models, their brushes and plain meshes only', () => {
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
    const pose = { size: new THREE.Vector3(1, 1, 1), position: new THREE.Vector3(), rotation: new THREE.Euler() };
    section.updateFromObjects([collisionTestBoxMeshCreate(pose)]);
    expect(section.getElement().style.display).toBe('block');
  });

  it('overrides the kind of a selected plain mesh', () => {
    const pose = { size: new THREE.Vector3(1, 1, 1), position: new THREE.Vector3(), rotation: new THREE.Euler() };
    const mesh = collisionTestBoxMeshCreate(pose);
    const section = new PanelPropertiesCollisionSection(chrome);
    section.updateFromObjects([mesh]);
    kindPick(section, 'volume');
    expect(CollisionKindStore.resolve(mesh)).toBe('volume');
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

  /**
   * A brush with game components is exported as an object of its own, so its
   * collision kind is its own: picking one must not turn the whole level model
   * into that kind.
   */
  it('overrides the kind of a selected brush with game components, not its solid model', () => {
    const model = collisionTestModelCreate([
      { box, operation: SolidOperation.Additive },
      { box, operation: SolidOperation.Additive },
    ]);
    const zoneBrush = model.findBrush('brush-1')?.mesh ?? model.root;
    GameEntityComponentStore.write(zoneBrush, { 'collision_section_test::Zone': {} });
    const section = new PanelPropertiesCollisionSection(chrome);
    section.updateFromObjects([zoneBrush]);
    kindPick(section, 'volume');
    expect(CollisionKindStore.overrideRead(zoneBrush)).toBe('volume');
    expect(CollisionKindStore.overrideRead(model.root)).toBeNull();
  });

  /**
   * Editing a brush writes to its whole model, so the section says which model
   * and how many brushes the change reaches; objects that edit themselves get
   * no such line.
   */
  it('says which whole model a selected brush edits and hides the line for objects that edit themselves', () => {
    const model = collisionTestModelCreate([
      { box, operation: SolidOperation.Additive },
      { box, operation: SolidOperation.Additive },
      { box, operation: SolidOperation.Additive },
    ]);
    model.root.name = 'Harbour';
    const line = (section: PanelPropertiesCollisionSection): HTMLElement | null =>
      section.getElement().querySelector<HTMLElement>(`.${PANEL_PROPERTIES_COLLISION_APPLIES_TO_CLASS}`);
    const section = new PanelPropertiesCollisionSection(chrome);
    section.updateFromObjects([model.findBrush('brush-0')?.mesh ?? model.root]);
    expect(line(section)?.style.display).toBe('block');
    expect(line(section)?.textContent).toBe(`Applies to the whole model Harbour: ${model.getBrushCount()} brushes`);
    section.updateFromObjects([model.root]);
    expect(line(section)?.style.display).toBe('none');
  });

  it('says so when the selected brushes belong to several models', () => {
    const models = [
      collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]),
      collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]),
    ];
    const section = new PanelPropertiesCollisionSection(chrome);
    section.updateFromObjects(models.map((model) => model.findBrush('brush-0')?.mesh ?? model.root));
    const lineText = section.getElement().querySelector(`.${PANEL_PROPERTIES_COLLISION_APPLIES_TO_CLASS}`)?.textContent;
    expect(lineText).toBe(`Applies to ${models.length} whole models: ${models.length} brushes in total`);
  });
});
