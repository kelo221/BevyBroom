import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { SHELL_DOCK_COMPACT_GAP_PX } from '@/layout/shell/dock/shell_dock_compact.js';

/** Inline styles of the layers panel, its rows and its bottom bar. */
export class PanelLayersStyles {
  /**
   * Styles the panel root so it fills its host as a flex column.
   *
   * @param root Panel root element.
   */
  static rootApply(root: HTMLElement): void {
    Object.assign(root.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '0',
      background: hexToRgb(Theme.outlinerBackground),
      color: Theme.buttonTextColor,
      fontFamily: Theme.uiFontFamily,
      fontSize: `${Theme.uiFontSizePx}px`,
      userSelect: 'none',
    });
  }

  /**
   * Styles the scrolling list that holds the layer rows.
   *
   * @param list Row list element.
   */
  static listApply(list: HTMLElement): void {
    Object.assign(list.style, { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '2px 0' });
  }

  /**
   * Styles one layer row.
   *
   * @param row Row element.
   * @param isSelected True when the row is the panel's selected layer.
   */
  static rowApply(row: HTMLElement, isSelected: boolean): void {
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: `${SHELL_DOCK_COMPACT_GAP_PX}px`,
      padding: '1px 4px',
      minWidth: '0',
      cursor: 'default',
      background: isSelected ? Theme.outlinerSelectedColor : 'transparent',
      borderLeft: isSelected ? `2px solid ${Theme.listSelectedBorder}` : '2px solid transparent',
    });
  }

  /**
   * Styles the radio button that marks the current layer.
   *
   * @param radio Radio input.
   */
  static radioApply(radio: HTMLInputElement): void {
    Object.assign(radio.style, { margin: '0', accentColor: Theme.focusOutline, cursor: 'pointer' });
  }

  /**
   * Styles the column holding the layer name and its object count.
   *
   * @param column Text column element.
   */
  static textColumnApply(column: HTMLElement): void {
    Object.assign(column.style, { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: '0' });
  }

  /**
   * Styles the layer name.
   *
   * @param name Name element.
   * @param isCurrent True when the layer is the current layer.
   */
  static nameApply(name: HTMLElement, isCurrent: boolean): void {
    Object.assign(name.style, {
      fontWeight: isCurrent ? '700' : '400',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: '14px',
    });
  }

  /**
   * Styles the object count under the layer name.
   *
   * @param count Count element.
   */
  static countApply(count: HTMLElement): void {
    Object.assign(count.style, { color: Theme.outlinerNameIdColor, fontSize: '10px', lineHeight: '12px' });
  }

  /**
   * Styles a switch button of a layer row.
   *
   * @param toggle Switch button.
   * @param isOn True when the switch shows its active state.
   */
  static toggleApply(toggle: HTMLButtonElement, isOn: boolean): void {
    Object.assign(toggle.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      width: `${Theme.dockControlHeightPx}px`,
      height: `${Theme.dockControlHeightPx}px`,
      padding: '0',
      border: 'none',
      borderRadius: '4px',
      background: 'transparent',
      color: isOn ? Theme.rowToggleOnColor : Theme.rowToggleOffColor,
      cursor: 'pointer',
    });
  }

  /**
   * Styles the bottom bar with the add, remove and move buttons.
   *
   * @param bar Bottom bar element.
   */
  static toolbarApply(bar: HTMLElement): void {
    Object.assign(bar.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: `${SHELL_DOCK_COMPACT_GAP_PX}px`,
      padding: `${SHELL_DOCK_COMPACT_GAP_PX}px`,
      borderTop: `1px solid ${hexToRgb(Theme.separatorColor)}`,
      background: hexToRgb(Theme.toolbarBackground),
      flex: '0 0 auto',
    });
  }

  /**
   * Styles a bottom bar button.
   *
   * @param button Bar button.
   * @param isEnabled True when the button can be used.
   */
  static toolbarButtonApply(button: HTMLButtonElement, isEnabled: boolean): void {
    Object.assign(button.style, {
      minWidth: `${Theme.dockControlHeightPx}px`,
      height: `${Theme.dockControlHeightPx}px`,
      padding: '0 4px',
      boxSizing: 'border-box',
      fontSize: `${Theme.uiFontSizePx}px`,
      border: `1px solid ${Theme.chromeBorderColor}`,
      borderRadius: '4px',
      background: hexToRgb(Theme.buttonBackground),
      color: Theme.buttonTextColor,
      opacity: isEnabled ? '1' : '0.4',
      cursor: isEnabled ? 'pointer' : 'default',
    });
  }
}
