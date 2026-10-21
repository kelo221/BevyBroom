import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ENTITY_HANDLE_SNAP_NONE } from '@/entity/handles/entity_handle.js';
import { entityHandleClientPointOf } from '@/entity/handles/entity_handle_picker.js';
import { EntityHandleSystem } from '@/entity/handles/entity_handle_system.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { entityHandleTestViewsCreate } from './entity_handle_test_views.js';

/** Pixel size of the fake pane. */
const PANE_PIXELS = 400;

/** A selection whose change callbacks the test triggers. */
class EntityHandleTestSelection {
  readonly selected: THREE.Object3D[] = [];
  private readonly callbacks: (() => void)[] = [];

  /**
   * Returns the selected objects.
   *
   * @returns Selected objects.
   */
  getSelectedObjects(): Iterable<THREE.Object3D> {
    return this.selected;
  }

  /**
   * Registers a change callback.
   *
   * @param callback Change callback.
   */
  onSelectionChanged(callback: () => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Replaces the selection and runs the change callbacks.
   *
   * @param objects New selection.
   */
  set(objects: THREE.Object3D[]): void {
    this.selected.splice(0, this.selected.length, ...objects);
    this.callbacks.forEach((callback) => callback());
  }
}

/**
 * Creates a scene with a selected spot light, the handle system and a top pane.
 *
 * @returns Parts of the setup.
 */
function systemSetup(): {
  scene: THREE.Scene;
  owner: THREE.Group;
  system: EntityHandleSystem;
  selection: EntityHandleTestSelection;
  commandStack: CommandStack;
  pane: { camera: THREE.Camera; element: HTMLElement };
} {
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const owner = LightOwner.create('Spot', lightSettingsCreateDefault('spot'));
  owner.position.set(-1, 2, 0.5);
  owner.rotation.set(-0.6, 0.3, 0);
  world.add(owner);
  world.updateMatrixWorld(true);
  const selection = new EntityHandleTestSelection();
  const commandStack = new CommandStack(16);
  const system = new EntityHandleSystem({ worldObject: world, selection, commandStack, snap: ENTITY_HANDLE_SNAP_NONE });
  selection.set([owner]);
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, PANE_PIXELS, PANE_PIXELS);
  const camera = entityHandleTestViewsCreate(owner.position)[1]?.camera ?? new THREE.PerspectiveCamera();
  return { scene, owner, system, selection, commandStack, pane: { camera, element } };
}

/**
 * Creates a pointer event at a client point.
 *
 * @param type Event type.
 * @param point Client point.
 * @returns Mouse event.
 */
function pointerAt(type: string, point: THREE.Vector2): MouseEvent {
  return new MouseEvent(type, { clientX: point.x, clientY: point.y, button: 0 });
}

/**
 * Returns where the radius ball of the setup's light sits in the pane.
 *
 * @param setup System setup.
 * @returns Client point.
 */
function radiusBallPixel(setup: ReturnType<typeof systemSetup>): THREE.Vector2 {
  const target = setup.system.overlay.targets().find((candidate) => candidate.handle.handleName === 'radius');
  const point = target ? entityHandleClientPointOf(target, setup.pane) : null;
  if (!point) {
    throw new Error('radius ball not shown');
  }
  return point;
}

describe('EntityHandleSystem', () => {
  it('shows one ball per handle beside the world and follows the selection', () => {
    const setup = systemSetup();
    expect(setup.system.overlay.group.parent).toBe(setup.scene);
    expect(setup.system.overlay.group.children).toHaveLength(2);
    setup.selection.set([]);
    expect(setup.system.overlay.group.children).toHaveLength(0);
  });

  it('draws each ball where its handle sits for the pane being drawn, at a fixed pixel size', () => {
    const setup = systemSetup();
    const renderer = { getViewport: (target: THREE.Vector4) => target.set(0, 0, PANE_PIXELS, PANE_PIXELS) };
    const balls = setup.system.overlay.group.children.filter(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh,
    );
    const settings = LightOwner.settingsRead(setup.owner) ?? lightSettingsCreateDefault('spot');
    setup.system.overlay.targets().forEach((target, index) => {
      const ball = balls[index];
      ball?.onBeforeRender(
        renderer as unknown as THREE.WebGLRenderer,
        setup.scene,
        setup.pane.camera,
        ball.geometry,
        ball.material as THREE.Material,
        null as unknown as THREE.Group,
      );
      const expected = target.handle.worldPositionFor({ owner: setup.owner, camera: setup.pane.camera }, settings);
      expect(ball?.position.distanceTo(expected)).toBeCloseTo(0, 6);
      expect(ball?.scale.x).toBeGreaterThan(0);
    });
  });

  it('drags a ball with the window pointer, leaves one undo step and reports the end', () => {
    const setup = systemSetup();
    const startRadius = LightOwner.settingsRead(setup.owner)?.radius ?? 0;
    const onEnded = vi.fn();
    const press = pointerAt('pointerdown', radiusBallPixel(setup));
    expect(setup.system.probe({ ...setup.pane, event: press })).toBe(true);
    expect(setup.system.dragBegin({ ...setup.pane, event: press }, window, onEnded)).toBe(true);
    const outward = radiusBallPixel(setup).add(new THREE.Vector2(40, 0));
    window.dispatchEvent(pointerAt('pointermove', outward));
    const draggedRadius = LightOwner.settingsRead(setup.owner)?.radius ?? 0;
    expect(draggedRadius).not.toBeCloseTo(startRadius, 3);
    window.dispatchEvent(pointerAt('pointerup', outward));
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(setup.system.isDragging()).toBe(false);
    expect(setup.commandStack.getUndoCount()).toBe(1);
    expect(LightOwner.settingsRead(setup.owner)?.radius).toBeCloseTo(draggedRadius, 6);
  });

  it('cancels a drag with Escape and restores the light', () => {
    const setup = systemSetup();
    const startRadius = LightOwner.settingsRead(setup.owner)?.radius ?? 0;
    const onEnded = vi.fn();
    setup.system.dragBegin({ ...setup.pane, event: pointerAt('pointerdown', radiusBallPixel(setup)) }, window, onEnded);
    window.dispatchEvent(pointerAt('pointermove', radiusBallPixel(setup).add(new THREE.Vector2(-60, 25))));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(LightOwner.settingsRead(setup.owner)?.radius).toBeCloseTo(startRadius, 6);
    expect(setup.commandStack.getUndoCount()).toBe(0);
  });

  it('ignores presses away from every ball', () => {
    const setup = systemSetup();
    const away = radiusBallPixel(setup).add(new THREE.Vector2(0, 80));
    expect(setup.system.dragBegin({ ...setup.pane, event: pointerAt('pointerdown', away) }, window, vi.fn())).toBe(
      false,
    );
  });
});
