import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_CLASS_MODIFIER_VOLUME_ID } from '@/entity/class/classes/entity_class_brush_modifier_volume.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { shouldOmitFromExport } from '@/io/scene/builder_export_scene.js';
import { TEST_SPINNER_TYPE_PATH, testClassesInstall } from '../../../game_entity/game_entity_test_classes.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';

/** Label of the modifier volume class the Class dropdown shows. */
const MODIFIER_VOLUME_LABEL = 'Modifier Volume (editor only)';

/**
 * Creates a plain world brush, a box with no class of its own.
 *
 * @returns Brush mesh.
 */
function plainBrushCreate(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

/**
 * The modifier volume class names every modifier volume, takes no other brush
 * class, and keeps volumes out of the game export.
 */
describe('EntityClassBrushModifierVolume', () => {
  let uninstall: () => void = () => {};

  afterEach(() => {
    uninstall();
    uninstall = () => {};
  });

  it('names a modifier volume as an editor-only volume and leaves plain brushes as world brushes', () => {
    uninstall = testClassesInstall().uninstall;
    const volume = ModifierVolume.create({});
    const brush = plainBrushCreate();
    expect(EntityClassRegistry.classOf(volume)?.label).toBe(MODIFIER_VOLUME_LABEL);
    expect(EntityClassRegistry.classOf(volume)?.id).toBe(ENTITY_CLASS_MODIFIER_VOLUME_ID);
    expect(EntityClassRegistry.classOf(brush)?.label).toBe('Solid (world)');
  });

  it('offers a volume only the modifier volume class, not world or game brush classes', () => {
    uninstall = testClassesInstall().uninstall;
    const volume = ModifierVolume.create({});
    const fittingIds = EntityClassRegistry.classesFittingList(volume).map((entityClass) => entityClass.id);
    expect(fittingIds).toEqual([ENTITY_CLASS_MODIFIER_VOLUME_ID]);
  });

  it('keeps modifier volumes out of brush classes that a plain brush fits', () => {
    uninstall = testClassesInstall().uninstall;
    const brush = plainBrushCreate();
    const brushFittingLabels = EntityClassRegistry.classesFittingList(brush).map((entityClass) => entityClass.label);
    expect(brushFittingLabels).not.toContain(MODIFIER_VOLUME_LABEL);
    expect(brushFittingLabels).toContain('Solid (world)');
  });

  it('keeps a game brush class off a volume even when the volume carries its component', () => {
    uninstall = testClassesInstall().uninstall;
    const volume = ModifierVolume.create({});
    GameEntityComponentStore.write(volume, { [TEST_SPINNER_TYPE_PATH]: {} });
    expect(EntityClassRegistry.classOf(volume)?.label).toBe(MODIFIER_VOLUME_LABEL);
    expect(EntityClassRegistry.classesFittingList(volume).map((entityClass) => entityClass.label)).not.toContain(
      'Spinner',
    );
  });

  it('is omitted from the game export', () => {
    uninstall = testClassesInstall().uninstall;
    expect(shouldOmitFromExport(ModifierVolume.create({}))).toBe(true);
  });
});
