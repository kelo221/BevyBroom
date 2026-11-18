import * as THREE from 'three';
import { writePersistentMeshDocument } from '@/mesh/document/mesh_document_binding.js';
import { createMeshDocumentBox } from '@/mesh/primitive/mesh_primitive_box.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/** Offset that moves a grid-aligned coordinate off the minimum grid. */
export const GRID_TEST_OFF_GRID_OFFSET = GRID_INTERVAL_MINIMUM * 0.37;

/**
 * Adds a solid model holding one unit box brush placed at a position and scaled
 * by a size.
 *
 * @param world World group the model joins.
 * @param position Brush center.
 * @param size Brush size per axis.
 * @returns The model and its brush.
 */
export function gridTestBrushAdd(
  world: THREE.Object3D,
  position: THREE.Vector3,
  size: THREE.Vector3,
): { model: SolidModel; brush: SolidBrushInstance } {
  const model = new SolidModel('GridTestModel');
  const brush = model.addBoxBrush(1, SolidOperation.Additive);
  brush.position.copy(position);
  brush.scale.copy(size);
  brush.pushTransformToMesh();
  model.rebuild(true);
  world.add(model.root);
  return { model, brush };
}

/**
 * Adds an editable box mesh with a persistent mesh document.
 *
 * @param world World group the mesh joins.
 * @param position Mesh center.
 * @returns The mesh.
 */
export function gridTestMeshAdd(world: THREE.Object3D, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  writePersistentMeshDocument(mesh, createMeshDocumentBox(1, 1, 1));
  mesh.name = 'GridTestMesh';
  mesh.position.copy(position);
  world.add(mesh);
  return mesh;
}
