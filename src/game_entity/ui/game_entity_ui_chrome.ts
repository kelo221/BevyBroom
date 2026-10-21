import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { Theme } from '@/theme.js';
import { panelPropertiesRowCaptionPaint } from '@/ui/properties/panel_properties_row.js';

/** CSS color of overridden field captions: the selection orange. */
const GAME_ENTITY_OVERRIDE_COLOR = `#${Theme.selectionColor.toString(16).padStart(6, '0')}`;

/** Indentation of one group level in pixels. */
const GAME_ENTITY_GROUP_INDENT_PX = 10;

/** Element factories that give the game component inspector its look. */
export class GameEntityUiChrome {
  /**
   * Creates a small flat button showing one symbol.
   *
   * @param symbol Button text.
   * @param title Tooltip and accessible name.
   * @param onClick Click handler.
   * @returns Button element.
   */
  static iconButtonCreate(symbol: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = symbol;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.style.background = 'transparent';
    button.style.border = 'none';
    button.style.color = Theme.buttonTextColor;
    button.style.cursor = 'pointer';
    button.style.padding = '0 4px';
    button.style.fontSize = '13px';
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Creates the title row of a component block.
   *
   * @param text Title text.
   * @param tooltip Hover text, such as the full type path.
   * @param trailing Control placed at the right end.
   * @returns Title row.
   */
  static titleRowCreate(text: string, tooltip: string, trailing: HTMLElement): HTMLElement {
    const row = GameEntityUiChrome.rowCreate();
    row.style.borderTop = `1px solid ${Theme.inputBorderColor}`;
    row.style.paddingTop = '6px';
    const title = document.createElement('span');
    title.textContent = text;
    title.title = tooltip;
    title.style.flex = '1';
    title.style.fontWeight = '600';
    panelPropertiesRowCaptionPaint(title);
    row.append(title, trailing);
    return row;
  }

  /**
   * Creates the caption of a group of fields.
   *
   * @param text Group label.
   * @param depth Group nesting depth.
   * @returns Caption row.
   */
  static groupCaptionCreate(text: string, depth: number): HTMLElement {
    const row = GameEntityUiChrome.rowCreate();
    row.style.paddingLeft = `${8 + depth * GAME_ENTITY_GROUP_INDENT_PX}px`;
    const caption = document.createElement('span');
    caption.textContent = text;
    panelPropertiesRowCaptionPaint(caption);
    caption.style.fontStyle = 'italic';
    row.appendChild(caption);
    return row;
  }

  /**
   * Creates the row of one field: caption, editor and an optional reset button.
   * Overridden fields have an orange caption.
   *
   * @param field Field description.
   * @param depth Group nesting depth.
   * @param overridden Whether any bound object overrides the field.
   * @param editor Editor element.
   * @param reset Reset button, or null.
   * @returns Row element.
   */
  static fieldRowCreate(
    field: GameEntityField,
    depth: number,
    overridden: boolean,
    editor: HTMLElement,
    reset: HTMLElement | null,
  ): HTMLElement {
    const row = GameEntityUiChrome.rowCreate();
    row.style.paddingLeft = `${8 + depth * GAME_ENTITY_GROUP_INDENT_PX}px`;
    row.dataset['fieldPath'] = field.path;
    row.dataset['overridden'] = String(overridden);
    row.append(GameEntityUiChrome.captionCreate(field, overridden), editor);
    if (reset) {
      row.appendChild(reset);
    }
    return row;
  }

  /**
   * Creates a small note line.
   *
   * @param text Note text.
   * @returns Note element.
   */
  static noteCreate(text: string): HTMLElement {
    const note = document.createElement('div');
    note.textContent = text;
    note.style.color = Theme.statusBarTextColor;
    note.style.fontSize = '11px';
    note.style.padding = '0 8px 8px';
    return note;
  }

  /**
   * Creates a field caption.
   *
   * @param field Field description.
   * @param overridden Whether the caption is highlighted.
   * @returns Caption element.
   */
  private static captionCreate(field: GameEntityField, overridden: boolean): HTMLElement {
    const caption = document.createElement('span');
    caption.textContent = field.label;
    caption.title = overridden ? `${field.path} (changed from the game default)` : field.path;
    caption.style.width = '11ch';
    caption.style.flexShrink = '0';
    caption.style.overflow = 'hidden';
    caption.style.textOverflow = 'ellipsis';
    panelPropertiesRowCaptionPaint(caption);
    if (overridden) {
      caption.style.color = GAME_ENTITY_OVERRIDE_COLOR;
    }
    return caption;
  }

  /**
   * Creates an empty inspector row.
   *
   * @returns Row element.
   */
  private static rowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.padding = '0 8px 8px';
    return row;
  }
}
