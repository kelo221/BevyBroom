import { objectPropertiesTestQuery } from '../../../ui/object_properties/object_properties_test_support.js';

/**
 * Returns the body rows of an entity I/O table.
 *
 * @param root Element holding the table.
 * @param tableLabel Accessible name of the table.
 * @returns Row elements.
 */
export function logicTestTableRowsRead(root: ParentNode, tableLabel: string): HTMLTableRowElement[] {
  const table = objectPropertiesTestQuery<HTMLTableElement>(root, `table[aria-label="${tableLabel}"]`);
  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
}

/**
 * Clicks an entity I/O button by its action.
 *
 * @param root Element holding the button.
 * @param action Action name of the button.
 */
export function logicTestButtonClick(root: ParentNode, action: string): void {
  objectPropertiesTestQuery<HTMLButtonElement>(root, `[data-logic-action="${action}"]`).click();
}
