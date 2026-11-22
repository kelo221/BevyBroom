import type * as THREE from 'three';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  uniformSceneLitSharedWrite,
} from '@/materials/shader/uniform/uniform_scene_lit_lights_shared.js';
import { ShadingLitLightCollector } from '@/viewports/shading/lit/shading_lit_light_collector.js';

/**
 * Writes the scene's visible, enabled authored lights into the shared Lit
 * shading uniforms, keeping the lights nearest the viewer when there are more
 * than one pass can draw.
 *
 * @param scene Scene holding the light owners.
 * @param viewerPosition World position of the camera drawing the pass.
 */
export function shadingLitLightsRefresh(scene: THREE.Object3D, viewerPosition: THREE.Vector3): void {
  const allLights = ShadingLitLightCollector.collect(scene);
  uniformSceneLitSharedWrite(
    ShadingLitLightCollector.nearest(allLights, viewerPosition, SCENE_LIT_MAXIMUM_LIGHT_COUNT),
  );
}
