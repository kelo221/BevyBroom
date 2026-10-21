/**
 * Clamps a number into a range, mapping non-finite input to the fallback.
 *
 * @param value Candidate number.
 * @param minimum Lowest allowed value.
 * @param maximum Highest allowed value.
 * @param fallback Value used when the candidate is not finite.
 * @returns Clamped finite number.
 */
export function entityNumberClamp(value: number, minimum: number, maximum: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, value));
}
