import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import { appendMenuDropdownCaret } from '@/ui/menu/menu_dropdown_caret.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';
import {
  TOOLBAR_OVERFLOW_PRIORITY_GLOBAL,
  toolbarOverflowItemMark,
} from '@/ui/toolbar/overflow/toolbar_overflow_item.js';
import { ToolbarOverflowController } from '@/ui/toolbar/overflow/toolbar_overflow_controller.js';
import type { ToolbarOverflowMeasure } from '@/ui/toolbar/overflow/toolbar_overflow_measure.js';

export type {
  ToolbarDropdownItem,
  ToolbarMenuAction,
  ToolbarMenuEntry,
  ToolbarMenuSeparator,
  ToolbarMenuSubmenu,
} from '@/ui/menu/menu_types.js';

/** Three toolbar presentations available through bottom-edge dragging. */
export type ToolbarSize = 'small' | 'medium' | 'large';

/** `toolbar` is the resizable icon strip; `menubar` is a slim row of text menus. */
export type ToolbarVariant = 'toolbar' | 'menubar';

/** Height of the slim menu bar row in CSS pixels. */
export const TOOLBAR_MENUBAR_HEIGHT_PX = 24;

/** Visible text of the overflow menu trigger. */
const TOOLBAR_OVERFLOW_TRIGGER_LABEL = '»';

/** CSS class of the overflow menu trigger wrapper. */
export const TOOLBAR_OVERFLOW_TRIGGER_CLASS = 'editor-toolbar-overflow';

/**
 * How much smaller the buttons and icons of the small toolbar are, in CSS
 * pixels.
 */
const TOOLBAR_SMALL_SHRINK_PX = 4;

/** Size of the buttons of the small toolbar in CSS pixels. */
const TOOLBAR_SMALL_BUTTON_PX = Theme.toolbarButtonPx - TOOLBAR_SMALL_SHRINK_PX;

/** Size of the icons of the small toolbar in CSS pixels. */
const TOOLBAR_SMALL_ICON_PX = Theme.toolbarIconPx - TOOLBAR_SMALL_SHRINK_PX;

const TOOLBAR_SIZES: readonly ToolbarSize[] = ['small', 'medium', 'large'];
const TOOLBAR_MIN_HEIGHTS: Readonly<Record<ToolbarSize, number>> = {
  small: TOOLBAR_SMALL_BUTTON_PX + TOOLBAR_SMALL_SHRINK_PX,
  medium: Theme.toolbarHeightPx,
  large: Theme.toolbarHeightPx,
};

/**
 * Single-line application toolbar with compact Hammer-style chrome. Supports
 * text buttons, icon buttons, dropdown menus, slots, active states, and an
 * overflow menu that takes the items that do not fit.
 */
export class Toolbar {
  private container: HTMLElement;
  private buttons: HTMLButtonElement[];
  private openMenuPanel: PanelMenu | null;
  private openMenuButton: HTMLButtonElement | null;
  private dropdownPanels: Map<HTMLButtonElement, PanelMenu>;
  private readonly dropdownLiveEntries: Map<HTMLButtonElement, () => ToolbarMenuEntry[]>;
  private overflowController: ToolbarOverflowController | null;
  private overflowPriority: number;
  private iconButtons: HTMLButtonElement[];
  private buttonLabelsEnabled: boolean;
  private size: ToolbarSize;
  private resizeStartY: number | null;
  private resizeStartIndex: number;
  private resizeHandle: HTMLElement;
  private windowMoveListener: (event: PointerEvent) => void;
  private windowUpListener: () => void;
  private readonly documentPointerDownListener: (event: PointerEvent) => void;
  private readonly variant: ToolbarVariant;

  /**
   * Creates a new toolbar and appends it to the given container.
   *
   * @param container The parent DOM element to append the toolbar into.
   * @param variant Resizable icon toolbar, or a slim menu bar of text menus.
   */
  constructor(container: HTMLElement, variant: ToolbarVariant = 'toolbar') {
    this.variant = variant;
    this.container = document.createElement('div');
    this.container.classList.add(variant === 'menubar' ? 'editor-menubar' : 'editor-toolbar');
    this.buttons = [];
    this.openMenuPanel = null;
    this.openMenuButton = null;
    this.dropdownPanels = new Map();
    this.dropdownLiveEntries = new Map();
    this.overflowController = null;
    this.overflowPriority = TOOLBAR_OVERFLOW_PRIORITY_GLOBAL;
    this.iconButtons = [];
    this.buttonLabelsEnabled = true;
    this.size = 'medium';
    this.resizeStartY = null;
    this.resizeStartIndex = 1;
    this.windowMoveListener = (event) => this.onResizeMove(event);
    this.windowUpListener = () => this.endResize();
    this.documentPointerDownListener = (event) => this.handleDocumentPointerDown(event);
    this.applyStyles();
    this.resizeHandle = this.createResizeHandle();
    this.container.appendChild(this.resizeHandle);
    this.applyToolbarSize();
    container.appendChild(this.container);
    document.addEventListener('pointerdown', this.documentPointerDownListener);
  }

  /**
   * Returns the toolbar row element.
   *
   * @returns Toolbar root element.
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /** Restyles the row as a slim menu bar without the resize handle. */
  private menubarVariantApply(): void {
    if (this.variant !== 'menubar') {
      return;
    }
    this.resizeHandle.remove();
    this.container.style.minHeight = `${TOOLBAR_MENUBAR_HEIGHT_PX}px`;
    this.container.style.padding = '0 4px';
    this.container.style.gap = '0';
    this.container.style.background = hexToRgb(Theme.toolbarBackgroundEnd);
    this.container.style.boxShadow = 'none';
    this.container.style.flexWrap = 'nowrap';
  }

  /**
   * Restyles a menu header button for the slim menu bar.
   *
   * @param button Menu header button.
   */
  private menubarHeaderStyle(button: HTMLButtonElement): void {
    if (this.variant !== 'menubar') {
      return;
    }
    button.style.height = `${TOOLBAR_MENUBAR_HEIGHT_PX - 4}px`;
    button.style.padding = '0 8px';
    button.style.borderRadius = '3px';
    button.style.fontWeight = '400';
  }

  /**
   * Adds an empty inline slot that other components fill with their own
   * controls, keeping the toolbar's order of groups.
   *
   * @param className CSS class identifying the slot.
   * @returns Slot element placed at the end of the toolbar.
   */
  addSlot(className: string): HTMLElement {
    const slot = document.createElement('div');
    slot.classList.add(className);
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.gap = '2px';
    slot.style.flex = '0 0 auto';
    this.container.appendChild(slot);
    return slot;
  }

  /**
   * Sets the collapse rank given to items added from now on; lower ranks move
   * into the overflow menu first.
   *
   * @param priority Collapse rank for following items.
   */
  overflowPrioritySet(priority: number): void {
    this.overflowPriority = priority;
  }

  /**
   * Adds the overflow menu trigger at the end of the toolbar. Items that do not
   * fit the row are hidden and listed in its menu; the trigger shows only while
   * an item is hidden.
   *
   * @param measure Optional width check of the row; laid-out DOM widths by
   *   default.
   * @returns Controller that collapses items, already observing the row.
   */
  addOverflowMenu(measure?: ToolbarOverflowMeasure): ToolbarOverflowController {
    const button = this.dropdownCreate(TOOLBAR_OVERFLOW_TRIGGER_LABEL, []);
    button.title = 'More toolbar items';
    button.setAttribute('aria-label', 'More toolbar items');
    const wrapper = button.parentElement ?? button;
    wrapper.classList.add(TOOLBAR_OVERFLOW_TRIGGER_CLASS);
    this.overflowController?.dispose();
    const controller = new ToolbarOverflowController(this.container, wrapper, measure);
    this.dropdownLiveEntries.set(button, () => controller.menuEntriesBuild());
    controller.observe();
    this.overflowController = controller;
    return controller;
  }

  /**
   * Replaces the visible text of a dropdown header while keeping its caret.
   *
   * @param button Dropdown header button returned by addDropdown.
   * @param label New header text.
   */
  dropdownLabelSet(button: HTMLButtonElement, label: string): void {
    const labelNode = button.firstChild;
    if (labelNode && labelNode.nodeType === Node.TEXT_NODE) {
      labelNode.textContent = label;
    } else {
      button.insertBefore(document.createTextNode(label), button.firstChild);
    }
    button.title = label;
  }

  /**
   * Adds a text button to the toolbar with a label and click handler.
   *
   * @param label The text displayed on the button.
   * @param onClick The callback invoked when the button is clicked.
   * @returns The created button element.
   */
  addButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = label;
    button.addEventListener('click', onClick);
    this.applyButtonStyles(button, false);
    this.buttonAppend(button);
    return button;
  }

  /**
   * Adds a compact icon-only button with a tooltip label.
   *
   * @param label Accessible name and tooltip text.
   * @param iconSvg Inline SVG markup for the icon.
   * @param onClick Click handler.
   * @returns The created button element.
   */
  addIconButton(label: string, iconSvg: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = iconSvg;
    button.appendChild(this.iconButtonLabelCreate(label));
    button.addEventListener('click', onClick);
    this.applyButtonStyles(button, true);
    this.buttonAppend(button);
    this.iconButtons.push(button);
    this.applyIconButtonStyle(button, this.size === 'large' && this.buttonLabelsEnabled);
    return button;
  }

  /**
   * Creates the hidden text label an icon button shows in the large size.
   *
   * @param label Label text.
   * @returns Label span.
   */
  private iconButtonLabelCreate(label: string): HTMLElement {
    const visibleLabel = document.createElement('span');
    visibleLabel.textContent = label;
    visibleLabel.dataset['toolbarButtonLabel'] = 'true';
    visibleLabel.style.display = 'none';
    return visibleLabel;
  }

  /**
   * Appends a button to the row, registers it and marks it as collapsible.
   *
   * @param button Styled button.
   */
  private buttonAppend(button: HTMLButtonElement): void {
    toolbarOverflowItemMark(button, this.overflowPriority);
    this.container.appendChild(button);
    this.buttons.push(button);
  }

  /**
   * Controls whether expanded icon buttons may show their text labels.
   *
   * @param enabled Whether labels are enabled in expanded mode.
   */
  setButtonLabelsEnabled(enabled: boolean): void {
    this.buttonLabelsEnabled = enabled;
    this.refreshIconButtonAppearance();
  }

  /**
   * Applies one of the three supported toolbar sizes.
   *
   * @param size Small, medium, or large.
   */
  setSize(size: ToolbarSize): void {
    this.size = size;
    this.applyToolbarSize();
  }

  /** @returns Current snapped toolbar size. */
  getSize(): ToolbarSize {
    return this.size;
  }

  /**
   * Adds a dropdown menu with actions, separators, and nested submenus under a
   * single header button. Hovering another open top-level menu switches panels
   * like a Windows application menu bar.
   *
   * @param label The dropdown header label.
   * @param items The menu entries (actions, separators, submenus).
   * @returns The header button element.
   */
  addDropdown(label: string, items: ToolbarMenuEntry[]): HTMLButtonElement {
    const button = this.dropdownCreate(label, items);
    const wrapper = button.parentElement;
    if (wrapper) {
      toolbarOverflowItemMark(wrapper, this.overflowPriority, () => [
        { kind: 'submenu', label: button.title, children: items },
      ]);
    }
    return button;
  }

  /**
   * Creates a dropdown header with its menu panel and appends it to the row.
   *
   * @param label The dropdown header label.
   * @param items The menu entries.
   * @returns The header button element, child of its wrapper.
   */
  private dropdownCreate(label: string, items: ToolbarMenuEntry[]): HTMLButtonElement {
    const wrapper = this.dropdownWrapperCreate();
    const button = this.dropdownHeaderCreate(label);
    const panel = new PanelMenu(items, () => this.closeOpenMenu());
    this.dropdownPanels.set(button, panel);
    this.dropdownHeaderBind(button, panel);
    wrapper.appendChild(button);
    wrapper.appendChild(panel.getElement());
    this.container.appendChild(wrapper);
    this.buttons.push(button);
    return button;
  }

  /**
   * Creates the relative wrapper that anchors one dropdown panel.
   *
   * @returns Wrapper element.
   */
  private dropdownWrapperCreate(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.classList.add('editor-toolbar-dropdown');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.flex = '0 0 auto';
    return wrapper;
  }

  /**
   * Creates and styles one dropdown header button.
   *
   * @param label Header text.
   * @returns Header button.
   */
  private dropdownHeaderCreate(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.classList.add('editor-toolbar-menu-button');
    button.type = 'button';
    button.textContent = label;
    button.title = label;
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    this.applyButtonStyles(button, false);
    this.menubarHeaderStyle(button);
    if (this.variant !== 'menubar') {
      this.appendDropdownCaret(button);
    }
    return button;
  }

  /**
   * Opens the panel on click and switches to it on hover while another menu is
   * open.
   *
   * @param button Header button.
   * @param panel Menu panel the header owns.
   */
  private dropdownHeaderBind(button: HTMLButtonElement, panel: PanelMenu): void {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleDropdownMenu(panel, button);
    });
    button.addEventListener('mouseenter', () => {
      this.openDropdownOnHover(panel, button);
    });
  }

  /** Adds a visual separator between toolbar groups. */
  addSeparator(): void {
    const separator = document.createElement('div');
    this.applySeparatorStyles(separator);
    toolbarOverflowItemMark(separator, this.overflowPriority, () => [{ kind: 'separator' }]);
    this.container.appendChild(separator);
  }

  /**
   * Adds a flexible spacer that pushes following controls to the trailing edge
   * of the toolbar row.
   */
  addTrailingSpacer(): void {
    const spacer = document.createElement('div');
    spacer.dataset['toolbarTrailingSpacer'] = 'true';
    spacer.style.flex = '1 1 auto';
    spacer.style.minWidth = '12px';
    spacer.style.height = '1px';
    this.container.appendChild(spacer);
  }

  /**
   * Sets whether a specific button should appear active (selected).
   *
   * @param index The button index in the toolbar.
   * @param active Whether the button should be highlighted as active.
   */
  setButtonActive(index: number, active: boolean): void {
    const button = this.buttons[index];
    if (!button) return;
    this.applyActiveVisual(button, active);
  }

  /**
   * Finds the first button whose label or aria-label starts with the given
   * text.
   *
   * @param labelPrefix The button label prefix to match.
   * @param active Whether the button should appear active.
   */
  setButtonActiveByLabel(labelPrefix: string, active: boolean): void {
    const button = this.findButtonByLabelPrefix(labelPrefix);
    if (!button) return;
    this.applyActiveVisual(button, active);
  }

  /**
   * Returns the total number of buttons in the toolbar.
   *
   * @returns The button count.
   */
  getButtonCount(): number {
    return this.buttons.length;
  }

  /**
   * Returns the index of the first button whose label starts with the prefix.
   *
   * @param labelPrefix The label prefix to search for.
   * @returns The button index, or -1 if not found.
   */
  getButtonIndexByLabel(labelPrefix: string): number {
    return this.buttons.findIndex((entry) => this.buttonMatchesPrefix(entry, labelPrefix));
  }

  /**
   * Disposes the toolbar by removing it from the DOM and dropping its document
   * listeners.
   */
  dispose(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.buttons = [];
    this.openMenuPanel = null;
    this.openMenuButton = null;
    this.dropdownPanels.clear();
    this.dropdownLiveEntries.clear();
    this.overflowController?.dispose();
    this.overflowController = null;
    this.iconButtons = [];
    window.removeEventListener('pointermove', this.windowMoveListener);
    window.removeEventListener('pointerup', this.windowUpListener);
    document.removeEventListener('pointerdown', this.documentPointerDownListener);
  }

  /**
   * Creates the draggable strip along the toolbar's bottom edge.
   *
   * @returns Resize handle element.
   */
  private createResizeHandle(): HTMLElement {
    const handle = document.createElement('span');
    handle.classList.add('editor-toolbar-resize-handle');
    handle.title = 'Drag to resize toolbar';
    handle.style.position = 'absolute';
    handle.style.left = '0';
    handle.style.right = '0';
    handle.style.bottom = '0';
    handle.style.height = '6px';
    handle.style.cursor = 'ns-resize';
    handle.style.zIndex = '2';
    handle.addEventListener('pointerdown', (event) => this.beginResize(event));
    return handle;
  }

  /**
   * Begins a window-captured toolbar resize gesture.
   *
   * @param event Pointer press on the bottom resize edge.
   */
  private beginResize(event: PointerEvent): void {
    event.preventDefault();
    this.resizeStartY = event.clientY;
    this.resizeStartIndex = TOOLBAR_SIZES.indexOf(this.size);
    window.addEventListener('pointermove', this.windowMoveListener);
    window.addEventListener('pointerup', this.windowUpListener);
  }

  /**
   * Snaps live resize movement to one of the three toolbar sizes.
   *
   * @param event Window pointer movement during resizing.
   */
  private onResizeMove(event: PointerEvent): void {
    if (this.resizeStartY === null) return;
    const rowDelta = Math.round((event.clientY - this.resizeStartY) / 36);
    const nextIndex = Math.max(0, Math.min(2, this.resizeStartIndex + rowDelta));
    this.setSize(TOOLBAR_SIZES[nextIndex]!);
  }

  /** Ends the active toolbar resize gesture. */
  private endResize(): void {
    this.resizeStartY = null;
    window.removeEventListener('pointermove', this.windowMoveListener);
    window.removeEventListener('pointerup', this.windowUpListener);
  }

  /**
   * Applies the snapped presentation without reserving unused toolbar rows,
   * with equal vertical padding so menu and icon buttons stay centered. The
   * menu bar keeps its own slim presentation.
   */
  private applyToolbarSize(): void {
    this.container.style.height = 'auto';
    this.container.style.minHeight = `${TOOLBAR_MIN_HEIGHTS[this.size]}px`;
    this.container.style.padding = '2px 4px';
    this.refreshIconButtonAppearance();
    this.menubarVariantApply();
    this.overflowController?.refresh();
  }

  /**
   * Returns the button size of the current toolbar size.
   *
   * @returns Button size in CSS pixels.
   */
  private buttonSizePxRead(): number {
    return this.size === 'small' ? TOOLBAR_SMALL_BUTTON_PX : Theme.toolbarButtonPx;
  }

  /** Applies icon and text visibility for the current toolbar state. */
  private refreshIconButtonAppearance(): void {
    const showLabels = this.size === 'large' && this.buttonLabelsEnabled;
    this.iconButtons.forEach((button) => this.applyIconButtonStyle(button, showLabels));
  }

  /**
   * Applies the current state presentation to one icon button.
   *
   * @param button Icon button to update.
   * @param showLabel Whether its text label should be visible.
   */
  private applyIconButtonStyle(button: HTMLButtonElement, showLabel: boolean): void {
    const label = button.querySelector('[data-toolbar-button-label]') as HTMLElement | null;
    const icon = button.querySelector('svg');
    const iconSize = String(this.size === 'small' ? TOOLBAR_SMALL_ICON_PX : Theme.toolbarIconPx);
    const buttonSize = `${this.buttonSizePxRead()}px`;
    if (label) label.style.display = showLabel ? '' : 'none';
    if (icon) icon.style.display = showLabel ? 'none' : '';
    icon?.setAttribute('width', iconSize);
    icon?.setAttribute('height', iconSize);
    button.style.width = showLabel ? 'auto' : buttonSize;
    button.style.padding = showLabel ? '0 8px' : '0';
    button.style.minWidth = showLabel ? '0' : buttonSize;
    button.style.height = buttonSize;
  }

  /** Applies the toolbar container styles as a single compact strip. */
  private applyStyles(): void {
    const start = hexToRgb(Theme.toolbarBackground);
    const end = hexToRgb(Theme.toolbarBackgroundEnd);
    this.container.style.display = 'flex';
    this.container.style.position = 'relative';
    this.container.style.flexWrap = 'nowrap';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'flex-start';
    this.container.style.minHeight = `${Theme.toolbarHeightPx}px`;
    this.container.style.padding = '2px 4px';
    this.container.style.gap = '2px';
    this.container.style.background = `linear-gradient(180deg, ${start} 0%, ${end} 100%)`;
    this.container.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.container.style.boxShadow = 'none';
    this.container.style.userSelect = 'none';
    this.container.style.maxWidth = '100%';
    this.container.style.overflow = 'hidden';
    this.container.style.boxSizing = 'border-box';
    this.container.style.flexShrink = '0';
    this.container.style.zIndex = String(UiStackLayers.mainToolbar);
    this.container.style.fontFamily = Theme.uiFontFamily;
  }

  /**
   * Applies styles to individual toolbar buttons.
   *
   * @param button The button element to style.
   * @param iconOnly Whether the button is an icon-only control.
   */
  private applyButtonStyles(button: HTMLButtonElement, iconOnly: boolean): void {
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '4px';
    button.style.padding = iconOnly ? '0' : '0 6px';
    button.style.minWidth = iconOnly ? `${Theme.toolbarButtonPx}px` : '0';
    button.style.height = `${Theme.toolbarButtonPx}px`;
    button.style.flex = '0 0 auto';
    button.style.border = '1px solid transparent';
    button.style.borderRadius = `${Theme.controlRadiusPx}px`;
    button.style.background = 'transparent';
    button.style.color = Theme.buttonTextColor;
    button.style.cursor = 'pointer';
    button.style.fontFamily = Theme.uiFontFamily;
    button.style.fontSize = '12px';
    button.style.fontWeight = '500';
    button.style.letterSpacing = '0.01em';
    button.style.whiteSpace = 'nowrap';
    button.style.boxShadow = 'none';
    button.style.transition = 'background 80ms ease, border-color 80ms ease, color 80ms ease';
    this.buttonHoverListenersAdd(button);
  }

  /**
   * Highlights a button while the pointer is over it, unless it shows itself as
   * active.
   *
   * @param button Toolbar button.
   */
  private buttonHoverListenersAdd(button: HTMLButtonElement): void {
    button.addEventListener('mouseenter', () => {
      if (button.dataset['active'] !== 'true') {
        button.style.background = hexToRgb(Theme.buttonHoverColor);
        button.style.borderColor = hexToRgb(Theme.toggleAccentColor);
      }
    });
    button.addEventListener('mouseleave', () => {
      if (button.dataset['active'] !== 'true') {
        button.style.background = 'transparent';
        button.style.borderColor = 'transparent';
      }
    });
  }

  /**
   * Appends a subtle dropdown caret to a menu header button.
   *
   * @param button Dropdown header button.
   */
  private appendDropdownCaret(button: HTMLButtonElement): void {
    appendMenuDropdownCaret(button, document, '2px');
  }

  /**
   * Applies selected/unselected visuals to a toolbar button.
   *
   * @param button The button to update.
   * @param active Whether the button is selected.
   */
  private applyActiveVisual(button: HTMLButtonElement, active: boolean): void {
    button.dataset['active'] = active ? 'true' : 'false';
    if (active) {
      button.style.background = Theme.buttonPressedBackground;
      button.style.borderColor = Theme.toggleActiveBorder;
      button.style.color = Theme.buttonTextColor;
      button.style.boxShadow = 'none';
    } else {
      button.style.background = 'transparent';
      button.style.borderColor = 'transparent';
      button.style.color = Theme.buttonTextColor;
      button.style.boxShadow = 'none';
    }
  }

  /**
   * Applies styles to separator elements.
   *
   * @param separator The separator element to style.
   */
  private applySeparatorStyles(separator: HTMLElement): void {
    separator.style.width = '1px';
    separator.style.height = '18px';
    separator.style.background = hexToRgb(Theme.separatorColor);
    separator.style.margin = '0 4px';
    separator.style.flexShrink = '0';
  }

  /**
   * Toggles a dropdown menu open or closed.
   *
   * @param panel The menu panel to toggle.
   * @param button The header button that owns the menu.
   */
  private toggleDropdownMenu(panel: PanelMenu, button: HTMLButtonElement): void {
    if (this.openMenuPanel === panel) {
      this.closeOpenMenu();
      return;
    }
    this.openDropdownMenu(panel, button);
  }

  /**
   * Opens a different dropdown after the pointer enters its header when a menu
   * bar panel is already open.
   *
   * @param panel The menu panel to open.
   * @param button The header button that owns the menu.
   */
  private openDropdownOnHover(panel: PanelMenu, button: HTMLButtonElement): void {
    if (this.openMenuPanel && this.openMenuPanel !== panel) {
      this.openDropdownMenu(panel, button);
    }
  }

  /**
   * Opens a dropdown after closing whichever menu is currently visible.
   *
   * @param panel The menu panel to open.
   * @param button The header button that owns the menu.
   */
  private openDropdownMenu(panel: PanelMenu, button: HTMLButtonElement): void {
    this.closeOpenMenu();
    const liveEntries = this.dropdownLiveEntries.get(button);
    if (liveEntries) {
      panel.entriesSet(liveEntries());
    }
    panel.open(button);
    this.openMenuPanel = panel;
    this.openMenuButton = button;
    button.setAttribute('aria-expanded', 'true');
  }

  /** Closes the currently open dropdown menu if any. */
  private closeOpenMenu(): void {
    if (!this.openMenuPanel) return;
    this.openMenuPanel.close();
    this.openMenuButton?.setAttribute('aria-expanded', 'false');
    this.openMenuPanel = null;
    this.openMenuButton = null;
  }

  /**
   * Closes dropdowns when the user clicks outside the toolbar and open menu.
   *
   * @param event The document pointer event.
   */
  private handleDocumentPointerDown(event: Event): void {
    if (!this.openMenuPanel) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (this.container.contains(target)) return;
    if (this.openMenuPanel.getElement().contains(target)) return;
    this.closeOpenMenu();
  }

  /**
   * Finds a toolbar button by label or aria-label prefix.
   *
   * @param labelPrefix Prefix to match.
   * @returns Matching button or undefined.
   */
  private findButtonByLabelPrefix(labelPrefix: string): HTMLButtonElement | undefined {
    return this.buttons.find((entry) => this.buttonMatchesPrefix(entry, labelPrefix));
  }

  /**
   * Returns whether a button's visible label or aria-label starts with the
   * prefix.
   *
   * @param button Button to inspect.
   * @param labelPrefix Prefix to match.
   * @returns True when the button matches.
   */
  private buttonMatchesPrefix(button: HTMLButtonElement, labelPrefix: string): boolean {
    const text = (button.textContent || '').trim();
    if (text.startsWith(labelPrefix)) return true;
    const aria = button.getAttribute('aria-label') || '';
    return aria.startsWith(labelPrefix);
  }
}
