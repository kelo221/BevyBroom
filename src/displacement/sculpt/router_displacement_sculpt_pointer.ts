import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { RaycasterFaceSelection } from '@/selection/face/raycaster_face_selection.js';
import { solidFaceTargetsFromSelections } from '@/selection/face/solid_face_target_resolver.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { displacementSurfaceMeshFind } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementSculptStroke, type DisplacementSculptStrokeSettings } from './displacement_sculpt_stroke.js';

/** Services the viewport sculpt router works with. */
export interface RouterDisplacementSculptPointerDeps {
  /** Undo stack receiving one step per stroke. */
  readonly commandStack: CommandStack;
  /** Returns the current face selection. */
  readonly selectedFacesRead: () => FaceSelection[];
  /** Returns whether Ctrl is held, which flips raise and lower. */
  readonly isCtrlDown: () => boolean;
  /** Refreshes the viewport after a dab changed geometry. */
  readonly afterDab: () => void;
}

/**
 * Routes viewport drags to displacement sculpting while the Face Edit Sheet
 * shows its Displacement tab and Paint Geometry is on. Strokes paint the
 * displacement surfaces of the selected faces.
 */
export class RouterDisplacementSculptPointer {
  private readonly raycaster = new RaycasterFaceSelection();
  private stroke: DisplacementSculptStroke | null = null;
  private targets: SolidFaceTextureTarget[] = [];
  private strokeSeed = 1;

  /**
   * Creates the router.
   *
   * @param deps Undo stack, face selection and refresh services.
   */
  constructor(private readonly deps: RouterDisplacementSculptPointerDeps) {}

  /**
   * Returns whether viewport presses should sculpt instead of selecting.
   *
   * @returns True while the Displacement tab is open with Paint Geometry on.
   */
  isRoutingActive(): boolean {
    const session = getStateFaceEditSession();
    const paintEnabled = getStateDisplacementSculpt().settingsRead().paintEnabled;
    return paintEnabled && session.sheetOpenRead() && session.activeTabIdRead() === 'displacement';
  }

  /**
   * Returns whether a stroke is in progress.
   *
   * @returns True between a consumed press and its release.
   */
  isStrokeActive(): boolean {
    return this.stroke !== null;
  }

  /**
   * Starts a stroke when the press hits a selected displaced face.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns True when a stroke started.
   */
  strokeTryBegin(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (!this.isRoutingActive()) {
      return false;
    }
    this.targets = solidFaceTargetsFromSelections(this.deps.selectedFacesRead());
    const hitPoint = this.surfaceHitRead(event, camera, pickElement);
    if (!hitPoint) {
      return false;
    }
    this.stroke = new DisplacementSculptStroke(this.deps.commandStack, this.targets, this.strokeSettingsBuild());
    this.strokeSeed += 1;
    this.dabApply(hitPoint);
    return true;
  }

  /**
   * Paints one dab where the pointer now hits a selected displaced face.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns True when a stroke is active and consumed the sample.
   */
  strokeContinue(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (!this.stroke) {
      return false;
    }
    const hitPoint = this.surfaceHitRead(event, camera, pickElement);
    if (hitPoint) {
      this.dabApply(hitPoint);
    }
    return true;
  }

  /**
   * Ends the stroke and folds its dabs into one undo step.
   *
   * @returns Number of dabs that changed geometry, 0 without a stroke.
   */
  strokeEnd(): number {
    const stroke = this.stroke;
    this.stroke = null;
    this.targets = [];
    return stroke ? stroke.finish() : 0;
  }

  /** Ends any stroke in progress and releases the surface raycaster. */
  dispose(): void {
    this.strokeEnd();
    this.raycaster.dispose();
  }

  /**
   * Paints one dab and refreshes the viewport when geometry changed.
   *
   * @param center World-space dab center.
   */
  private dabApply(center: THREE.Vector3): void {
    if (this.stroke && this.stroke.dabApply(center) > 0) {
      this.deps.afterDab();
    }
  }

  /**
   * Builds the stroke settings from the shared Displacement tab settings.
   *
   * @returns Tool, radius, distance, direction and seed of the new stroke.
   */
  private strokeSettingsBuild(): DisplacementSculptStrokeSettings {
    const settings = getStateDisplacementSculpt().settingsRead();
    const raise = settings.raise !== this.deps.isCtrlDown();
    return {
      tool: settings.tool,
      radius: settings.radius,
      distance: settings.distance,
      direction: raise ? 1 : -1,
      seed: this.strokeSeed,
    };
  }

  /**
   * Raycasts the displacement surfaces of the stroke targets.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns World hit point, or null when no target surface is under the
   *   pointer.
   */
  private surfaceHitRead(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): THREE.Vector3 | null {
    const surfaceMeshes = this.targetSurfaceMeshesRead();
    if (surfaceMeshes.length === 0) {
      return null;
    }
    return this.raycaster.pickFace(event, camera, pickElement, surfaceMeshes)?.hitPoint ?? null;
  }

  /**
   * Lists the displacement surface meshes of the stroke targets.
   *
   * @returns Surface meshes of displaced target faces.
   */
  private targetSurfaceMeshesRead(): THREE.Mesh[] {
    return this.targets.flatMap((target) => {
      const surfaceMesh = displacementSurfaceMeshFind(target.model.root, target.brushId, target.surfaceIndex);
      return surfaceMesh ? [surfaceMesh] : [];
    });
  }
}
