import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { PANEL_PROPERTIES_ROW_INDENT_PROPERTY } from '@/ui/properties/panel_properties_row.js';

/** Id of the style element that holds the keyvalue table CSS. */
const KEYVALUE_TABLE_STYLE_ELEMENT_ID = 'bevybroom-object-properties-keyvalue-table-styles';

/** CSS class of the keyvalue table frame. */
export const KEYVALUE_TABLE_FRAME_CLASS = 'object-properties-keyvalues-table';

/** CSS class of the Property Name | Value header row. */
export const KEYVALUE_TABLE_HEADER_CLASS = 'object-properties-keyvalues-header';

/** CSS class of one header cell. */
export const KEYVALUE_TABLE_HEADER_CELL_CLASS = 'object-properties-keyvalues-header-cell';

/** CSS class of the scrolling table body. */
export const KEYVALUE_TABLE_BODY_CLASS = 'object-properties-keyvalues-body';

/** CSS class of one field row presented as a table row. */
export const KEYVALUE_TABLE_ROW_CLASS = 'object-properties-keyvalues-row';

/** CSS class of the property name cell of a table row. */
export const KEYVALUE_TABLE_NAME_CELL_CLASS = 'object-properties-keyvalues-name-cell';

/** CSS class of a group row naming the rows after it. */
export const KEYVALUE_TABLE_GROUP_ROW_CLASS = 'object-properties-keyvalues-group-row';

/** Height of one table row in pixels. */
export const KEYVALUE_TABLE_ROW_HEIGHT_PX = 22;

/** Share of the row width the property name column takes. */
export const KEYVALUE_TABLE_NAME_COLUMN_WIDTH = '42%';

/**
 * Left padding of name cells and group rows: a base inset plus the row's group
 * depth.
 */
const KEYVALUE_TABLE_INDENTED_PADDING = `calc(6px + var(${PANEL_PROPERTIES_ROW_INDENT_PROPERTY}, 0px))`;

/** Background of the table body. */
const KEYVALUE_TABLE_BACKGROUND = '#1e1e1e';

/** Color of the row separators and the column divider. */
const KEYVALUE_TABLE_GRID_LINE_COLOR = '#2e2e2e';

/** Background of the selected row: a dim selection orange. */
const KEYVALUE_TABLE_SELECTED_BACKGROUND = 'rgba(232, 106, 23, 0.2)';

/**
 * Injects the keyvalue table CSS into the document once.
 *
 * @param ownerDocument Document that hosts the table.
 */
export function objectPropertiesKeyvalueTableStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(KEYVALUE_TABLE_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = ownerDocument.createElement('style');
  styleElement.id = KEYVALUE_TABLE_STYLE_ELEMENT_ID;
  styleElement.textContent = [
    keyvalueTableFrameCss(),
    keyvalueTableRowCss(),
    keyvalueTableControlCss(),
    keyvalueTableGroupRowCss(),
  ].join('\n');
  ownerDocument.head.appendChild(styleElement);
}

/**
 * Builds the rules of the frame, the header and the body.
 *
 * @returns CSS text.
 */
function keyvalueTableFrameCss(): string {
  const frame = `.${KEYVALUE_TABLE_FRAME_CLASS}`;
  return `
${frame} { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 260px; box-sizing: border-box; border: 1px solid ${Theme.inputBorderColor}; background: ${KEYVALUE_TABLE_BACKGROUND}; font-family: ${Theme.uiFontFamily}; font-size: 11px; color: ${Theme.buttonTextColor}; }
${frame} > .${KEYVALUE_TABLE_HEADER_CLASS} { display: flex; flex: 0 0 auto; height: ${KEYVALUE_TABLE_ROW_HEIGHT_PX}px; background: ${hexToRgb(Theme.toolbarBackground)}; border-bottom: 1px solid ${Theme.inputBorderColor}; color: ${Theme.statusBarTextColor}; }
${frame} .${KEYVALUE_TABLE_HEADER_CELL_CLASS} { display: flex; align-items: center; padding: 0 6px; box-sizing: border-box; min-width: 0; }
${frame} .${KEYVALUE_TABLE_HEADER_CELL_CLASS}:first-child { flex: 0 0 ${KEYVALUE_TABLE_NAME_COLUMN_WIDTH}; border-right: 1px solid ${Theme.inputBorderColor}; }
${frame} > .${KEYVALUE_TABLE_BODY_CLASS} { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; background: ${KEYVALUE_TABLE_BACKGROUND}; }
`.trim();
}

/**
 * Builds the rules of the table rows and their name cells.
 *
 * @returns CSS text.
 */
function keyvalueTableRowCss(): string {
  const row = `.${KEYVALUE_TABLE_FRAME_CLASS} .${KEYVALUE_TABLE_ROW_CLASS}`;
  return `
${row} { display: flex !important; align-items: center !important; gap: 0 !important; min-height: ${KEYVALUE_TABLE_ROW_HEIGHT_PX}px; padding: 0 2px 0 0 !important; box-sizing: border-box; border-bottom: 1px solid ${KEYVALUE_TABLE_GRID_LINE_COLOR}; }
${row}:hover { background: rgba(255, 255, 255, 0.03); }
${row}[data-keyvalue-row-selected="true"] { background: ${KEYVALUE_TABLE_SELECTED_BACKGROUND}; }
${row} > .${KEYVALUE_TABLE_NAME_CELL_CLASS} { flex: 0 0 ${KEYVALUE_TABLE_NAME_COLUMN_WIDTH} !important; width: auto !important; align-self: stretch; display: flex; align-items: center; min-height: ${KEYVALUE_TABLE_ROW_HEIGHT_PX - 1}px; padding: 0 6px 0 ${KEYVALUE_TABLE_INDENTED_PADDING}; margin-right: 2px; box-sizing: border-box; border-right: 1px solid ${KEYVALUE_TABLE_GRID_LINE_COLOR}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ${Theme.uiFontFamily} !important; font-size: 11px !important; }
`.trim();
}

/**
 * Builds the rules that flatten the editors inside the value cells so they read
 * as table cells and show a frame only while hovered or focused.
 *
 * @returns CSS text.
 */
function keyvalueTableControlCss(): string {
  const row = `.${KEYVALUE_TABLE_FRAME_CLASS} .${KEYVALUE_TABLE_ROW_CLASS}`;
  const textInput = `${row} input:not([type="checkbox"]):not([type="color"])`;
  const controls = `${textInput}, ${row} select`;
  const activeControls = `${textInput}:hover, ${textInput}:focus, ${row} select:hover, ${row} select:focus`;
  return `
${controls} { height: ${KEYVALUE_TABLE_ROW_HEIGHT_PX - 2}px !important; padding-top: 0 !important; padding-bottom: 0 !important; line-height: normal !important; border-color: transparent !important; background-color: transparent !important; border-radius: 0 !important; font-family: ${Theme.uiFontFamily} !important; font-size: 11px !important; text-align: left !important; }
${row} select { padding-left: 4px !important; padding-right: 2px !important; }
${activeControls} { border-color: ${Theme.inputBorderColor} !important; background-color: ${Theme.inputBackgroundColor} !important; }
${row} select option { background: ${Theme.inputBackgroundColor}; }
`.trim();
}

/**
 * Builds the rules of the subtle group rows that name the rows after them.
 *
 * @returns CSS text.
 */
function keyvalueTableGroupRowCss(): string {
  const group = `.${KEYVALUE_TABLE_FRAME_CLASS} .${KEYVALUE_TABLE_GROUP_ROW_CLASS}`;
  return `
${group} { display: flex !important; align-items: center !important; gap: 4px; min-height: ${KEYVALUE_TABLE_ROW_HEIGHT_PX}px; padding-left: ${KEYVALUE_TABLE_INDENTED_PADDING} !important; padding-top: 0 !important; padding-bottom: 0 !important; padding-right: 2px !important; box-sizing: border-box; background: rgba(255, 255, 255, 0.035); border-top: none !important; border-bottom: 1px solid ${KEYVALUE_TABLE_GRID_LINE_COLOR}; font-family: ${Theme.uiFontFamily} !important; font-size: 11px !important; font-weight: 600 !important; font-style: normal !important; color: ${Theme.statusBarTextColor}; }
${group} * { font-family: ${Theme.uiFontFamily} !important; font-size: 11px !important; }
`.trim();
}
