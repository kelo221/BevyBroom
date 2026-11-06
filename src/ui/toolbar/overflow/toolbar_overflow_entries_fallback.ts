import type { ToolbarMenuAction, ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Builds overflow menu rows from the buttons of a collapsed element: one row
 * per enabled button that names itself and does not open its own popup. The
 * element itself counts when it is a button.
 *
 * @param element Collapsed toolbar item.
 * @returns One action entry per usable button, in document order.
 */
export function toolbarOverflowEntriesFromButtons(element: HTMLElement): ToolbarMenuEntry[] {
  return toolbarOverflowButtonsCollect(element)
    .filter((button) => toolbarOverflowButtonIsUsable(button, element))
    .map((button) => toolbarOverflowButtonEntryCreate(button));
}

/**
 * Lists the element when it is a button, followed by every button inside it.
 *
 * @param element Collapsed toolbar item.
 * @returns Buttons in document order.
 */
function toolbarOverflowButtonsCollect(element: HTMLElement): HTMLButtonElement[] {
  const nested = Array.from(element.querySelectorAll('button'));
  return element instanceof HTMLButtonElement ? [element, ...nested] : nested;
}

/**
 * Returns whether a button can stand in as a plain overflow row.
 *
 * @param button Candidate button.
 * @param collapsedItem Collapsed toolbar item; it is hidden by the collapse
 *   itself, so only buttons nested inside it are skipped while hidden.
 * @returns True when it is enabled, named, shown by its owner and opens no
 *   popup of its own.
 */
function toolbarOverflowButtonIsUsable(button: HTMLButtonElement, collapsedItem: HTMLElement): boolean {
  if (button.disabled || (button !== collapsedItem && button.style.display === 'none')) {
    return false;
  }
  if (button.getAttribute('aria-haspopup') === 'menu') {
    return false;
  }
  return toolbarOverflowButtonLabelRead(button) !== '';
}

/**
 * Reads the human name of a button from its accessible name, tooltip or text.
 *
 * @param button Toolbar button.
 * @returns Trimmed label, or an empty string when the button has no name.
 */
function toolbarOverflowButtonLabelRead(button: HTMLButtonElement): string {
  const ariaLabel = button.getAttribute('aria-label')?.trim() ?? '';
  if (ariaLabel !== '') {
    return ariaLabel;
  }
  return (button.textContent ?? '').trim() || button.title.trim();
}

/**
 * Creates the overflow row that clicks a button, checked while the button shows
 * itself as toggled on.
 *
 * @param button Toolbar button.
 * @returns Action entry.
 */
function toolbarOverflowButtonEntryCreate(button: HTMLButtonElement): ToolbarMenuAction {
  const entry: ToolbarMenuAction = {
    label: toolbarOverflowButtonLabelRead(button),
    onClick: () => button.click(),
  };
  if (button.dataset['active'] !== undefined || button.hasAttribute('aria-pressed')) {
    entry.isChecked = () => toolbarOverflowButtonIsToggledOn(button);
  }
  return entry;
}

/**
 * Returns whether a toggle button currently shows itself as on.
 *
 * @param button Toggle button.
 * @returns True while toggled on.
 */
function toolbarOverflowButtonIsToggledOn(button: HTMLButtonElement): boolean {
  return button.dataset['active'] === 'true' || button.getAttribute('aria-pressed') === 'true';
}
