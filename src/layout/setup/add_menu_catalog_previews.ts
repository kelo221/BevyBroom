import * as THREE from 'three';
import { createMeshDocumentBox } from '@/mesh/primitive/mesh_primitive_box.js';
import { createMeshDocumentCylinder } from '@/mesh/primitive/mesh_primitive_cylinder.js';
import { createMeshDocumentPlane } from '@/mesh/primitive/mesh_primitive_plane.js';
import { createMeshDocumentSphere } from '@/mesh/primitive/mesh_primitive_sphere.js';
import { meshDocumentToBufferGeometry } from '@/mesh/convert/mesh_to_buffer_geometry.js';
import type { MeshDocument } from '@/mesh/document/mesh_document.js';
import type { GeometrySourceType } from '@/texture/uv/geometry_source.js';
import type { AddMenuCatalogPreviewFactory } from '@/layout/setup/add_menu_catalog.js';
import { Theme } from '@/theme.js';

/** Segment count around round preview primitives. */
const ADD_MENU_CATALOG_PREVIEW_ROUND_SEGMENTS = 24;

/**
 * Angle above which neighbouring faces of a preview primitive get an edge line,
 * in degrees.
 */
const ADD_MENU_CATALOG_PREVIEW_EDGE_ANGLE_DEGREES = 30;

/** Preview mesh documents of the primitive geometry types the Add menu creates. */
const ADD_MENU_CATALOG_PREVIEW_DOCUMENTS: Readonly<Partial<Record<GeometrySourceType, () => MeshDocument>>> = {
  box: () => createMeshDocumentBox(1, 1, 1),
  sphere: () =>
    createMeshDocumentSphere(0.5, ADD_MENU_CATALOG_PREVIEW_ROUND_SEGMENTS, ADD_MENU_CATALOG_PREVIEW_ROUND_SEGMENTS),
  cylinder: () => createMeshDocumentCylinder(0.5, 0.5, 1, ADD_MENU_CATALOG_PREVIEW_ROUND_SEGMENTS, 1, false),
  plane: () => createMeshDocumentPlane(1, 1, 1, 1),
};

/**
 * Returns a factory building the 3D preview of a primitive geometry type: a lit
 * mesh in the content colour with its hard edges drawn.
 *
 * @param sourceType Geometry type of the primitive.
 * @returns Preview factory, or undefined for types without a preview shape.
 */
export function addMenuCatalogPreviewPrimitive(
  sourceType: GeometrySourceType,
): AddMenuCatalogPreviewFactory | undefined {
  const documentCreate = ADD_MENU_CATALOG_PREVIEW_DOCUMENTS[sourceType];
  if (documentCreate === undefined) {
    return undefined;
  }
  return () => addMenuCatalogPreviewMeshCreate(documentCreate(), sourceType === 'plane');
}

/**
 * Builds a lit preview mesh from a mesh document, with edge lines as a child.
 *
 * @param document Mesh document of the shape.
 * @param isLaidFlat True to lay the shape flat on the ground plane.
 * @returns Preview mesh.
 */
function addMenuCatalogPreviewMeshCreate(document: MeshDocument, isLaidFlat: boolean): THREE.Mesh {
  const geometry = meshDocumentToBufferGeometry(document);
  const material = new THREE.MeshStandardMaterial({ color: Theme.boxColor, flatShading: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(addMenuCatalogPreviewEdgesCreate(geometry));
  if (isLaidFlat) {
    mesh.rotation.x = -Math.PI / 2;
  }
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Builds the hard edge lines of a preview geometry.
 *
 * @param geometry Preview geometry.
 * @returns Edge line segments.
 */
function addMenuCatalogPreviewEdgesCreate(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, ADD_MENU_CATALOG_PREVIEW_EDGE_ANGLE_DEGREES);
  return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: Theme.boxEdgeColor }));
}
