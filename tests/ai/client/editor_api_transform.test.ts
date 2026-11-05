import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { editorApiTransformApply } from '@/ai/client/editor_api_transform.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/**
 * Proves the AI tools place objects with position and rotation, scale objects
 * that may be scaled and leave lights and game entities at a unit scale.
 */
describe('editorApiTransformApply', () => {
  const requested = {
    position: { x: 1, y: 2, z: 3 },
    rotationDegrees: { x: 0, y: 90, z: 0 },
    scale: { x: 2, y: 3, z: 4 },
  };

  it('moves and rotates game entities and lights but keeps their unit scale', () => {
    const points = [GameEntityOwner.createDefault('door_main'), LightOwner.createDefault('Lamp', 'point')];
    for (const point of points) {
      editorApiTransformApply(point, requested);
      expect(point.position.toArray()).toEqual([1, 2, 3]);
      expect(point.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(90));
      expect(point.scale.toArray()).toEqual([1, 1, 1]);
    }
  });

  it('scales rooms and ordinary objects', () => {
    const scalable = [RoomOwner.createDefault('Hall'), new THREE.Mesh()];
    for (const object of scalable) {
      editorApiTransformApply(object, requested);
      expect(object.scale.toArray()).toEqual([2, 3, 4]);
    }
  });
});
