import * as THREE from 'three';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import {
  ENTITY_POINT_BOX_SHAPE_DEFAULT,
  ENTITY_POINT_BOX_SIZE,
  EntityVisualPointBoxGeometry,
  type EntityPointBoxShape,
} from '@/entity/visual/entity_visual_point_box_geometry.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';

/** Icon edge length as a share of the default box edge length. */
const ENTITY_POINT_BOX_ICON_SHARE = 0.85;

/** Opacity of the box faces at full marker opacity. */
const ENTITY_POINT_BOX_FILL_OPACITY = 0.35;

/** UserData flag on the edge lines of a point box. */
const ENTITY_POINT_BOX_EDGES_USERDATA_KEY = 'isEntityPointBoxEdges';

/** What a point box shows. */
export interface EntityPointBoxLook {
  readonly name: string;
  readonly iconName: IconName;
  readonly colorHex: number;
  /** One for a normal entity; lower values fade a disabled one. */
  readonly opacity: number;
  /** Optional step run before every draw of the icon. */
  readonly beforeRender?: () => void;
  /** Size and placement of the box; the small box on the origin when left out. */
  readonly shape?: EntityPointBoxShape;
}

/**
 * Point entities drawn the way level editors draw them: a small translucent box
 * with outlined edges that is clicked and dragged like any object, with the
 * entity's icon floating inside it and facing the camera.
 */
export class EntityVisualPointBox {
  /**
   * Ensures the owner's box marker, its edges and its icon exist and match the
   * look. The box keeps its own material in every shading mode.
   *
   * @param owner Entity owner group.
   * @param look Name, icon, color and opacity.
   * @returns The box marker mesh.
   */
  static ensure(owner: THREE.Object3D, look: EntityPointBoxLook): THREE.Mesh {
    const shape = look.shape ?? ENTITY_POINT_BOX_SHAPE_DEFAULT;
    const marker = EntityVisualPointBox.shapeApply(owner, shape, look.name);
    const iconSize = ENTITY_POINT_BOX_SIZE * ENTITY_POINT_BOX_ICON_SHARE;
    EntityVisualBillboard.iconEnsure(owner, look.iconName, iconSize, look.beforeRender);
    EntityVisualPointBox.iconPlace(owner, shape);
    EntityVisualPointBox.tint(owner, look.colorHex, look.opacity);
    return marker;
  }

  /**
   * Gives the owner's box marker and its edges the geometry of a shape,
   * creating them when they are missing, and moves the icon to the box center.
   *
   * @param owner Entity owner group.
   * @param shape Size and placement of the box.
   * @param name Name of the marker mesh.
   * @returns The box marker mesh.
   */
  static shapeApply(owner: THREE.Object3D, shape: EntityPointBoxShape, name: string): THREE.Mesh {
    const geometryPair = EntityVisualPointBoxGeometry.pairOf(shape);
    const marker = EntityVisualBuilder.markerEnsure(owner, geometryPair.faces, name);
    shadingExemptFlag(marker);
    EntityVisualPointBox.edgesEnsure(marker, geometryPair.edges);
    EntityVisualPointBox.iconPlace(owner, shape);
    return marker;
  }

  /**
   * Moves the owner's icon, when it has one, to the center of a box shape.
   *
   * @param owner Entity owner group.
   * @param shape Size and placement of the box.
   */
  private static iconPlace(owner: THREE.Object3D, shape: EntityPointBoxShape): void {
    EntityVisualBillboard.iconFind(owner)?.position.set(...shape.offset);
  }

  /**
   * Colors the box faces, edges and icon of an owner.
   *
   * @param owner Entity owner group.
   * @param colorHex Entity color.
   * @param opacity One for a normal entity; lower values fade it.
   */
  static tint(owner: THREE.Object3D, colorHex: number, opacity: number): void {
    const marker = EntityVisualBuilder.markerFind(owner);
    if (marker) {
      EntityVisualPointBox.materialTint(marker.material, colorHex, opacity * ENTITY_POINT_BOX_FILL_OPACITY);
      const edges = EntityVisualPointBox.edgesFind(marker);
      EntityVisualPointBox.materialTint(edges?.material, colorHex, opacity);
    }
    EntityVisualPointBox.materialTint(EntityVisualBillboard.iconFind(owner)?.material, colorHex, opacity);
  }

  /**
   * Gives the edge lines under the marker an edge geometry, adding the lines
   * when they are missing.
   *
   * @param marker Box marker mesh.
   * @param edgesGeometry Edge geometry of the marker's box.
   */
  private static edgesEnsure(marker: THREE.Mesh, edgesGeometry: THREE.BufferGeometry): void {
    const existing = EntityVisualPointBox.edgesFind(marker);
    if (existing) {
      existing.geometry = edgesGeometry;
      return;
    }
    const edges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ transparent: true }));
    edges.name = 'Entity Box Edges';
    edges.raycast = () => {};
    edges.userData[ENTITY_POINT_BOX_EDGES_USERDATA_KEY] = true;
    EntityVisualBuilder.partPersistentFlag(edges);
    marker.add(edges);
  }

  /**
   * Returns the edge lines under a marker.
   *
   * @param marker Box marker mesh.
   * @returns The edge lines, or null when missing.
   */
  private static edgesFind(marker: THREE.Object3D): THREE.LineSegments | null {
    const edges = marker.children.find((child) => child.userData[ENTITY_POINT_BOX_EDGES_USERDATA_KEY] === true);
    return edges instanceof THREE.LineSegments ? edges : null;
  }

  /**
   * Sets the color and opacity of one basic material; ignores anything else.
   *
   * @param material Material to tint, or undefined.
   * @param colorHex Color.
   * @param opacity Opacity from zero to one.
   */
  private static materialTint(
    material: THREE.Material | THREE.Material[] | undefined,
    colorHex: number,
    opacity: number,
  ): void {
    if (!(material instanceof THREE.MeshBasicMaterial || material instanceof THREE.LineBasicMaterial)) {
      return;
    }
    material.color.setHex(colorHex);
    material.opacity = opacity;
    material.transparent = true;
    material.depthWrite = false;
  }
}
