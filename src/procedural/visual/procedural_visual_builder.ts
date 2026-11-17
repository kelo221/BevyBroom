import * as THREE from 'three';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import { ProceduralBuild } from '@/procedural/build/procedural_build.js';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { Theme } from '@/theme.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** UserData key holding the build key the generated mesh was built from. */
export const PROCEDURAL_VISUAL_BUILD_KEY_USERDATA_KEY = 'proceduralBuildKey';

/** Name of the generated mesh an owner shows. */
export const PROCEDURAL_VISUAL_MESH_NAME = 'Procedural Mesh';

/** Name of the outline drawn over the generated mesh. */
export const PROCEDURAL_VISUAL_EDGES_NAME = 'Procedural Edges';

/** Smallest angle between faces whose shared edge is outlined, in degrees. */
const PROCEDURAL_VISUAL_EDGE_ANGLE_DEGREES = 1;

/** Icon of procedural objects whose generator is unknown. */
export const PROCEDURAL_ICON_UNKNOWN: IconName = 'puzzle';

/**
 * Shows a procedural object in the editor: the generated mesh, textured like a
 * brush and clicked like any object, rebuilt only when its settings change. An
 * object whose generator is unknown shows a point box instead.
 */
export class ProceduralVisualBuilder {
  /**
   * Brings the owner's visuals up to date with its settings.
   *
   * @param owner Procedural owner group.
   * @param settings Valid settings.
   */
  static refresh(owner: THREE.Object3D, settings: ProceduralSettings): void {
    EntityVisualBuilder.guidesRemove(owner);
    const parts = ProceduralBuild.displayPartsOf(settings);
    if (parts === null) {
      ProceduralVisualBuilder.unknownMarkerEnsure(owner);
      return;
    }
    const key = ProceduralBuild.keyOf(settings);
    const existing = ProceduralVisualBuilder.meshFind(owner);
    const mesh =
      existing?.userData[PROCEDURAL_VISUAL_BUILD_KEY_USERDATA_KEY] === key
        ? existing
        : ProceduralVisualBuilder.meshRebuild(owner, parts, settings, key);
    owner.add(ProceduralVisualBuilder.edgesCreate(mesh));
  }

  /**
   * Returns the generated mesh of an owner.
   *
   * @param owner Procedural owner group.
   * @returns The mesh, or null when the owner shows no generated mesh.
   */
  static meshFind(owner: THREE.Object3D): THREE.Mesh | null {
    const marker = EntityVisualBuilder.markerFind(owner);
    return marker?.userData[PROCEDURAL_VISUAL_BUILD_KEY_USERDATA_KEY] === undefined ? null : marker;
  }

  /**
   * Replaces the geometry and materials of the owner's generated mesh.
   *
   * @param owner Procedural owner group.
   * @param parts Parts to show.
   * @param settings Valid settings holding the slot textures.
   * @param key Build key of the settings.
   */
  private static meshRebuild(
    owner: THREE.Object3D,
    parts: readonly ProceduralPart[],
    settings: ProceduralSettings,
    key: string,
  ): THREE.Mesh {
    const previous = EntityVisualBuilder.markerFind(owner);
    const previousGeometry = previous?.geometry ?? null;
    const previousMaterials = previous ? ProceduralVisualBuilder.materialsOf(previous) : [];
    const mesh = EntityVisualBuilder.markerEnsure(
      owner,
      ProceduralGeometryBuilder.create(parts),
      PROCEDURAL_VISUAL_MESH_NAME,
    );
    mesh.material = ProceduralBuild.materialsCreate(parts, settings);
    mesh.userData[PROCEDURAL_VISUAL_BUILD_KEY_USERDATA_KEY] = key;
    previousGeometry?.dispose();
    previousMaterials.forEach((material) => material.dispose());
    return mesh;
  }

  /**
   * Creates the outline of the generated mesh: its face edges without the
   * triangle diagonals, so the object reads in wireframe views.
   *
   * @param mesh Generated mesh.
   * @returns Non-pickable edge lines, replaced on every refresh.
   */
  private static edgesCreate(mesh: THREE.Mesh): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(mesh.geometry, PROCEDURAL_VISUAL_EDGE_ANGLE_DEGREES);
    const position = edges.getAttribute('position');
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < position.count; index++) {
      points.push(new THREE.Vector3().fromBufferAttribute(position, index));
    }
    edges.dispose();
    const style = { colorHex: Theme.boxEdgeColor, opacity: 1, dashed: false };
    return EntityVisualBuilder.linesCreate(points, style, PROCEDURAL_VISUAL_EDGES_NAME);
  }

  /**
   * Shows the point box of an object whose generator is unknown.
   *
   * @param owner Procedural owner group.
   */
  private static unknownMarkerEnsure(owner: THREE.Object3D): void {
    EntityVisualPointBox.ensure(owner, {
      name: 'Procedural Marker',
      iconName: PROCEDURAL_ICON_UNKNOWN,
      colorHex: Theme.entityIconDefaultColor,
      opacity: 1,
    });
  }

  /**
   * Returns the materials of a mesh as a list.
   *
   * @param mesh Mesh.
   * @returns Its materials.
   */
  private static materialsOf(mesh: THREE.Mesh): THREE.Material[] {
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  }
}
