import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RenderDemandViewSignature } from '@/layout/render_demand/render_demand_view_signature.js';

/**
 * RenderDemandViewSignature tells whether any view moved, zoomed or was swapped
 * since it was last drawn.
 */
describe('RenderDemandViewSignature', () => {
  /**
   * Creates a perspective camera and an orthographic camera looking at the
   * origin.
   *
   * @returns Two cameras in pane order.
   */
  function camerasCreate(): THREE.Camera[] {
    const perspective = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
    perspective.position.set(4, 3, 5);
    perspective.lookAt(0, 0, 0);
    const orthographic = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    orthographic.position.set(0, 20, 0);
    orthographic.lookAt(0, 0, 0);
    return [perspective, orthographic];
  }

  it('differs from any cameras before the first record', () => {
    expect(new RenderDemandViewSignature().isChanged(camerasCreate())).toBe(true);
  });

  it('is unchanged when nothing moved since the record', () => {
    const cameras = camerasCreate();
    const signature = new RenderDemandViewSignature();
    signature.record(cameras);
    expect(signature.isChanged(cameras)).toBe(false);
  });

  it('changes when a camera moves', () => {
    const cameras = camerasCreate();
    const signature = new RenderDemandViewSignature();
    signature.record(cameras);
    cameras[0]?.position.add(new THREE.Vector3(0.001, 0, 0));
    expect(signature.isChanged(cameras)).toBe(true);
  });

  it('changes when an orthographic camera zooms', () => {
    const cameras = camerasCreate();
    const signature = new RenderDemandViewSignature();
    signature.record(cameras);
    const orthographic = cameras[1] as THREE.OrthographicCamera;
    orthographic.zoom *= 2;
    orthographic.updateProjectionMatrix();
    expect(signature.isChanged(cameras)).toBe(true);
  });

  it('changes when a pane shows another camera or the pane count changes', () => {
    const cameras = camerasCreate();
    const signature = new RenderDemandViewSignature();
    signature.record(cameras);
    expect(signature.isChanged([cameras[1] as THREE.Camera, cameras[0] as THREE.Camera])).toBe(true);
    expect(signature.isChanged(cameras.slice(0, 1))).toBe(true);
  });
});
