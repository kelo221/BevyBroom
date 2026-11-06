/**
 * Normalizes a CSS color the way the DOM reports it.
 *
 * @param color CSS color.
 * @returns Color as read back from an element.
 */
export function uiTestCssColorNormalize(color: string): string {
  const probe = document.createElement('div');
  probe.style.color = color;
  return probe.style.color;
}
