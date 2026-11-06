import type * as THREE from 'three';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { solidFaceTargetsFromSelections } from '@/selection/face/solid_face_target_resolver.js';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { getStateDisplacementSculptPress } from '@/displacement/state/state_displacement_sculpt_press.js';
import { displacementSculptRoutingActiveIs } from '@/displacement/sculpt/displacement_sculpt_routing.js';
import {
  displacementSculptModifiersSettingsApply,
  type DisplacementSculptModifiers,
} from '@/displacement/sculpt/displacement_sculpt_modifiers.js';
import {
  DisplacementSurfaceRaycaster,
  type DisplacementSurfaceHit,
} from '@/displacement/sculpt/displacement_surface_raycaster.js';
import type { DisplacementBrushCursor } from './displacement_brush_cursor.js';

/** Viewport the hover router raycasts through. */
export interface DisplacementBrushHoverViewport {
  /** Returns the viewport camera. */
  getCamera(): THREE.Camera;
  /** Returns the element whose bounds receive the viewport's pointer input. */
  getContentElement(): HTMLElement;
}

/** Services the displacement brush hover router works with. */
export interface RouterDisplacementBrushHoverDeps {
  /** Returns every viewport the pointer may hover. */
  readonly viewportsRead: () => readonly DisplacementBrushHoverViewport[];
  /** Returns the current face selection. */
  readonly selectedFacesRead: () => FaceSelection[];
  /** Returns whether Ctrl is held, which flips raise and lower. */
  readonly isCtrlDown: () => boolean;
  /** Returns whether Shift is held, which turns Paint Geometry into Smooth. */
  readonly isShiftDown: () => boolean;
  /** Returns whether face selection mode is active. */
  readonly isFaceModeActive: () => boolean;
  /** Cursor shown at the hovered surface point. */
  readonly cursor: DisplacementBrushCursor;
}

/** Event listeners bound on one document. */
interface DisplacementBrushHoverDocumentBinding {
  /** Removes the listeners. */
  unbind: () => void;
}

/**
 * Moves the displacement paint cursor to where the pointer hovers a selected
 * displaced face while a displacement paint tool is active in face mode, and
 * hides it everywhere else. Pointer samples are recorded on the documents that
 * host the viewports and raycast once per frame.
 */
export class RouterDisplacementBrushHover {
  private readonly surfaceRaycaster = new DisplacementSurfaceRaycaster();
  private readonly documentBindings = new Map<Document, DisplacementBrushHoverDocumentBinding>();
  private pointerSample: MouseEvent | null = null;

  /**
   * Creates the router.
   *
   * @param deps Viewports, face selection, Ctrl state, face mode and cursor.
   */
  constructor(private readonly deps: RouterDisplacementBrushHoverDeps) {}

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
   * Binds listeners on the viewport documents and shows the cursor at the
   * hovered selected displaced surface, or at the press point while a held
   * press resizes the brush, or hides it. While a paint press is held, the
   * cursor shows the keys and button that press started with.
   */
  frameRefresh(): void {
    this.documentListenersSync();
    const press = getStateDisplacementSculptPress().pressRead();
    const hit = this.isHoverActive() && press?.resizeAnchor ? press.resizeAnchor : this.hoverHitRead();
    if (!hit) {
      this.deps.cursor.hide();
      return;
    }
    const modifiers = press?.modifiers ?? this.keyModifiersRead();
    this.deps.cursor.showAt(
      hit,
      displacementSculptModifiersSettingsApply(getStateDisplacementSculpt().settingsRead(), modifiers),
    );
  }

  /** Removes every document listener and releases the surface raycaster. */
  dispose(): void {
    this.documentBindings.forEach((binding) => binding.unbind());
    this.documentBindings.clear();
    this.surfaceRaycaster.dispose();
  }

  /**
   * Reads the keys held now for a pointer that hovers without a press.
   *
   * @returns Modifiers of a left-button press with the held keys.
   */
  private keyModifiersRead(): DisplacementSculptModifiers {
    return { isCtrlDown: this.deps.isCtrlDown(), isShiftDown: this.deps.isShiftDown(), isSecondaryButton: false };
  }

  /**
   * Returns whether hovering should show the paint cursor.
   *
   * @returns True in face mode while a displacement paint tool routes viewport
   *   input.
   */
  private isHoverActive(): boolean {
    return this.deps.isFaceModeActive() && displacementSculptRoutingActiveIs();
  }

  /**
   * Raycasts the selected displaced faces under the latest pointer position.
   *
   * @returns Surface hit, or null when hovering is off or misses them.
   */
  private hoverHitRead(): DisplacementSurfaceHit | null {
    const sample = this.pointerSample;
    if (!sample || !this.isHoverActive()) {
      return null;
    }
    const viewport = this.viewportUnderSampleFind(sample);
    if (!viewport) {
      return null;
    }
    const targets = solidFaceTargetsFromSelections(this.deps.selectedFacesRead());
    return this.surfaceRaycaster.hitRead(sample, viewport.getCamera(), viewport.getContentElement(), targets);
  }

  /**
   * Finds the viewport whose content element contains a pointer sample.
   *
   * @param sample Pointer sample.
   * @returns Viewport under the pointer, or null.
   */
  private viewportUnderSampleFind(sample: MouseEvent): DisplacementBrushHoverViewport | null {
    return findPickSurfaceAtClientPoint(
      this.deps.viewportsRead(),
      (viewport) => viewport.getContentElement(),
      sample.clientX,
      sample.clientY,
      RouterDisplacementBrushHover.sampleDocumentRead(sample),
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
  private documentListenersBind(hostDocument: Document): DisplacementBrushHoverDocumentBinding {
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
