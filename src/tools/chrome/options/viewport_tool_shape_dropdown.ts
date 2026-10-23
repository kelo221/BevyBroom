import { Theme } from '@/theme.js';
import { PanelMenu } from '@/ui/menu/panel_menu.js';
import { PanelMenuDropdown } from '@/ui/menu/panel_menu_dropdown.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { iconSvgElementCreate } from '@/ui/icons/icon_svg.js';
import { applyViewportToolOptionsTextButtonMetrics } from './viewport_tool_options_control_style.js';
import type { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import { shapeDrawShapeFind, shapeDrawShapesList } from '@/tools/shape_draw/shapes/shape_draw_shape_registry.js';

/** Options bar dropdown that picks the shape the draw tool creates. */
export class ViewportToolShapeDropdown extends PanelMenuDropdown {
  private readonly settings: ShapeDrawSettings;
  private readonly onShapeChosen: (shapeId: string) => void;
  private readonly iconSlot: HTMLSpanElement;

  /**
   * Creates the Shape dropdown.
   *
   * @param parentElement Options bar host.
   * @param settings Shape selection the dropdown reads and writes.
   * @param onShapeChosen Invoked after a shape was picked.
   */
  constructor(parentElement: HTMLElement, settings: ShapeDrawSettings, onShapeChosen: (shapeId: string) => void) {
    super(parentElement);
    this.settings = settings;
    this.onShapeChosen = onShapeChosen;
    this.iconSlot = this.iconSlotCreate(shapeDrawShapeFind(settings.getSelectedShapeId()).icon);
    this.buildChrome();
  }

  /** Rebuilds the trigger icon from the currently selected shape. */
  selectionRefresh(): void {
    const shape = shapeDrawShapeFind(this.settings.getSelectedShapeId());
    this.iconSlot.replaceChildren(iconSvgElementCreate(this.ownerDocument, shape.icon, 14));
  }

  /**
   * Builds the slot the current shape icon renders into.
   *
   * @param iconName Icon shown before the first refresh.
   * @returns Slot element holding one icon span.
   */
  private iconSlotCreate(iconName: Parameters<typeof iconSvgElementCreate>[1]): HTMLSpanElement {
    const slot = this.ownerDocument.createElement('span');
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.appendChild(iconSvgElementCreate(this.ownerDocument, iconName, 14));
    return slot;
  }

  /** Builds the trigger button chrome. */
  private buildChrome(): void {
    this.button.setAttribute('aria-label', 'Shape');
    this.styleTriggerButton();
    this.button.replaceChildren(this.iconSlot, this.labelSpanCreate());
    this.appendCaret(this.button);
    this.wrapper.appendChild(this.button);
    this.rebuildMenuPanel();
  }

  /**
   * Creates the Shape label span.
   *
   * @returns Label element.
   */
  private labelSpanCreate(): HTMLSpanElement {
    const label = this.ownerDocument.createElement('span');
    label.textContent = 'Shape';
    return label;
  }

  /** Styles the trigger like other options-bar text controls. */
  protected styleTriggerButton(): void {
    applyViewportToolOptionsTextButtonMetrics(this.button);
    this.button.style.gap = '3px';
    this.button.style.fontWeight = '600';
    this.button.style.fontFamily = Theme.uiFontFamily;
    this.button.style.fontSize = '11px';
  }

  /** Rebuilds the shape menu entries so the check mark stays current. */
  protected rebuildMenuPanel(): void {
    this.menuPanel?.dispose();
    this.menuPanel = new PanelMenu(this.menuEntriesCreate(), () => this.closeMenu(), false, this.ownerDocument);
    this.wrapper.appendChild(this.menuPanel.getElement());
  }

  /**
   * Builds one action entry per registered shape.
   *
   * @returns Menu entries in catalogue order.
   */
  private menuEntriesCreate(): ToolbarMenuEntry[] {
    return shapeDrawShapesList().map((shape) => ({
      label: shape.label,
      icon: shape.icon,
      isChecked: () => this.settings.getSelectedShapeId() === shape.id,
      onClick: () => {
        this.closeMenu();
        this.settings.shapeSelect(shape.id);
        this.onShapeChosen(shape.id);
      },
    }));
  }
}
