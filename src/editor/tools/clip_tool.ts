import type { Camera, Vector2 } from 'three';
import { Tool } from './tool.js';
import type { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import type { EditorServices } from '@/editor/window/editor_services.js';

/** Camera and pick element of the pane a pointer event belongs to. */
interface ClipToolPointerPane {
  camera: Camera;
  pickElement: HTMLElement;
}

/**
 * Clip plane tool as an editor Tool. Placement state stays on ToolClipPlane;
 * picking, preview, and commit stay on HandlerClipPlane. Mouse and focus go
 * through EditorWindow like every other tool.
 */
export class ClipTool extends Tool {
  private readonly placement: ToolClipPlane;
  private readonly handler: HandlerClipPlane;
  private sessionActive: boolean;

  /**
   * Creates a clip tool bound to placement state and the interaction handler.
   *
   * @param placement Clip placement model (points / plane).
   * @param handler Clip pointer, preview, and commit coordinator.
   */
  constructor(placement: ToolClipPlane, handler: HandlerClipPlane) {
    super();
    this.placement = placement;
    this.handler = handler;
    this.sessionActive = false;
  }

  /**
   * Returns whether this clip tool session is live.
   *
   * @returns True while activated through SwitchTool.
   */
  isSessionActive(): boolean {
    return this.sessionActive;
  }

  /**
   * Busy only after placement has begun (at least one point). Idle clip mode
   * (no points) stays non-busy so the exclusive mouse shield is off and the
   * user can switch tools freely; after a point is set, exclusive ownership
   * applies until cancel or commit clears placement.
   *
   * @returns True when the session is live and at least one point is set.
   */
  override isBusy(): boolean {
    if (!this.sessionActive) {
      return false;
    }
    if (this.handler.isPointerDragActive()) {
      return true;
    }
    return this.placement.getPoints().length > 0;
  }

  /** Called when the tool is activated. */
  override onActivate(): void {
    this.sessionActive = true;
    this.placement.activate();
    this.syncExclusiveViewportPin();
    this.editor?.getServices()?.setStatusMessage(this.placement.getStatusMessage());
  }

  /** Called when the tool is deactivated. */
  override onDeactivate(): void {
    this.handler.onEditorPointerUp(false);
    if (this.placement.isActive()) {
      this.placement.deactivate();
    }
    this.sessionActive = false;
    this.editor?.getServices()?.clearExclusiveViewport();
  }

  /**
   * Called when the tool receives a mouse down event.
   *
   * @param button Mouse button index.
   */
  override onMouseDown(button: number): void {
    if (button !== 0 || !this.sessionActive) {
      return;
    }
    const services = this.editor?.getServices();
    if (!services || !this.editor) {
      return;
    }
    const pointer = this.pointerPaneResolve(services, true);
    if (!pointer) {
      return;
    }
    this.handler.onPointerDown(pointer.event, pointer.pane.camera, pointer.pane.pickElement);
    this.syncExclusiveViewportPin();
  }

  /**
   * Called when the tool receives a mouse move event. Continues a drag, or
   * updates the hover preview under the pointer.
   *
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseMove(_screenDelta: Vector2, _gridDelta: Vector2): void {
    if (!this.sessionActive || !this.editor) {
      return;
    }
    const services = this.editor.getServices();
    if (this.handler.isPointerDragActive()) {
      this.handler.onEditorPointerMove(
        this.editor.lastPointerClientX,
        this.editor.lastPointerClientY,
        services?.isShiftPressed() === true,
      );
      return;
    }
    this.pointerHoverForward(services);
  }

  /**
   * Forwards a pointer move without a held button to the hover preview.
   *
   * @param services Editor services, or null before the window is ready.
   */
  private pointerHoverForward(services: EditorServices | null | undefined): void {
    const pointer = services ? this.pointerPaneResolve(services, false) : null;
    if (!pointer) {
      return;
    }
    this.handler.onPointerHover(pointer.event, pointer.pane.camera, pointer.pane.pickElement);
  }

  /**
   * Resolves the pane under the last pointer position and a synthetic event
   * carrying that position and the Shift state.
   *
   * @param services Editor services.
   * @param allowActivePaneFallback Whether to fall back to the active pane when
   *   the pointer is over no pane.
   * @returns Pointer event and pane, or null.
   */
  private pointerPaneResolve(
    services: EditorServices,
    allowActivePaneFallback: boolean,
  ): { event: MouseEvent; pane: ClipToolPointerPane } | null {
    if (!this.editor) {
      return null;
    }
    const clientX = this.editor.lastPointerClientX;
    const clientY = this.editor.lastPointerClientY;
    const pane =
      services.resolveInteractiveViewportAtClientPoint(clientX, clientY) ??
      (allowActivePaneFallback ? this.resolveActivePaneFallback(services) : null);
    if (!pane) {
      return null;
    }
    return { event: this.handler.createSyntheticMouseEvent(clientX, clientY, services.isShiftPressed()), pane };
  }

  /**
   * Called when the tool receives a mouse drag event.
   *
   * @param button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseDrag(button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {
    if (button !== 0) {
      return;
    }
    this.onMouseMove(_screenDelta, _gridDelta);
  }

  /**
   * Called when the tool receives a global mouse drag event.
   *
   * @param button Mouse button index.
   * @param screenDelta Screen-space movement delta.
   * @param gridDelta Grid/world-space movement delta.
   */
  override onGlobalMouseDrag(button: number, screenDelta: Vector2, gridDelta: Vector2): void {
    this.onMouseDrag(button, screenDelta, gridDelta);
  }

  /**
   * Called when the tool receives a global mouse up event.
   *
   * @param button Mouse button index.
   */
  override onGlobalMouseUp(button: number): void {
    if (button !== 0) {
      return;
    }
    if (this.handler.isPointerDragActive()) {
      this.handler.onEditorPointerUp(true);
      this.syncExclusiveViewportPin();
    }
  }

  /**
   * Called when the tool receives a key down event. Shape Editor: while
   * IsBusy(), only the active receiver gets keys — no global fallthrough — so
   * the clip keys (apply, cycle keep side) are matched here through the
   * keyboard settings.
   *
   * @param keyCode Key code string.
   * @param event Browser keyboard event, when one exists.
   * @returns True when consumed.
   */
  override onKeyDown(keyCode: string, event?: KeyboardEvent): boolean {
    if (!this.sessionActive) {
      return false;
    }
    if (keyCode === 'Escape') {
      this.toolOnCancel();
      return true;
    }
    if (!event || !this.handler.keyDownHandle(event)) {
      return false;
    }
    this.syncExclusiveViewportPin();
    return true;
  }

  /**
   * Pins every interactive pane (2D + 3D) while the clip session is live so
   * placement and navigation work in all viewports. The shield only mounts when
   * {@link isBusy} is true (points set); pin alone does not cover chrome.
   */
  private syncExclusiveViewportPin(): void {
    const services = this.editor?.getServices();
    if (!services) {
      return;
    }
    if (this.sessionActive) {
      services.pinExclusiveViewportDomain(services.getInteractiveViewportPickElements());
      return;
    }
    services.clearExclusiveViewport();
  }

  /**
   * Falls back to the layout active pane when the pointer is not over a content
   * element (e.g. jsdom tests).
   *
   * @param services Editor services.
   * @returns Active pane pick context, or null.
   */
  private resolveActivePaneFallback(services: EditorServices): ClipToolPointerPane | null {
    const camera = services.getActiveCamera();
    const pickElement = services.getActivePickElement();
    if (!camera || !pickElement) {
      return null;
    }
    return { camera, pickElement };
  }

  /** Cancels placement and returns to the parent or box select tool. */
  private toolOnCancel(): void {
    if (!this.editor) {
      return;
    }
    this.handler.onEditorPointerUp(false);
    const parent = this.parent;
    if (parent) {
      this.editor.switchTool(parent);
      return;
    }
    this.editor.userSwitchToBoxSelectTool();
  }
}
