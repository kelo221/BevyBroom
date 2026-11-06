import { buttonCompactCreate } from '@/ui/button/button_compact.js';

/** One text button of an entity I/O button bar. */
export interface ObjectPropertiesLogicButtonOptions {
  /** Visible text. */
  readonly text: string;
  /** Tooltip and accessible name. */
  readonly title: string;
  /** Action name written to the button for lookups. */
  readonly action: string;
  /** Click handler. */
  readonly onClick: () => void;
}

/**
 * Creates a compact text button tagged with its entity I/O action.
 *
 * @param options Button text, tooltip, action and click handler.
 * @returns Button element.
 */
export function objectPropertiesLogicButtonCreate(options: ObjectPropertiesLogicButtonOptions): HTMLButtonElement {
  const button = buttonCompactCreate({
    title: options.title,
    text: options.text,
    widthPx: null,
    heightPx: 22,
    onClick: options.onClick,
  });
  button.dataset['logicAction'] = options.action;
  return button;
}

/**
 * Creates a row of entity I/O buttons.
 *
 * @param buttons Buttons in order.
 * @returns Row element.
 */
export function objectPropertiesLogicButtonBarCreate(buttons: readonly HTMLElement[]): HTMLElement {
  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.flexWrap = 'wrap';
  bar.style.gap = '4px';
  bar.style.padding = '0 8px 8px';
  bar.append(...buttons);
  return bar;
}
