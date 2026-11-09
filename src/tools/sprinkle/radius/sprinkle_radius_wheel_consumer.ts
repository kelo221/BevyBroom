import { getRegistryViewportWheelConsumer } from '@/navigation/wheel/registry_viewport_wheel_consumer.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { sprinkleRadiusScaleByDoublings } from './sprinkle_radius_scale.js';

/**
 * Doublings of the Sprinkle radius per Alt+wheel notch; four notches double or
 * halve it.
 */
export const SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS = 0.25;

/**
 * Scales the Sprinkle radius one step for an Alt+wheel turn while the Sprinkle
 * tool is active: turning up grows it, turning down shrinks it.
 *
 * @param event Wheel event over a viewport.
 * @returns True when the turn resized the brush, so the camera ignores it.
 */
export function sprinkleRadiusWheelConsume(event: WheelEvent): boolean {
  if (!getStateSprinkleTool().toolActiveRead() || !event.altKey || event.deltaY === 0) {
    return false;
  }
  const notchDoublings =
    event.deltaY < 0 ? SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS : -SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS;
  sprinkleRadiusScaleByDoublings(notchDoublings);
  return true;
}

/**
 * Registers the Sprinkle Alt+wheel radius resize with the viewport wheel
 * consumers.
 *
 * @returns Function that removes the registration again.
 */
export function sprinkleRadiusWheelConsumerInstall(): () => void {
  return getRegistryViewportWheelConsumer().consumerAdd(sprinkleRadiusWheelConsume);
}
