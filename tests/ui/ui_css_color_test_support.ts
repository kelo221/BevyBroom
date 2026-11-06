/**
 * Normalizes a CSS color the way the DOM stores it, so token values can be
 * compared with styles read back from elements.
 *
 * @param css CSS color string.
 * @returns Color as the DOM serializes it.
 */
export function cssColorNormalize(css: string): string {
  const probe = document.createElement('div');
  probe.style.color = css;
  return probe.style.color;
}
