import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnglesPitchYawRollConversion } from '@/ui/object_properties/widgets/angles/angles_pitch_yaw_roll.js';

/**
 * Returns the forward direction (-Z) of a rotation.
 *
 * @param rotation Rotation.
 * @returns Unit forward direction.
 */
function forwardOf(rotation: THREE.Euler): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyEuler(rotation);
}

/**
 * Pitch, yaw and roll convert to rotations and back in any Euler order, aim the
 * forward direction along a direction, and map to dial points both ways.
 */
describe('AnglesPitchYawRollConversion', () => {
  it('round-trips angles through rotations of other Euler orders', () => {
    const angles = { pitch: 20, yaw: -35, roll: 10 };
    const rotation = AnglesPitchYawRollConversion.toRotation(angles, 'XYZ');
    expect(rotation.order).toBe('XYZ');
    const read = AnglesPitchYawRollConversion.fromRotation(rotation);
    expect(read.pitch).toBeCloseTo(angles.pitch, 4);
    expect(read.yaw).toBeCloseTo(angles.yaw, 4);
    expect(read.roll).toBeCloseTo(angles.roll, 4);
  });

  it('aims the forward direction along a direction', () => {
    const direction = new THREE.Vector3(3, 2, -1).normalize();
    const aim = AnglesPitchYawRollConversion.pitchYawAlong(direction);
    if (!aim) throw new Error('a non-zero direction has angles');
    const rotation = AnglesPitchYawRollConversion.toRotation({ ...aim, roll: 0 }, 'XYZ');
    expect(forwardOf(rotation).distanceTo(direction)).toBeLessThan(1e-6);
    expect(AnglesPitchYawRollConversion.pitchYawAlong(new THREE.Vector3())).toBeNull();
  });

  it('maps yaw to a dial point and back, with screen up meaning no yaw', () => {
    expect(AnglesPitchYawRollConversion.yawFromDialOffset(0, -10)).toBe(0);
    for (const yaw of [45, 90, -120, 170]) {
      const point = AnglesPitchYawRollConversion.dialOffsetFromYaw(yaw, 10);
      expect(AnglesPitchYawRollConversion.yawFromDialOffset(point.right, point.down)).toBeCloseTo(yaw, 4);
    }
  });

  it('keeps the object values for components an edit leaves out', () => {
    const merged = AnglesPitchYawRollConversion.merge(
      { pitch: 1, yaw: 2, roll: 3 },
      { pitch: null, yaw: 40, roll: null },
    );
    expect(merged).toEqual({ pitch: 1, yaw: 40, roll: 3 });
  });
});
