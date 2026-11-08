import * as THREE from 'three';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SceneRaycaster } from '@/selection/object/scene_raycaster.js';
import { sprinkleSurfaceMeshesFilter } from '@/tools/sprinkle/surface/sprinkle_surface_projector.js';
import type { SprinkleBrushCursor } from './sprinkle_brush_cursor.js';

/** Viewport the sprinkle hover router raycasts through. */
export interface SprinkleBrushHoverViewport {
  /** Returns the viewport camera. */
  getCamera(): THREE.Camera;
  /** Returns the element whose bounds receive the viewport's pointer input. */
  getContentElement(): HTMLElement;
  /** Returns the selectable meshes the scatter can land on. */
  getSelectableObjects(): THREE.Mesh[];
}

/** Press state the radius cursor follows. */
export interface SprinkleBrushHoverPress {
  /**
   * Returns where the cursor stays while the brush is resized.
   *
   * @returns Anchor point, or null when no resize is in progress.
   */
  resizeAnchorRead(): THREE.Vector3 | null;
  /**
   * Returns whether painting would remove entities now.
   *
   * @returns True for the subtractive look.
   */
  isSubtractiveShown(): boolean;
}

/** Services the sprinkle brush hover router works with. */
export interface RouterSprinkleBrushHoverDeps {
  /** Returns every viewport the pointer may hover. */
  readonly viewportsRead: () => readonly SprinkleBrushHoverViewport[];
  /** Cursor shown at the hovered surface point. */
  readonly cursor: SprinkleBrushCursor;
  /** Press state; without it the cursor only follows the pointer. */
  readonly press?: SprinkleBrushHoverPress;
}

/** Event listeners bound on one document. */
interface SprinkleBrushHoverDocumentBinding {
  /** Removes the listeners. */
  unbind: () => void;
}

/**
 * Moves the sprinkle radius cursor to where the pointer hovers a scene surface
 * while the Sprinkle tool is active, and hides it everywhere else. Pointer
 * samples are recorded on the documents that host the viewports and raycast
 * once per frame.
 */
export class RouterSprinkleBrushHover {
  private readonly surfaceRaycaster = new SceneRaycaster();
  private readonly documentBindings = new Map<Document, SprinkleBrushHoverDocumentBinding>();
  private pointerSample: MouseEvent | null = null;

  /**
   * Creates the router.
   *
   * @param deps Viewports and the cursor to drive.
   */
  constructor(private readonly deps: RouterSprinkleBrushHoverDeps) {}

  /**
   * Records the latest pointer position.
   *
   * @param event Pointer move event with client coordinates.
   */
  pointerMoveHandle(event: MouseEvent): void {
    this.pointerSample = event;
  }

  /** Forgets the pointer position and hides the cursor. */
  pointerLeaveHandle(): void {
    this.pointerSample = null;
    this.deps.cursor.hide();
  }

  /**
   * Binds listeners on the viewport documents and shows the cursor sized to the
   * sprinkle radius at the resize anchor while resizing, else at the hovered
   * scene surface, or hides it.
   */
  frameRefresh(): void {
    this.documentListenersSync();
    const point = this.deps.press?.resizeAnchorRead() ?? this.hoverHitRead();
    if (!point || !getStateSprinkleTool().toolActiveRead()) {
      this.deps.cursor.hide();
      return;
    }
    const isSubtractive = this.deps.press?.isSubtractiveShown() === true;
    this.deps.cursor.showAt(point, getStateSprinkleTool().configRead().radius, isSubtractive);
  }

  /** Removes every document listener and releases the surface raycaster. */
  dispose(): void {
    this.documentBindings.forEach((binding) => binding.unbind());
    this.documentBindings.clear();
    this.surfaceRaycaster.dispose();
  }

  /**
   * Raycasts the selectable meshes under the latest pointer position.
   *
   * @returns World hit point, or null when the tool is inactive or the pointer
   *   misses every surface.
   */
  private hoverHitRead(): THREE.Vector3 | null {
    const sample = this.pointerSample;
    if (!sample || !getStateSprinkleTool().toolActiveRead()) {
      return null;
    }
    const viewport = this.viewportUnderSampleFind(sample);
    if (!viewport) {
      return null;
    }
    const intersections = this.surfaceRaycaster.castIntersections(
      viewport.getCamera(),
      viewport.getContentElement(),
      sample,
      sprinkleSurfaceMeshesFilter(viewport.getSelectableObjects()),
    );
    const nearest = intersections[0];
    return nearest ? nearest.point : null;
  }

  /**
   * Finds the viewport whose content element contains a pointer sample.
   *
   * @param sample Pointer sample.
   * @returns Viewport under the pointer, or null.
   */
  private viewportUnderSampleFind(sample: MouseEvent): SprinkleBrushHoverViewport | null {
    return findPickSurfaceAtClientPoint(
      this.deps.viewportsRead(),
      (viewport) => viewport.getContentElement(),
      sample.clientX,
      sample.clientY,
      RouterSprinkleBrushHover.sampleDocumentRead(sample),
    );
  }

  /**
   * Binds pointer listeners on every document hosting a viewport and unbinds
   * documents that no longer host one.
   */
  private documentListenersSync(): void {
    const hostDocuments = new Set<Document>();
    this.deps.viewportsRead().forEach((viewport) => hostDocuments.add(viewport.getContentElement().ownerDocument));
    this.documentBindings.forEach((binding, hostDocument) => {
      if (!hostDocuments.has(hostDocument)) {
        binding.unbind();
        this.documentBindings.delete(hostDocument);
      }
    });
    hostDocuments.forEach((hostDocument) => {
      if (!this.documentBindings.has(hostDocument)) {
        this.documentBindings.set(hostDocument, this.documentListenersBind(hostDocument));
      }
    });
  }

  /**
   * Listens for pointer moves on a document and for the pointer leaving it.
   *
   * @param hostDocument Document hosting viewports.
   * @returns Binding that removes the listeners.
   */
  private documentListenersBind(hostDocument: Document): SprinkleBrushHoverDocumentBinding {
    const onMove = (event: MouseEvent) => this.pointerMoveHandle(event);
    const onLeave = () => this.pointerLeaveHandle();
    const leaveTarget = hostDocument.documentElement;
    hostDocument.addEventListener('pointermove', onMove, { capture: true, passive: true });
    leaveTarget.addEventListener('pointerleave', onLeave);
    return {
      unbind: () => {
        hostDocument.removeEventListener('pointermove', onMove, { capture: true });
        leaveTarget.removeEventListener('pointerleave', onLeave);
      },
    };
  }

  /**
   * Returns the document a pointer sample was raised in.
   *
   * @param sample Pointer sample.
   * @returns Owner document, or null when the sample has no node target.
   */
  private static sampleDocumentRead(sample: MouseEvent): Document | null {
    const target = sample.target as Node | null;
    if (!target || typeof target.nodeType !== 'number') {
      return null;
    }
    return target.nodeType === Node.DOCUMENT_NODE ? (target as Document) : target.ownerDocument;
  }
}
