import * as THREE from 'three';

/** Object orientation as pitch, yaw and roll in degrees. */
export interface AnglesPitchYawRoll {
  /** Rotation about the X axis; positive tilts the forward direction up. */
  readonly pitch: number;
  /** Rotation about the Y axis; positive turns the forward direction toward -X. */
  readonly yaw: number;
  /** Rotation about the forward axis. */
  readonly roll: number;
}

/** Angles where any component may be left out to keep the object's own value. */
export interface AnglesPitchYawRollPartial {
  readonly pitch: number | null;
  readonly yaw: number | null;
  readonly roll: number | null;
}

/** Euler order that applies yaw, then pitch, then roll. */
const ANGLES_EULER_ORDER: THREE.EulerOrder = 'YXZ';

/**
 * Conversions between object rotations and pitch, yaw and roll angles in the
 * editor's right-handed Y-up frame where forward is -Z.
 */
export class AnglesPitchYawRollConversion {
  /**
   * Reads pitch, yaw and roll from a rotation.
   *
   * @param rotation Object rotation in any Euler order.
   * @returns Angles in degrees.
   */
  static fromRotation(rotation: THREE.Euler): AnglesPitchYawRoll {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    const euler = new THREE.Euler().setFromQuaternion(quaternion, ANGLES_EULER_ORDER);
    return {
      pitch: AnglesPitchYawRollConversion.degreesClean(THREE.MathUtils.radToDeg(euler.x)),
      yaw: AnglesPitchYawRollConversion.degreesClean(THREE.MathUtils.radToDeg(euler.y)),
      roll: AnglesPitchYawRollConversion.degreesClean(THREE.MathUtils.radToDeg(euler.z)),
    };
  }

  /**
   * Builds a rotation from pitch, yaw and roll.
   *
   * @param angles Angles in degrees.
   * @param order Euler order of the returned rotation.
   * @returns Rotation in the requested order.
   */
  static toRotation(angles: AnglesPitchYawRoll, order: THREE.EulerOrder): THREE.Euler {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(angles.pitch),
      THREE.MathUtils.degToRad(angles.yaw),
      THREE.MathUtils.degToRad(angles.roll),
      ANGLES_EULER_ORDER,
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    return new THREE.Euler().setFromQuaternion(quaternion, order);
  }

  /**
   * Fills the components a partial edit leaves out from existing angles.
   *
   * @param current Angles the object has now.
   * @param edit Angles to change; null components keep the current value.
   * @returns Merged angles.
   */
  static merge(current: AnglesPitchYawRoll, edit: AnglesPitchYawRollPartial): AnglesPitchYawRoll {
    return {
      pitch: edit.pitch ?? current.pitch,
      yaw: edit.yaw ?? current.yaw,
      roll: edit.roll ?? current.roll,
    };
  }

  /**
   * Returns the pitch and yaw that turn the forward direction along a
   * direction.
   *
   * @param direction Direction in the frame the angles are expressed in.
   * @returns Pitch and yaw in degrees, or null for a zero direction.
   */
  static pitchYawAlong(direction: THREE.Vector3): { pitch: number; yaw: number } | null {
    const horizontalLength = Math.hypot(direction.x, direction.z);
    if (horizontalLength < 1e-9 && Math.abs(direction.y) < 1e-9) {
      return null;
    }
    return {
      pitch: AnglesPitchYawRollConversion.degreesClean(
        THREE.MathUtils.radToDeg(Math.atan2(direction.y, horizontalLength)),
      ),
      yaw: AnglesPitchYawRollConversion.degreesClean(THREE.MathUtils.radToDeg(Math.atan2(-direction.x, -direction.z))),
    };
  }

  /**
   * Returns the yaw a top-down dial point stands for, with screen up meaning
   * the unrotated forward direction (-Z) and screen right meaning +X.
   *
   * @param offsetRight Point offset from the dial center toward screen right.
   * @param offsetDown Point offset from the dial center toward screen bottom.
   * @returns Yaw in degrees.
   */
  static yawFromDialOffset(offsetRight: number, offsetDown: number): number {
    return AnglesPitchYawRollConversion.degreesClean(THREE.MathUtils.radToDeg(Math.atan2(-offsetRight, -offsetDown)));
  }

  /**
   * Returns the dial point that shows a yaw, matching {@link yawFromDialOffset}.
   *
   * @param yaw Yaw in degrees.
   * @param radius Distance of the point from the dial center.
   * @returns Offsets toward screen right and screen bottom.
   */
  static dialOffsetFromYaw(yaw: number, radius: number): { right: number; down: number } {
    const radians = THREE.MathUtils.degToRad(yaw);
    return { right: -Math.sin(radians) * radius, down: -Math.cos(radians) * radius };
  }

  /**
   * Formats angles the way Hammer's angles keyvalue shows them: pitch, yaw and
   * roll separated by spaces.
   *
   * @param angles Angles in degrees.
   * @returns Angles text such as `0 90 0`.
   */
  static textFormat(angles: AnglesPitchYawRoll): string {
    return `${angles.pitch} ${angles.yaw} ${angles.roll}`;
  }

  /**
   * Reads typed angles: three numbers set pitch, yaw and roll, and one number
   * sets only the yaw.
   *
   * @param text Typed text; spaces or commas separate the numbers.
   * @returns Angle edit, or null when the text is not one or three numbers.
   */
  static textParse(text: string): AnglesPitchYawRollPartial | null {
    const parts = text
      .trim()
      .split(/[\s,]+/)
      .filter((part) => part !== '');
    const numbers = parts.map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) {
      return null;
    }
    const [first, second, third] = numbers;
    if (numbers.length === 1 && first !== undefined) {
      return { pitch: null, yaw: first, roll: null };
    }
    if (numbers.length === 3 && first !== undefined && second !== undefined && third !== undefined) {
      return { pitch: first, yaw: second, roll: third };
    }
    return null;
  }

  /**
   * Rounds tiny floating point noise away so shown angles stay readable.
   *
   * @param degrees Angle in degrees.
   * @returns Angle rounded to five decimals, without negative zero.
   */
  private static degreesClean(degrees: number): number {
    const rounded = Math.round(degrees * 1e5) / 1e5;
    return rounded === 0 ? 0 : rounded;
  }
}
