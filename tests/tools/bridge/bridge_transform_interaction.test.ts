import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeTransformInteraction } from '@/tools/bridge/bridge_transform_interaction.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { TransformMode } from '@/types/transform_mode.js';
import { Theme } from '@/theme.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { CommandStack } from '@/commands/command_stack.js';
import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { ENTITY_HANDLE_SNAP_NONE } from '@/entity/handles/entity_handle.js';
import { entityHandleClientPointOf } from '@/entity/handles/entity_handle_picker.js';
import { EntityHandleSystem } from '@/entity/handles/entity_handle_system.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/** Minimal viewport stand-in used to drive transform bridge events. */
class MockViewport {
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private gizmoGroup: THREE.Group;
  private cameraNavigating: boolean;
  private readonly viewportKind: ViewportKind;

  /**
   * Creates a mock viewport with a bounds-capable gizmo group.
   *
   * @param gizmoGroup Visible gizmo group used for pick interactability.
   * @param camera Viewport camera.
   * @param viewportKind Kind of pane the mock stands in for.
   */
  constructor(
    gizmoGroup: THREE.Group,
    camera: THREE.Camera = createPerspectiveCamera(),
    viewportKind: ViewportKind = ViewportKind.PERSPECTIVE,
  ) {
    this.camera = camera;
    this.viewportKind = viewportKind;
    this.camera.updateMatrixWorld(true);
    const canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      width: 800,
      height: 600,
      style: { cursor: '' },
    };
    this.renderer = { domElement: canvas } as unknown as THREE.WebGLRenderer;
    this.gizmoGroup = gizmoGroup;
    this.gizmoGroup.visible = true;
    this.gizmoGroup.updateMatrixWorld(true);
    this.cameraNavigating = false;
  }

  getCamera(): THREE.Camera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getContentElement(): HTMLElement {
    return this.renderer.domElement as HTMLElement;
  }

  getGizmoGroup(): THREE.Group {
    return this.gizmoGroup;
  }

  getViewportKind(): ViewportKind {
    return this.viewportKind;
  }

  /**
   * Marks the mock camera as panning/flying for hover-suppression tests.
   *
   * @param navigating Whether navigation is active.
   */
  setCameraNavigating(navigating: boolean): void {
    this.cameraNavigating = navigating;
  }

  isCameraNavigating(): boolean {
    return this.cameraNavigating;
  }
}

describe('TransformInteractionBridge', () => {
  let selectionManager: ManagerSelection;
  let transformGizmo: GizmoTransform;
  let transformHandler: HandlerTransform;
  let viewport: MockViewport;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    selectionManager = new ManagerSelection();
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    selectionManager.selectObject(mesh);
    transformGizmo = new GizmoTransform(Theme);
    transformGizmo.setMode(TransformMode.BOUNDS);
    transformGizmo.setVisible(true);
    transformGizmo.updateBoundsFromMeshes([mesh]);
    const gridSnap = new GridSnap(false, 1);
    const executor = new TransformExecutor(gridSnap);
    transformHandler = new HandlerTransform(
      transformGizmo,
      new GizmoRaycaster(),
      executor,
      new TransformConstraint(),
      new CommandStack(16),
    );
    const gizmoGroup = transformGizmo.getHandleGroupClone();
    viewport = new MockViewport(gizmoGroup);
  });

  it('should not start transform interaction when interaction is disabled', () => {
    const bridge = createBridge(() => false);
    const onPointerDown = vi.spyOn(transformHandler, 'onPointerDown');
    const event = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    const consumed = bridge.onTransformEvent(event, viewport as unknown as Viewport3D);
    expect(consumed).toBe(false);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(transformHandler.isDragging()).toBe(false);
  });

  it('should allow transform interaction when interaction is enabled', () => {
    const bridge = createBridge(() => true);
    const onPointerDown = vi.spyOn(transformHandler, 'onPointerDown');
    const event = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    bridge.onTransformEvent(event, viewport as unknown as Viewport3D);
    expect(onPointerDown).toHaveBeenCalled();
  });

  it('should treat omitted isInteractionEnabled as always enabled', () => {
    const bridge = createBridge(undefined);
    const onPointerDown = vi.spyOn(transformHandler, 'onPointerDown');
    const event = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    bridge.onTransformEvent(event, viewport as unknown as Viewport3D);
    expect(onPointerDown).toHaveBeenCalled();
  });

  it('should end a bounds drag when pointerup fires on window outside the canvas', () => {
    const bridge = createBridge(() => true);
    const downEvent = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    const started = bridge.onTransformEvent(downEvent, viewport as unknown as Viewport3D);
    expect(started).toBe(true);
    expect(transformHandler.isDragging()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    expect(transformHandler.isDragging()).toBe(false);
  });

  it('should not resume dragging after window release when viewport receives move', () => {
    const bridge = createBridge(() => true);
    const typedViewport = viewport as unknown as Viewport3D;
    const downEvent = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    bridge.onTransformEvent(downEvent, typedViewport);
    expect(transformHandler.isDragging()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    const moveEvent = new MouseEvent('pointermove', { clientX: 450, clientY: 320 });
    const moveConsumed = bridge.onTransformEvent(moveEvent, typedViewport);
    expect(moveConsumed).toBe(false);
    expect(transformHandler.isDragging()).toBe(false);
  });

  it('should forward window pointermove to the transform handler while dragging', () => {
    const bridge = createBridge(() => true);
    const onPointerMove = vi.spyOn(transformHandler, 'onPointerMove');
    const downEvent = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    bridge.onTransformEvent(downEvent, viewport as unknown as Viewport3D);
    expect(transformHandler.isDragging()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 420, clientY: 310 }));
    expect(onPointerMove).toHaveBeenCalled();
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  });

  it('updates bounds from the drag viewport camera without a perspective viewport', () => {
    const orthoGroup = transformGizmo.getHandleGroupClone('xz');
    viewport = new MockViewport(orthoGroup, createTopOrthographicCamera(), ViewportKind.TOP);
    const bridge = createBridge(() => true);
    const updateBounds = vi.spyOn(transformGizmo, 'updateBoundsFromMeshes');
    const edge = pointerClientPointOfWorld(meshWorldEdgePoint(), viewport.getCamera(), viewport.getContentElement());
    const downEvent = new MouseEvent('pointerdown', { clientX: edge.clientX, clientY: edge.clientY });
    expect(bridge.onTransformEvent(downEvent, viewport as unknown as Viewport3D)).toBe(true);
    expect(transformHandler.isDragging()).toBe(true);
    expect(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: edge.clientX + 20, clientY: edge.clientY }));
    }).not.toThrow();
    expect(updateBounds).toHaveBeenCalled();
    const lastCall = updateBounds.mock.calls[updateBounds.mock.calls.length - 1];
    expect(lastCall?.[1]).toBe(viewport.getCamera());
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  });

  it('keeps the selection and starts a plain resize when Alt is held on a bounds handle', () => {
    const bridge = createBridge(() => true);
    const onPointerDown = vi.spyOn(transformHandler, 'onPointerDown');
    const handlePoint = pointerClientPointOfWorld(
      meshWorldCenter(),
      viewport.getCamera(),
      viewport.getContentElement(),
    );
    const event = new MouseEvent('pointerdown', {
      clientX: handlePoint.clientX,
      clientY: handlePoint.clientY,
      altKey: true,
    });
    expect(bridge.onTransformEvent(event, viewport as unknown as Viewport3D)).toBe(true);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(selectionManager.getAllSelectedObjectsAsArray()).toEqual([mesh]);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  });

  it('leaves presses inside the bounds to the active tool', () => {
    const orthoGroup = transformGizmo.getHandleGroupClone('xz');
    viewport = new MockViewport(orthoGroup, createTopOrthographicCamera(), ViewportKind.TOP);
    const bridge = createBridge(() => true);
    const interior = pointerClientPointOfWorld(meshWorldCenter(), viewport.getCamera(), viewport.getContentElement());
    const press = new MouseEvent('pointerdown', { clientX: interior.clientX, clientY: interior.clientY });
    expect(bridge.onTransformEvent(press, viewport as unknown as Viewport3D)).toBe(false);
    expect(transformHandler.isDragging()).toBe(false);
  });

  it('clears bounds hover while the viewport camera is navigating', () => {
    const bridge = createBridge(() => true);
    const typedViewport = viewport as unknown as Viewport3D;
    const handlePoint = pointerClientPointOfWorld(
      meshWorldCenter(),
      viewport.getCamera(),
      viewport.getContentElement(),
    );
    const hoverMove = new MouseEvent('pointermove', { clientX: handlePoint.clientX, clientY: handlePoint.clientY });
    bridge.onTransformEvent(hoverMove, typedViewport);
    expect(transformGizmo.getHighlightedBoundsFace()).not.toBeNull();
    viewport.setCameraNavigating(true);
    bridge.onTransformEvent(hoverMove, typedViewport);
    expect(transformGizmo.getHighlightedBoundsFace()).toBeNull();
  });

  it('clears bounds hover while right mouse button is held', () => {
    const bridge = createBridge(() => true);
    const typedViewport = viewport as unknown as Viewport3D;
    const handlePoint = pointerClientPointOfWorld(
      meshWorldCenter(),
      viewport.getCamera(),
      viewport.getContentElement(),
    );
    bridge.onTransformEvent(
      new MouseEvent('pointermove', { clientX: handlePoint.clientX, clientY: handlePoint.clientY }),
      typedViewport,
    );
    expect(transformGizmo.getHighlightedBoundsFace()).not.toBeNull();
    const rightHeldMove = new MouseEvent('pointermove', {
      clientX: handlePoint.clientX,
      clientY: handlePoint.clientY,
      buttons: 2,
    });
    bridge.onTransformEvent(rightHeldMove, typedViewport);
    expect(transformGizmo.getHighlightedBoundsFace()).toBeNull();
  });

  it('disables grid snap while Shift is held during a permanent gizmo drag move', () => {
    const gridSnap = new GridSnap(true, 1);
    const bridge = createBridge(() => true, {
      gridSnap,
      getUserSnapEnabled: () => true,
    });
    const downEvent = new MouseEvent('pointerdown', { clientX: 400, clientY: 300 });
    expect(bridge.onTransformEvent(downEvent, viewport as unknown as Viewport3D)).toBe(true);
    expect(transformHandler.isDragging()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 420, clientY: 310, shiftKey: true }));
    expect(gridSnap.isEnabled()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  });

  it('restores user snap preference when Shift is released during a drag move', () => {
    const gridSnap = new GridSnap(true, 1);
    const bridge = createBridge(() => true, {
      gridSnap,
      getUserSnapEnabled: () => true,
    });
    bridge.onTransformEvent(
      new MouseEvent('pointerdown', { clientX: 400, clientY: 300 }),
      viewport as unknown as Viewport3D,
    );
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 420, clientY: 310, shiftKey: true }));
    expect(gridSnap.isEnabled()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 430, clientY: 320, shiftKey: false }));
    expect(gridSnap.isEnabled()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  });

  it('restores user snap preference on pointerup so Shift precision cannot stick', () => {
    const gridSnap = new GridSnap(true, 1);
    const bridge = createBridge(() => true, {
      gridSnap,
      getUserSnapEnabled: () => true,
    });
    bridge.onTransformEvent(
      new MouseEvent('pointerdown', { clientX: 400, clientY: 300 }),
      viewport as unknown as Viewport3D,
    );
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 420, clientY: 310, shiftKey: true }));
    expect(gridSnap.isEnabled()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, shiftKey: true }));
    expect(gridSnap.isEnabled()).toBe(true);
  });

  it('grabs a selected light ball before the bounds controls and reports the drag', () => {
    const { entityHandles, light } = selectLightWithHandles();
    const began = vi.fn();
    const ended = vi.fn();
    const bridge = createBridge(() => true, { entityHandles, began, ended });
    const onPointerDown = vi.spyOn(transformHandler, 'onPointerDown');
    const target = entityHandles.overlay.targets()[0];
    const ball = target
      ? entityHandleClientPointOf(target, { camera: viewport.getCamera(), element: viewport.getContentElement() })
      : null;
    const startRadius = LightOwner.settingsRead(light)?.radius;
    const press = new MouseEvent('pointerdown', { clientX: ball?.x ?? 0, clientY: ball?.y ?? 0 });
    expect(bridge.onTransformEvent(press, viewport as unknown as Viewport3D)).toBe(true);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(began).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: (ball?.x ?? 0) + 30, clientY: ball?.y ?? 0 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: (ball?.x ?? 0) + 30, clientY: ball?.y ?? 0 }));
    expect(ended).toHaveBeenCalledTimes(1);
    expect(LightOwner.settingsRead(light)?.radius).not.toBe(startRadius);
  });

  /**
   * Selects only a point light's marker and creates a handle system for it.
   *
   * @returns Handle system and the light owner.
   */
  function selectLightWithHandles(): { entityHandles: EntityHandleSystem; light: THREE.Group } {
    const light = LightOwner.createDefault('Lamp', 'point');
    light.updateMatrixWorld(true);
    const marker = LightOwner.markerOf(light);
    const entityHandles = new EntityHandleSystem({
      worldObject: new THREE.Group(),
      selection: selectionManager,
      commandStack: new CommandStack(16),
      snap: ENTITY_HANDLE_SNAP_NONE,
    });
    selectionManager.clearSelection();
    if (marker) {
      selectionManager.selectObject(marker);
    }
    return { entityHandles, light };
  }

  /**
   * Returns the world center of the selected test mesh.
   *
   * @returns World center.
   */
  function meshWorldCenter(): THREE.Vector3 {
    return new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  }

  /**
   * Returns a point on the +X side of the selected test mesh bounds, which a
   * top view shows as a silhouette edge.
   *
   * @returns World point on the +X bounds side.
   */
  function meshWorldEdgePoint(): THREE.Vector3 {
    const bounds = new THREE.Box3().setFromObject(mesh);
    return new THREE.Vector3(bounds.max.x, bounds.getCenter(new THREE.Vector3()).y, 0);
  }

  /**
   * Builds a bridge with shared test fixtures.
   *
   * @param isInteractionEnabled Optional gate for transform picks.
   * @param options Optional snap and Shift overrides for precision tests.
   * @returns Configured TransformInteractionBridge.
   */
  function createBridge(
    isInteractionEnabled: (() => boolean) | undefined,
    options?: {
      gridSnap?: GridSnap;
      isShiftDown?: () => boolean;
      getUserSnapEnabled?: () => boolean;
      entityHandles?: EntityHandleSystem;
      began?: () => void;
      ended?: () => void;
    },
  ): BridgeTransformInteraction {
    const gridSnap = options?.gridSnap ?? new GridSnap(false, 1);
    const deps: ConstructorParameters<typeof BridgeTransformInteraction>[0] = {
      selectionManager,
      selectionVisualController: {
        syncDuringTransform: () => undefined,
      } as never,
      transformGizmo,
      transformHandler,
      transformExecutor: new TransformExecutor(gridSnap),
      gridSnap,
      inputManager: { isShiftDown: options?.isShiftDown ?? (() => false) } as never,
      propertiesPanel: { refreshBoundObject: () => undefined } as never,
      worldObject: new THREE.Group(),
      getUserSnapEnabled: options?.getUserSnapEnabled ?? (() => false),
      isTransformSpaceLocal: () => false,
      onAfterTransformCommit: () => undefined,
    };
    if (isInteractionEnabled !== undefined) {
      deps.isInteractionEnabled = isInteractionEnabled;
    }
    if (options?.entityHandles) {
      deps.entityHandles = options.entityHandles;
    }
    deps.onPermanentGizmoHandleDragBegan = options?.began ?? (() => undefined);
    deps.onPermanentGizmoHandleDragEnded = options?.ended ?? (() => undefined);
    return new BridgeTransformInteraction(deps);
  }
});

/** @returns Perspective camera centered on the test selection. */
function createPerspectiveCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** @returns Top orthographic camera centered on the test selection. */
function createTopOrthographicCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 1000);
  camera.position.set(0, 10, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  return camera;
}
