import { EditorToolId } from '@/types/editor_tool_id.js';
import { TransformMode } from '@/types/transform_mode.js';
import { EditorInteractionMode } from '@/types/editor_interaction_mode.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';
import { ViewportToolRail, type ViewportToolRailHandlers } from '@/tools/chrome/rail/viewport_tool_rail.js';
import {
  viewportToolChromeDockedStripStyle,
  type ViewportToolChromeDocking,
} from '@/tools/chrome/host/viewport_tool_chrome_docking.js';
import {
  ViewportToolOptionsBar,
  type ViewportToolOptionsBarHandlers,
} from '@/tools/chrome/options/viewport_tool_options_bar.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/** Combined handlers for rail and options bar. */
export interface ViewportToolChromeHandlers extends ViewportToolOptionsBarHandlers {
  onSelectTool: (toolId: EditorToolId) => void;
}

/**
 * Tool chrome: a tool rail and a tool options bar. Per-pane chrome floats in
 * the pane and is shown only while the pane owns hover; docked chrome sits
 * inline in two bars and is always shown. Surfaces are registered as
 * pointer-block chrome so the editor input bridge does not treat clicks on them
 * as exclusive viewport hits (same path as menus / floating panels).
 */
export class ViewportToolChromeHost {
  private readonly container: HTMLElement;
  private readonly rail: ViewportToolRail;
  private readonly optionsBar: ViewportToolOptionsBar;
  private readonly onPointerEnter: () => void;
  private readonly docking: ViewportToolChromeDocking | null;
  private hoverOwned: boolean;

  /**
   * Creates chrome for one viewport pane container, floating inside the pane,
   * or docked into two bars when a docking is given.
   *
   * @param container Pane host element, or the bar that owns docked chrome.
   * @param handlers Tool and action callbacks.
   * @param onHoverOwned Callback when the pointer enters this pane.
   * @param docking Parents for docked strips, or null to float inside the pane.
   */
  constructor(
    container: HTMLElement,
    handlers: ViewportToolChromeHandlers,
    onHoverOwned: (host: ViewportToolChromeHost) => void,
    docking: ViewportToolChromeDocking | null = null,
  ) {
    this.container = container;
    this.docking = docking;
    this.hoverOwned = false;
    this.optionsBar = new ViewportToolOptionsBar(
      docking?.optionsParent ?? container,
      ViewportToolChromeHost.optionsHandlersFrom(handlers),
    );
    this.rail = new ViewportToolRail(
      docking?.railParent ?? container,
      ViewportToolChromeHost.railHandlersFrom(handlers),
    );
    this.dockedStripsStyle();
    this.registerPointerBlockSurfaces();
    this.onPointerEnter = () => onHoverOwned(this);
    this.container.addEventListener('pointerenter', this.onPointerEnter);
    this.setHoverOwned(false);
  }

  /**
   * Creates chrome docked into bars: the tool buttons go into one parent and
   * the tool options into another. Docked chrome is always shown.
   *
   * @param docking Parents of the tool buttons strip and the tool options
   *   strip.
   * @param handlers Tool and action callbacks.
   * @returns Docked chrome host.
   */
  static dockedCreate(
    docking: ViewportToolChromeDocking,
    handlers: ViewportToolChromeHandlers,
  ): ViewportToolChromeHost {
    return new ViewportToolChromeHost(docking.optionsParent, handlers, () => undefined, docking);
  }

  /**
   * Returns whether this chrome is docked into bars instead of floating in a
   * pane.
   *
   * @returns True for docked chrome.
   */
  isDocked(): boolean {
    return this.docking !== null;
  }

  /**
   * Replaces handlers on rail and options bar.
   *
   * @param handlers New handlers.
   */
  setHandlers(handlers: ViewportToolChromeHandlers): void {
    this.rail.setHandlers(ViewportToolChromeHost.railHandlersFrom(handlers));
    this.optionsBar.setHandlers(ViewportToolChromeHost.optionsHandlersFrom(handlers));
  }

  /**
   * Picks the rail callbacks out of the combined chrome handlers.
   *
   * @param handlers Combined chrome handlers.
   * @returns Rail handlers.
   */
  private static railHandlersFrom(handlers: ViewportToolChromeHandlers): ViewportToolRailHandlers {
    return { onSelectTool: (toolId) => handlers.onSelectTool(toolId) };
  }

  /**
   * Picks the options bar callbacks out of the combined chrome handlers.
   *
   * @param handlers Combined chrome handlers.
   * @returns Options bar handlers that read the combined handlers on each call.
   */
  private static optionsHandlersFrom(handlers: ViewportToolChromeHandlers): ViewportToolOptionsBarHandlers {
    return {
      onTransformMode: (mode) => handlers.onTransformMode(mode),
      onFlipClipPlane: () => handlers.onFlipClipPlane(),
      onCommitClip: () => handlers.onCommitClip(),
      onCommitSplit: () => handlers.onCommitSplit(),
      faceInspectorReveal: () => handlers.faceInspectorReveal(),
      onExtrudeFaces: () => handlers.onExtrudeFaces(),
      onGridReset: () => handlers.onGridReset(),
      onGridAlignToFace: () => handlers.onGridAlignToFace(),
      onGridAlignAxis: (axis) => handlers.onGridAlignAxis(axis),
      onGridOriginVertex: () => handlers.onGridOriginVertex(),
      onCameraReset: () => handlers.onCameraReset(),
      onCameraAlignToFace: () => handlers.onCameraAlignToFace(),
      onInteractionMode: (mode) => handlers.onInteractionMode(mode),
      onComponentMode: (mode) => handlers.onComponentMode(mode),
      onApplyObjectTransform: (kind) => handlers.onApplyObjectTransform?.(kind),
      onConvexHull: () => handlers.onConvexHull?.(),
      onShapeSettingChanged: () => handlers.onShapeSettingChanged?.(),
      onEditKnife: () => handlers.onEditKnife?.(),
      onEditLoopCut: () => handlers.onEditLoopCut?.(),
      onEditMerge: (mode) => handlers.onEditMerge?.(mode),
      onEditDissolve: () => handlers.onEditDissolve?.(),
      onEditDelete: () => handlers.onEditDelete?.(),
    };
  }

  /** Restyles both strips as inline bar rows when this chrome is docked. */
  private dockedStripsStyle(): void {
    if (!this.docking) {
      return;
    }
    viewportToolChromeDockedStripStyle(this.rail.getElement());
    viewportToolChromeDockedStripStyle(this.optionsBar.getElement());
  }

  /**
   * Updates the highlighted tool on this pane.
   *
   * @param toolId Active tool.
   */
  setActiveTool(toolId: EditorToolId): void {
    this.rail.setActiveTool(toolId);
    this.optionsBar.setActiveTool(toolId);
  }

  /**
   * Highlights the armed single-use grid/camera options button.
   *
   * @param mode Armed pick mode, or none when idle.
   */
  setActiveGridPickMode(mode: import('@/tools/grid/grid_align_pick_mode.js').GridAlignPickMode): void {
    this.optionsBar.setActiveGridPickMode(mode);
  }

  /**
   * Updates transform mode highlight.
   *
   * @param mode Transform mode.
   */
  setActiveTransformMode(mode: TransformMode): void {
    this.optionsBar.setActiveTransformMode(mode);
  }

  /**
   * Updates the Object Mode / Edit Mode control.
   *
   * @param mode Interaction mode.
   */
  setActiveInteractionMode(mode: EditorInteractionMode): void {
    this.optionsBar.setActiveInteractionMode(mode);
    const showObjectOnly = mode === EditorInteractionMode.EDIT_MODE;
    this.rail.setToolButtonVisible(EditorToolId.OBJECT, true);
    this.rail.setToolButtonVisible(EditorToolId.FACE, !showObjectOnly);
    this.rail.setToolButtonVisible(EditorToolId.CLIP_PLANE, !showObjectOnly);
    this.rail.setToolButtonVisible(EditorToolId.GRID, !showObjectOnly);
  }

  /**
   * Updates the Edit Mode component mode highlight.
   *
   * @param mode Component mode.
   */
  setActiveComponentMode(mode: EditorComponentMode): void {
    this.optionsBar.setActiveComponentMode(mode);
  }

  /**
   * Enables or disables clip actions.
   *
   * @param enabled Whether clip actions are available.
   */
  setClipActionsEnabled(enabled: boolean): void {
    this.optionsBar.setClipActionsEnabled(enabled);
  }

  /**
   * Shows floating rail and top options bar only when this pane owns hover.
   * Docked chrome stays shown.
   *
   * @param owned True when this pane owns hover.
   */
  setHoverOwned(owned: boolean): void {
    this.hoverOwned = owned || this.docking !== null;
    this.rail.setVisible(this.hoverOwned);
    this.optionsBar.setVisible(this.hoverOwned);
  }

  /**
   * Returns whether this host is hover-owned.
   *
   * @returns Hover owned flag.
   */
  isHoverOwned(): boolean {
    return this.hoverOwned;
  }

  /**
   * Returns the pane container for this chrome.
   *
   * @returns Container element.
   */
  getContainer(): HTMLElement {
    return this.container;
  }

  /** Disposes rail, options bar, and listeners. */
  dispose(): void {
    this.container.removeEventListener('pointerenter', this.onPointerEnter);
    this.unregisterPointerBlockSurfaces();
    this.optionsBar.dispose();
    this.rail.dispose();
  }

  /**
   * Registers chrome roots so EditorInputBridge skips viewport routing for
   * clicks on tool buttons (same contract as open menus).
   */
  private registerPointerBlockSurfaces(): void {
    FloatingPanelStack.registerPointerBlockSurface(this.rail.getElement());
    FloatingPanelStack.registerPointerBlockSurface(this.optionsBar.getElement());
  }

  /** Unregisters chrome roots from the pointer-block set. */
  private unregisterPointerBlockSurfaces(): void {
    FloatingPanelStack.unregisterPointerBlockSurface(this.rail.getElement());
    FloatingPanelStack.unregisterPointerBlockSurface(this.optionsBar.getElement());
  }
}
