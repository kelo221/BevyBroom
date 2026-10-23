import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shapeDrawPreviewSegmentsCreate } from '@/tools/shape_draw/shape_draw_preview_edges.js';
import { ShapeDrawPreview } from '@/tools/shape_draw/shape_draw_preview.js';

/** Host collecting preview helpers without a scene. */
class PreviewHostFake {
  readonly helpers: THREE.Object3D[] = [];

  /**
   * Records a helper object.
   *
   * @param object Helper to add.
   */
  addHelper(object: THREE.Object3D): void {
    this.helpers.push(object);
  }

  /**
   * Forgets a helper object.
   *
   * @param object Helper to remove.
   */
  removeHelper(object: THREE.Object3D): void {
    const index = this.helpers.indexOf(object);
    if (index >= 0) {
      this.helpers.splice(index, 1);
    }
  }
}

/** Proves preview segments follow hull edges and the preview object lifecycle. */
describe('shape draw preview', () => {
  const boxPiece = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 1),
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(0, 1, 1),
  ];

  it('lists the twelve hull edges of a box piece', () => {
    const segments = shapeDrawPreviewSegmentsCreate([boxPiece]);
    expect(segments).toHaveLength(12 * 6);
  });

  it('concatenates the segments of every piece', () => {
    const segments = shapeDrawPreviewSegmentsCreate([boxPiece, boxPiece.map((point) => point.clone().addScalar(5))]);
    expect(segments).toHaveLength(2 * 12 * 6);
  });

  it('skips flat point sets that cannot form a hull', () => {
    const flat = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)];
    expect(shapeDrawPreviewSegmentsCreate([flat])).toHaveLength(0);
  });

  it('shows and disposes the preview wireframe through its host', () => {
    const host = new PreviewHostFake();
    const preview = new ShapeDrawPreview(host);
    const object = preview.previewObject();
    expect(host.helpers).toEqual([object]);
    preview.previewShowWorldPieces([boxPiece]);
    expect(object.visible).toBe(true);
    preview.previewShowWorldPieces([boxPiece, boxPiece]);
    preview.dispose();
    expect(object.parent).toBeNull();
    expect(host.helpers).toHaveLength(0);
  });
});
