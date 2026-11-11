/**
 * Finds the Solid Model section element in the properties panel.
 *
 * @param panelRoot Properties panel container.
 * @returns Section element or null.
 */
export function findSolidModelSection(panelRoot: HTMLElement): HTMLElement | null {
  for (const element of Array.from(panelRoot.querySelectorAll('div'))) {
    const header = element.firstElementChild;
    if (header?.textContent === 'Solid Model') return element;
  }
  return null;
}
