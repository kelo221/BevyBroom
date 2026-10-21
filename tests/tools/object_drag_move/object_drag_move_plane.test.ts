import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ObjectDragMovePhase } from '@/tools/object_drag_move/object_drag_move_plane.js';

/**
 * Builds a ray from an origin through a target point.
 *
 * @param origin Ray origin.
 * @param target Point the ray passes through.
 * @returns Ray with a unit direction.
 */
function rayThrough(origin: THREE.Vector3, target: THREE.Vector3): THREE.Ray {
  return new THREE.Ray(origin.clone(), target.clone().sub(origin).normalize());
}

/**
 * Proves a move phase measures pointer travel on its plane or line from where
 * the phase began, so a new phase never makes the selection jump.
 */
describe('ObjectDragMovePhase', () => {
  const eye = new THREE.Vector3(6, 9, 11);
  const anchor = new THREE.Vector3(1, 2, -1);
  const up = new THREE.Vector3(0, 1, 0);

  it('starts with a zero delta and follows the pointer on the plane', () => {
    const phase = ObjectDragMovePhase.phaseBegin('plane', anchor, up, rayThrough(eye, anchor), true);
    expect(phase?.kind()).toBe('plane');
    expect(phase?.deltaAt(rayThrough(eye, anchor))?.length()).toBeLessThan(1e-9);
    const offset = new THREE.Vector3(2.5, 0, -1.25);
    const delta = phase?.deltaAt(rayThrough(eye, anchor.clone().add(offset)));
    expect(delta?.distanceTo(offset)).toBeLessThan(1e-9);
  });

  it('measures from the pressed point, not from the anchor', () => {
    const pressed = anchor.clone().add(new THREE.Vector3(0.75, 0, 0.5));
    const phase = ObjectDragMovePhase.phaseBegin('plane', anchor, up, rayThrough(eye, pressed), true);
    const offset = new THREE.Vector3(-1, 0, 2);
    expect(phase?.deltaAt(rayThrough(eye, pressed.clone().add(offset)))?.distanceTo(offset)).toBeLessThan(1e-9);
  });

  it('moves only along the line in line mode', () => {
    const phase = ObjectDragMovePhase.phaseBegin('line', anchor, up, rayThrough(eye, anchor), true);
    const rise = 3.25;
    const delta = phase?.deltaAt(rayThrough(eye, anchor.clone().addScaledVector(up, rise)));
    expect(delta?.y).toBeCloseTo(rise, 9);
    expect(Math.hypot(delta?.x ?? 1, delta?.z ?? 1)).toBeLessThan(1e-9);
  });

  it('refuses to begin when the plane is behind the ray and hits behind are rejected', () => {
    const awayRay = new THREE.Ray(eye.clone(), eye.clone().sub(anchor).normalize());
    expect(ObjectDragMovePhase.phaseBegin('plane', anchor, up, awayRay, true)).toBeNull();
    expect(ObjectDragMovePhase.phaseBegin('plane', anchor, up, awayRay, false)).not.toBeNull();
  });

  it('reports no delta for a ray that misses the plane later', () => {
    const phase = ObjectDragMovePhase.phaseBegin('plane', anchor, up, rayThrough(eye, anchor), true);
    const parallelRay = new THREE.Ray(eye.clone(), new THREE.Vector3(1, 0, 0));
    expect(phase?.deltaAt(parallelRay)).toBeNull();
  });
});
