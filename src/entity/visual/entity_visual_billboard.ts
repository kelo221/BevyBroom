import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ICON_GRID_SIZE, IconRegistry } from '@/ui/icons/icon_registry.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';

/** UserData flag on the icon billboard of an entity owner. */
const ENTITY_ICON_USERDATA_KEY = 'isEntityIcon';

/** Icon geometries by icon name; shared by every billboard and never disposed. */
const entityVisualBillboardGeometries = new Map<IconName, THREE.BufferGeometry>();

/** Scratch world position of the billboard being drawn. */
const billboardWorldPosition = new THREE.Vector3();

/** Scratch camera position while reading the camera rotation. */
const billboardCameraPosition = new THREE.Vector3();

/** Scratch camera rotation the billboard copies. */
const billboardCameraQuaternion = new THREE.Quaternion();

/** Scratch camera scale while reading the camera rotation. */
const billboardCameraScale = new THREE.Vector3();

/** Scratch uniform size of the billboard. */
const billboardSize = new THREE.Vector3();

/**
 * Entity icons drawn as flat billboards that always face the camera and keep a
 * fixed size in meters, whatever the rotation and scale of their owner. They
 * are never picked; the owner's marker is.
 */
export class EntityVisualBillboard {
  /**
   * Returns the owner's icon billboard, creating it when missing and switching
   * its icon when the icon changed.
   *
   * @param owner Entity owner group.
   * @param iconName Icon to show.
   * @param sizeMeters Edge length of the icon in meters.
   * @param beforeRender Optional step run before every draw of the icon.
   * @returns The icon mesh.
   */
  static iconEnsure(
    owner: THREE.Object3D,
    iconName: IconName,
    sizeMeters: number,
    beforeRender?: () => void,
  ): THREE.Mesh {
    const icon = EntityVisualBillboard.iconFind(owner) ?? EntityVisualBillboard.iconCreate(owner);
    icon.geometry = EntityVisualBillboard.geometryOf(iconName);
    EntityVisualBillboard.behaviorApply(icon, sizeMeters, beforeRender);
    return icon;
  }

  /**
   * Returns the owner's icon billboard.
   *
   * @param owner Entity owner group.
   * @returns The icon mesh, or null before the first refresh.
   */
  static iconFind(owner: THREE.Object3D): THREE.Mesh | null {
    for (const child of owner.children) {
      if (child instanceof THREE.Mesh && child.userData[ENTITY_ICON_USERDATA_KEY] === true) {
        return child;
      }
    }
    return null;
  }

  /**
   * Returns the flat geometry of an icon: one meter wide, centered on the
   * origin in the XY plane with +Y up.
   *
   * @param iconName Icon name.
   * @returns Shared icon geometry.
   */
  static geometryOf(iconName: IconName): THREE.BufferGeometry {
    const cached = entityVisualBillboardGeometries.get(iconName);
    if (cached) {
      return cached;
    }
    const geometry = EntityVisualBillboard.geometryBuild(iconName);
    entityVisualBillboardGeometries.set(iconName, geometry);
    return geometry;
  }

  /**
   * Places a billboard at its world position, turned like the camera and sized
   * in meters, dropping the rotation and scale of its parents.
   *
   * @param icon Billboard mesh.
   * @param camera Camera of the current render.
   * @param sizeMeters Edge length of the icon in meters.
   */
  static faceCamera(icon: THREE.Object3D, camera: THREE.Camera, sizeMeters: number): void {
    billboardWorldPosition.setFromMatrixPosition(icon.matrixWorld);
    camera.matrixWorld.decompose(billboardCameraPosition, billboardCameraQuaternion, billboardCameraScale);
    icon.matrixWorld.compose(billboardWorldPosition, billboardCameraQuaternion, billboardSize.setScalar(sizeMeters));
  }

  /**
   * Creates an empty, never picked icon billboard under the owner that
   * refreshes keep and every shading mode leaves alone.
   *
   * @param owner Entity owner group.
   * @returns The icon mesh.
   */
  private static iconCreate(owner: THREE.Object3D): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const icon = new THREE.Mesh(new THREE.BufferGeometry(), material);
    icon.name = 'Entity Icon';
    icon.renderOrder = 1;
    icon.raycast = () => {};
    icon.userData[ENTITY_ICON_USERDATA_KEY] = true;
    shadingExemptFlag(icon);
    EntityVisualBuilder.partPersistentFlag(icon);
    owner.add(icon);
    return icon;
  }

  /**
   * Makes an icon face the camera of every render.
   *
   * @param icon Icon mesh.
   * @param sizeMeters Edge length of the icon in meters.
   * @param beforeRender Optional step run before every draw of the icon.
   */
  private static behaviorApply(icon: THREE.Mesh, sizeMeters: number, beforeRender?: () => void): void {
    icon.frustumCulled = false;
    icon.onBeforeRender = (_renderer, _scene, camera) => {
      beforeRender?.();
      EntityVisualBillboard.faceCamera(icon, camera, sizeMeters);
    };
  }

  /**
   * Builds the flat geometry of an icon from its SVG path data.
   *
   * @param iconName Icon name.
   * @returns New icon geometry.
   */
  private static geometryBuild(iconName: IconName): THREE.BufferGeometry {
    const grid = ICON_GRID_SIZE;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid} ${grid}"><path d="${IconRegistry.pathOf(iconName)}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => path.toShapes());
    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.translate(-grid / 2, -grid / 2, 0);
    geometry.scale(1 / grid, -1 / grid, 1);
    geometry.computeBoundingSphere();
    return geometry;
  }
}
