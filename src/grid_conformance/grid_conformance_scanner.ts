import * as THREE from 'three';
import { readPersistentMeshDocument } from '@/mesh/document/mesh_document_binding.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import { gridConformanceBoundsOnGrid, gridConformancePointOnGrid } from './grid_conformance_point_check.js';
import type { GridConformanceMeshObject, GridConformanceViolation } from './grid_conformance_violation.js';

/**
 * Finds authored geometry (solid brushes and editable meshes) whose world
 * bounds leave the minimum grid, and lists editable mesh objects. Bounds are
 * checked rather than every vertex so slopes and round shapes drawn on the grid
 * conform.
 */
export class GridConformanceScanner {
  private readonly scratchPoint = new THREE.Vector3();

  /**
   * Lists every brush and editable mesh under the world whose world bounds have
   * a corner off the minimum grid.
   *
   * @param worldGroup Editor world root.
   * @returns Violations in scene order, brushes first.
   */
  violationsCollect(worldGroup: THREE.Object3D): GridConformanceViolation[] {
    worldGroup.updateMatrixWorld(true);
    return [...this.brushViolationsCollect(worldGroup), ...this.meshViolationsCollect(worldGroup)];
  }

  /**
   * Lists every editable mesh object under the world that is not part of a
   * solid model.
   *
   * @param worldGroup Editor world root.
   * @returns Mesh objects in scene order.
   */
  meshObjectsList(worldGroup: THREE.Object3D): GridConformanceMeshObject[] {
    return this.editableMeshesList(worldGroup).map((mesh) => ({ objectUuid: mesh.uuid, objectName: mesh.name }));
  }

  /**
   * Checks the world bounds of every solid brush.
   *
   * @param worldGroup Editor world root.
   * @returns Brush violations.
   */
  private brushViolationsCollect(worldGroup: THREE.Object3D): GridConformanceViolation[] {
    const violations: GridConformanceViolation[] = [];
    for (const model of SolidModelRegistry.collectUnder(worldGroup)) {
      for (const brush of model.getBrushes()) {
        const violation = this.brushViolationFind(model, brush);
        if (violation) {
          violations.push(violation);
        }
      }
    }
    return violations;
  }

  /**
   * Checks the world bounds of one brush.
   *
   * @param model Solid model owning the brush.
   * @param brush Brush to check.
   * @returns The violation, or null when the bounds lie on the grid.
   */
  private brushViolationFind(model: SolidModel, brush: SolidBrushInstance): GridConformanceViolation | null {
    const bounds = new THREE.Box3();
    for (const vertex of brush.getModelSpaceBrush().vertices) {
      bounds.expandByPoint(this.scratchPoint.copy(vertex).applyMatrix4(model.root.matrixWorld));
    }
    const offGridPoint = this.boundsOffGridCornerFind(bounds);
    if (!offGridPoint) {
      return null;
    }
    const objectUuid = brush.mesh?.uuid ?? model.root.uuid;
    return { key: brush.id, kind: 'brush', objectUuid, objectName: brush.name, offGridPoint };
  }

  /**
   * Checks the world bounds of every editable mesh.
   *
   * @param worldGroup Editor world root.
   * @returns Mesh violations.
   */
  private meshViolationsCollect(worldGroup: THREE.Object3D): GridConformanceViolation[] {
    const violations: GridConformanceViolation[] = [];
    for (const mesh of this.editableMeshesList(worldGroup)) {
      const offGridPoint = this.meshOffGridPointFind(mesh);
      if (offGridPoint) {
        violations.push({ key: mesh.uuid, kind: 'mesh', objectUuid: mesh.uuid, objectName: mesh.name, offGridPoint });
      }
    }
    return violations;
  }

  /**
   * Finds the bounds corner of one mesh that is off the grid.
   *
   * @param mesh Editable mesh.
   * @returns The off-grid bounds corner, or null when the bounds lie on the
   *   grid.
   */
  private meshOffGridPointFind(mesh: THREE.Mesh): THREE.Vector3 | null {
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) {
      return null;
    }
    const bounds = new THREE.Box3();
    for (let index = 0; index < positions.count; index += 1) {
      bounds.expandByPoint(this.scratchPoint.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
    }
    return this.boundsOffGridCornerFind(bounds);
  }

  /**
   * Returns the corner of world bounds that breaks the grid rule.
   *
   * @param bounds World bounds.
   * @returns The minimum or maximum corner when the bounds leave the grid,
   *   otherwise null.
   */
  private boundsOffGridCornerFind(bounds: THREE.Box3): THREE.Vector3 | null {
    if (bounds.isEmpty() || gridConformanceBoundsOnGrid(bounds)) {
      return null;
    }
    return gridConformancePointOnGrid(bounds.min) ? bounds.max.clone() : bounds.min.clone();
  }

  /**
   * Lists the meshes under the world that carry an editable mesh document and
   * do not belong to a solid model.
   *
   * @param worldGroup Editor world root.
   * @returns Editable meshes in scene order.
   */
  private editableMeshesList(worldGroup: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    worldGroup.traverse((object) => {
      if (object instanceof THREE.Mesh && readPersistentMeshDocument(object) && !SolidModel.fromObject(object)) {
        meshes.push(object);
      }
    });
    return meshes;
  }
}
