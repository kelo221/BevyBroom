import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipboardBoundsFromPayload } from '@/clipboard/payload/clipboard_payload_bounds.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PrefabPreviewBuilder } from '@/prefab/preview/prefab_preview_builder.js';
import {
  clipboardTestBrushAdd,
  clipboardTestBrushMeshRead,
  clipboardTestModelAdd,
  clipboardTestWorldCreate,
} from '../../clipboard/clipboard_test_world.js';
import { prefabActionsTestBoxAdd } from '../actions/prefab_actions_test_support.js';

/** The standalone 3D previews prefab tiles show. */
describe('PrefabPreviewBuilder', () => {
  it('builds a preview of the captured objects and compiled brushes that fills the captured bounds', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Building');
    const brush = clipboardTestBrushAdd(model, new THREE.Vector3(-6, 1, 3));
    const box = prefabActionsTestBoxAdd(
      testWorld.world,
      'Sign',
      new THREE.Vector3(1, 3, 1),
      new THREE.Vector3(5, 0, -2),
    );
    const template = new PrefabCatalogStore().templateCapture('Kiosk', 'Props', [
      clipboardTestBrushMeshRead(brush),
      box,
    ]);
    if (template === null) throw new Error('the test objects can be captured');
    const childrenBefore = testWorld.world.children.length;
    const preview = PrefabPreviewBuilder.previewCreate(template.payload);
    const previewBounds = new THREE.Box3().setFromObject(preview);
    const capturedBounds = clipboardBoundsFromPayload(template.payload.bounds);
    expect(previewBounds.min.distanceTo(capturedBounds.min)).toBeLessThan(1e-4);
    expect(previewBounds.max.distanceTo(capturedBounds.max)).toBeLessThan(1e-4);
    expect(preview.getObjectByName('Sign')).toBeDefined();
    expect(testWorld.world.children).toHaveLength(childrenBefore);
  });

  it('builds a preview without a brush mesh for prefabs made of objects only', () => {
    const testWorld = clipboardTestWorldCreate();
    const box = prefabActionsTestBoxAdd(
      testWorld.world,
      'Barrel',
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(0, 0, 0),
    );
    const template = new PrefabCatalogStore().templateCapture('Barrel', 'Props', [box]);
    if (template === null) throw new Error('the test objects can be captured');
    const preview = PrefabPreviewBuilder.previewCreate(template.payload);
    expect(preview.children.map((child) => child.name)).toEqual(['Barrel']);
  });
});
