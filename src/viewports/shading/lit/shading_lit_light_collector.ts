import type * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { isLightOwner } from '@/light/model/light_owner_keys.js';
import {
  type ShadingLitLightRecord,
  shadingLitLightRecordCreate,
} from '@/viewports/shading/lit/shading_lit_light_record.js';

/**
 * Collects the visible, enabled authored lights of a scene for the Lit shading
 * mode.
 */
export class ShadingLitLightCollector {
  /**
   * Returns the records of every visible, enabled light owner in the scene.
   *
   * @param scene Scene to search; hidden subtrees are skipped.
   * @returns Light records in scene order.
   */
  static collect(scene: THREE.Object3D): ShadingLitLightRecord[] {
    const records: ShadingLitLightRecord[] = [];
    scene.traverseVisible((object) => {
      const record = ShadingLitLightCollector.recordFromObject(object);
      if (record) {
        records.push(record);
      }
    });
    return records;
  }

  /**
   * Returns at most a number of records, keeping the lights whose reach is
   * closest to a viewer position.
   *
   * @param records All candidate records.
   * @param viewerPosition World position of the camera.
   * @param maximumCount Largest number of records to keep.
   * @returns Closest records, nearest first when trimming was needed.
   */
  static nearest(
    records: readonly ShadingLitLightRecord[],
    viewerPosition: THREE.Vector3,
    maximumCount: number,
  ): ShadingLitLightRecord[] {
    if (records.length <= maximumCount) {
      return [...records];
    }
    const reachDistance = (record: ShadingLitLightRecord): number =>
      Math.max(record.position.distanceTo(viewerPosition) - record.radius, 0);
    return [...records].sort((first, second) => reachDistance(first) - reachDistance(second)).slice(0, maximumCount);
  }

  /**
   * Returns the record of an object when it is a light owner that gives light.
   *
   * @param object Candidate object.
   * @returns Record, or null for other objects and dark lights.
   */
  private static recordFromObject(object: THREE.Object3D): ShadingLitLightRecord | null {
    if (!isLightOwner(object)) {
      return null;
    }
    const settings = LightOwner.settingsRead(object);
    if (!settings) {
      return null;
    }
    object.updateWorldMatrix(true, false);
    return shadingLitLightRecordCreate(object, settings);
  }
}
