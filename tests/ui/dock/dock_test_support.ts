import type { DockSide } from '@/ui/dock/dock_side.js';
import type { DockManagerFrame } from '@/ui/dock/manager/dock_manager.js';
import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';

/** Main window stand-in with a dock area and one pane per dock edge. */
export class DockTestFrame implements DockManagerFrame {
  readonly area: HTMLElement;
  readonly panes: Record<DockSide, HTMLElement>;
  private readonly visibility: Record<DockSide, boolean> = { left: false, right: false, bottom: false };

  /**
   * Creates the area and panes in the document.
   *
   * @param areaRect Client rect the dock area reports.
   */
  constructor(areaRect: PanelFloatingLayoutRect) {
    this.area = document.createElement('div');
    dockTestRectStub(this.area, areaRect);
    this.panes = {
      left: document.createElement('div'),
      right: document.createElement('div'),
      bottom: document.createElement('div'),
    };
    this.area.append(this.panes.left, this.panes.right, this.panes.bottom);
    document.body.appendChild(this.area);
  }

  /**
   * Returns the pane of an edge.
   *
   * @param side Dock edge.
   * @returns Pane.
   */
  dockPaneRead(side: DockSide): HTMLElement {
    return this.panes[side];
  }

  /**
   * Records whether the pane of an edge is shown.
   *
   * @param side Dock edge.
   * @param isVisible True when shown.
   */
  dockPaneVisibleSet(side: DockSide, isVisible: boolean): void {
    this.visibility[side] = isVisible;
  }

  /**
   * Returns whether the pane of an edge is shown.
   *
   * @param side Dock edge.
   * @returns True when shown.
   */
  isDockPaneVisible(side: DockSide): boolean {
    return this.visibility[side];
  }

  /**
   * Returns the dock area.
   *
   * @returns Area element.
   */
  dockAreaRead(): HTMLElement {
    return this.area;
  }
}

/**
 * Makes an element report a fixed client rect.
 *
 * @param element Element to stub.
 * @param rect Rect it reports.
 */
export function dockTestRectStub(element: HTMLElement, rect: PanelFloatingLayoutRect): void {
  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height);
}

/**
 * Creates a tool window with a layout id hosting a labelled element.
 *
 * @param layoutId Layout id of the window.
 * @param titleText Title of the window.
 * @param restoresOpen True to reopen it at startup.
 * @returns The window.
 */
export function dockTestWindowCreate(
  layoutId: string,
  titleText: string,
  restoresOpen = false,
): PanelFloatingContentHost {
  const content = document.createElement('div');
  content.textContent = `${titleText} content`;
  return new PanelFloatingContentHost(
    document.body,
    {
      titleText,
      className: `dock-test-${layoutId}`,
      width: '240px',
      height: '200px',
      layoutId,
      layoutRestoresOpen: restoresOpen,
    },
    content,
  );
}

/**
 * Dispatches a pointer event with a client point.
 *
 * @param target Event target.
 * @param type Event type.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @param modifiers Held modifier keys.
 */
export function dockTestPointerDispatch(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
  modifiers: { ctrlKey?: boolean } = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0, ...modifiers }),
  );
}
