import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ICON_GRID_SIZE, IconRegistry } from '@/ui/icons/icon_registry.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';
import { Theme } from '@/theme.js';

/** UserData flag on the icon billboard of an entity owner. */
const ENTITY_ICON_USERDATA_KEY = 'isEntityIcon';

/** Width of the dark halo stroked around icon outlines, in icon grid units. */
const ENTITY_ICON_HALO_WIDTH = 4;

/** Vertex color of the icon fill; the material tint shows through unchanged. */
const ENTITY_ICON_FILL_VERTEX_COLOR = new THREE.Color(1, 1, 1);

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
   * Draws the owner's icon, when it has one, as another icon.
   *
   * @param owner Entity owner group.
   * @param iconName Icon to draw.
   */
  static iconNameApply(owner: THREE.Object3D, iconName: IconName): void {
    const icon = EntityVisualBillboard.iconFind(owner);
    if (icon !== null) {
      icon.geometry = EntityVisualBillboard.geometryOf(iconName);
    }
  }

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
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
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
   * Builds the flat geometry of an icon from its SVG path data: a dark halo
   * stroked along every outline, then the fill drawn over it, together one
   * meter wide.
   *
   * @param iconName Icon name.
   * @returns New icon geometry with vertex colors.
   */
  private static geometryBuild(iconName: IconName): THREE.BufferGeometry {
    const svgPaths = EntityVisualBillboard.svgPathsParse(iconName);
    const halo = EntityVisualBillboard.haloGeometryBuild(svgPaths);
    const fill = new THREE.ShapeGeometry(svgPaths.flatMap((path) => path.toShapes())).toNonIndexed();
    EntityVisualBillboard.vertexColorsPaint(halo, new THREE.Color(Theme.entityIconHaloColor));
    EntityVisualBillboard.vertexColorsPaint(fill, ENTITY_ICON_FILL_VERTEX_COLOR);
    const geometry = mergeGeometries([halo, fill]) ?? fill;
    EntityVisualBillboard.geometryNormalize(geometry);
    return geometry;
  }

  /**
   * Parses the SVG path data of an icon.
   *
   * @param iconName Icon name.
   * @returns Parsed SVG paths in icon grid units.
   */
  private static svgPathsParse(iconName: IconName): THREE.ShapePath[] {
    const grid = ICON_GRID_SIZE;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid} ${grid}"><path d="${IconRegistry.pathOf(iconName)}"/></svg>`;
    return new SVGLoader().parse(svg).paths;
  }

  /**
   * Builds the stroke geometry that runs along every outline of the paths.
   *
   * @param svgPaths Parsed SVG paths.
   * @returns Non-indexed stroke geometry in icon grid units.
   */
  private static haloGeometryBuild(svgPaths: readonly THREE.ShapePath[]): THREE.BufferGeometry {
    const strokeStyle = SVGLoader.getStrokeStyle(ENTITY_ICON_HALO_WIDTH, undefined, 'round', 'round');
    const strokes = svgPaths
      .flatMap((path) => path.subPaths)
      .map((subPath) => SVGLoader.pointsToStroke(subPath.getPoints(), strokeStyle))
      .filter((stroke): stroke is THREE.BufferGeometry => stroke !== null);
    return mergeGeometries(strokes) ?? new THREE.BufferGeometry();
  }

  /**
   * Gives every vertex of a geometry the same color.
   *
   * @param geometry Geometry to paint.
   * @param color Vertex color.
   */
  private static vertexColorsPaint(geometry: THREE.BufferGeometry, color: THREE.Color): void {
    const vertexCount = geometry.getAttribute('position').count;
    const colors = new Float32Array(vertexCount * 3);
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      color.toArray(colors, vertexIndex * 3);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  /**
   * Moves icon grid geometry to the origin, flips it to +Y up and scales it so
   * the icon with its halo is one meter wide.
   *
   * @param geometry Geometry in icon grid units.
   */
  private static geometryNormalize(geometry: THREE.BufferGeometry): void {
    const grid = ICON_GRID_SIZE;
    const extent = grid + ENTITY_ICON_HALO_WIDTH;
    geometry.translate(-grid / 2, -grid / 2, 0);
    geometry.scale(1 / extent, -1 / extent, 1);
    geometry.computeBoundingSphere();
  }
}
