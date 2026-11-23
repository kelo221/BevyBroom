import * as THREE from 'three';
import { ENTITY_VISUAL_PART_USERDATA_KEY, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { GameEntityVisualVolumeOverlayBuilder } from '@/game_entity/visual/volume/game_entity_visual_volume_overlay_builder.js';
import {
  type GameEntityVolumeSpec,
  GameEntityVisualVolumeSpecResolver,
} from '@/game_entity/visual/volume/game_entity_visual_volume_spec.js';

/** Name of the volume marker group a volume carries. */
export const GAME_ENTITY_VOLUME_OVERLAY_NAME = 'Volume Marker';

/** UserData flag on the volume marker group. */
export const GAME_ENTITY_VOLUME_OVERLAY_KEY = 'isGameEntityVolumeOverlay';

/**
 * UserData key on the marker group holding the uuid of the volume it was made
 * for.
 */
const GAME_ENTITY_VOLUME_OVERLAY_OWNER_KEY = 'gameEntityVolumeOverlayOwner';

/** UserData key on the marker group holding the state its drawing was made from. */
const GAME_ENTITY_VOLUME_OVERLAY_LOOK_KEY = 'gameEntityVolumeOverlayLook';

/** Name of the invisible mesh that checks the drawing every time it is rendered. */
const GAME_ENTITY_VOLUME_OVERLAY_WATCH_NAME = 'Volume Marker Watch';

/**
 * Keeps the volume marker drawing of one object in step with its components and
 * its shape, drawn on its floor for views from inside and on its roof for views
 * from above: adds the drawing to meshes whose class asks for one, draws it
 * again when the spec or the bounds change, and removes it otherwise. A small
 * watch mesh checks again whenever the drawing renders, so it follows edits
 * live.
 */
export class GameEntityVisualVolumeOverlay {
  /**
   * Returns whether an object may carry a volume marker drawing.
   *
   * @param object Scene object.
   * @returns True for meshes that are not editor-only visuals.
   */
  static volumeCandidateIs(object: THREE.Object3D): object is THREE.Mesh {
    return object instanceof THREE.Mesh && !entityVisualPartIs(object);
  }

  /**
   * Brings an object's volume marker drawing in step.
   *
   * @param object Scene object.
   */
  static refresh(object: THREE.Object3D): void {
    const spec = GameEntityVisualVolumeOverlay.volumeCandidateIs(object)
      ? GameEntityVisualVolumeSpecResolver.specOf(object)
      : null;
    if (spec === null || !(object instanceof THREE.Mesh)) {
      GameEntityVisualVolumeOverlay.remove(object);
      return;
    }
    const localBounds = GameEntityVisualVolumeOverlay.localBoundsOf(object);
    const lookKey = GameEntityVisualVolumeOverlay.lookKeyOf(spec, localBounds, object.scale);
    const overlay = GameEntityVisualVolumeOverlay.find(object);
    if (overlay !== null && overlay.userData[GAME_ENTITY_VOLUME_OVERLAY_LOOK_KEY] === lookKey) {
      return;
    }
    GameEntityVisualVolumeOverlay.remove(object);
    object.add(GameEntityVisualVolumeOverlay.overlayCreate(object, spec, localBounds, lookKey));
  }

  /**
   * Returns the volume marker group an object carries for itself.
   *
   * @param object Scene object.
   * @returns The group, or null when the object has none made for it.
   */
  static find(object: THREE.Object3D): THREE.Group | null {
    const overlay = object.children.find(
      (child) =>
        child instanceof THREE.Group &&
        child.userData[GAME_ENTITY_VOLUME_OVERLAY_KEY] === true &&
        child.userData[GAME_ENTITY_VOLUME_OVERLAY_OWNER_KEY] === object.uuid,
    );
    return overlay instanceof THREE.Group ? overlay : null;
  }

  /**
   * Removes and frees every volume marker group of an object, including copies
   * made for another object.
   *
   * @param object Scene object.
   */
  static remove(object: THREE.Object3D): void {
    const overlays = object.children.filter((child) => child.userData[GAME_ENTITY_VOLUME_OVERLAY_KEY] === true);
    for (const overlay of overlays) {
      object.remove(overlay);
      GameEntityVisualVolumeOverlayBuilder.floorDispose(overlay);
    }
  }

  /**
   * Returns a mesh's bounds in its own space, measured again from its geometry.
   *
   * @param mesh Volume mesh.
   * @returns Local bounds.
   */
  static localBoundsOf(mesh: THREE.Mesh): THREE.Box3 {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox?.clone() ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  }

  /**
   * Returns a text key that changes whenever the drawing would change.
   *
   * @param spec Marker spec.
   * @param localBounds Local bounds of the volume.
   * @param scale Local scale of the volume.
   * @returns Key text.
   */
  private static lookKeyOf(spec: GameEntityVolumeSpec, localBounds: THREE.Box3, scale: THREE.Vector3): string {
    const bounds = [...localBounds.min.toArray(), ...localBounds.max.toArray(), ...scale.toArray()];
    return `${JSON.stringify(spec)}|${bounds.join(',')}`;
  }

  /**
   * Creates the volume marker group of a volume with its drawing and watch.
   *
   * @param volume Volume mesh.
   * @param spec Marker spec.
   * @param localBounds Local bounds of the volume.
   * @param lookKey Key of the state the drawing is made from.
   * @returns Marker group.
   */
  private static overlayCreate(
    volume: THREE.Mesh,
    spec: GameEntityVolumeSpec,
    localBounds: THREE.Box3,
    lookKey: string,
  ): THREE.Group {
    const overlay = new THREE.Group();
    overlay.name = GAME_ENTITY_VOLUME_OVERLAY_NAME;
    overlay.userData[GAME_ENTITY_VOLUME_OVERLAY_KEY] = true;
    overlay.userData[ENTITY_VISUAL_PART_USERDATA_KEY] = true;
    overlay.userData[GAME_ENTITY_VOLUME_OVERLAY_OWNER_KEY] = volume.uuid;
    overlay.userData[GAME_ENTITY_VOLUME_OVERLAY_LOOK_KEY] = lookKey;
    overlay.add(GameEntityVisualVolumeOverlayBuilder.floorBuild(spec, localBounds, volume.scale, 'floor'));
    overlay.add(GameEntityVisualVolumeOverlayBuilder.floorBuild(spec, localBounds, volume.scale, 'roof'));
    overlay.add(GameEntityVisualVolumeOverlay.watchCreate(volume));
    return overlay;
  }

  /**
   * Creates the invisible mesh that, whenever it renders, checks the drawing
   * again right after the current frame.
   *
   * @param volume Volume mesh the watch checks.
   * @returns Watch mesh drawing nothing.
   */
  private static watchCreate(volume: THREE.Mesh): THREE.Mesh {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
    const watch = new THREE.Mesh(geometry, material);
    watch.name = GAME_ENTITY_VOLUME_OVERLAY_WATCH_NAME;
    watch.frustumCulled = false;
    watch.userData[ENTITY_VISUAL_PART_USERDATA_KEY] = true;
    watch.raycast = () => undefined;
    watch.onBeforeRender = () => queueMicrotask(() => GameEntityVisualVolumeOverlay.refresh(volume));
    return watch;
  }
}
