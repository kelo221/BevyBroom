import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { getSolidGroupOperation, isSolidCsgGroup, markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import {
  solidGroupShapeRecipeRead,
  solidGroupShapeRecipeWrite,
  type SolidGroupShapeRecipe,
} from '@/solid/model/solid_group_shape_recipe.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { createWingEdge, createSolidFace } from '@/solid/types/wing_edge.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import {
  FaceTextureMapping,
  createDefaultFaceTextureMapping,
  deserializeFaceTextureMapping,
  serializeFaceTextureMapping,
} from '@/texture/uv/face_texture_mapping.js';
import { isResultMesh } from '@/solid/model/solid_model_keys.js';
import { hierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';
import {
  solidSerializedTransformAssignFromMatrix,
  solidSerializedTransformSpaceChange,
  type SolidSerializedTransform,
} from '@/solid/io/solid_model_codec_transform.js';

/** Serializable snapshot of a solid brush instance. */
export interface SerializedSolidBrush {
  id: string;
  name: string;
  operation: SolidOperation;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  visible: boolean;
  /** Optional per-brush default surface texture identity (legacy). */
  surfaceTextureId?: string;
  /** Optional per-face texture overrides (legacy texture-id only). */
  faceTextureIds?: (string | undefined)[];
  /** Default UV/texture mapping for faces without overrides (legacy planar). */
  defaultMapping?: FaceTextureMapping;
  /** Sparse per-face full UV/texture mappings (legacy planar). */
  faceMappings?: (FaceTextureMapping | undefined)[];
  /** Default surface (texture + UV matrix). Preferred over defaultMapping. */
  defaultSurface?: {
    textureId: string;
    uv: { u: [number, number, number, number]; v: [number, number, number, number] };
  };
  /**
   * Sparse per-face surfaces (texture + UV matrix). Preferred over
   * faceMappings.
   */
  faceSurfaces?: Array<
    { textureId: string; uv: { u: [number, number, number, number]; v: [number, number, number, number] } } | undefined
  >;
  vertices: number[];
  wingEdges: Array<{ vertexIndex: number; twinIndex: number }>;
  edgeFaceIndices: number[];
  faces: Array<{ firstEdge: number; edgeCount: number; surfaceIndex: number }>;
}

/** Serializable solid CSG tree brush leaf. */
export interface SerializedSolidTreeBrushNode {
  kind: 'brush';
  /** Brush instance id matching a SerializedSolidBrush.id. */
  brushId: string;
}

/** Serializable solid CSG tree group branch. */
export interface SerializedSolidTreeGroupNode {
  kind: 'group';
  /** Stable group id for nesting references. */
  id: string;
  /** Display name. */
  name: string;
  /** Compound branch CSG operation. */
  operation: SolidOperation;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  /** Nested brushes and groups in evaluation order. */
  children: SerializedSolidTreeNode[];
  /** Recipe of a group a shape draw tool created, when present. */
  shape?: SolidGroupShapeRecipe;
}

/** Serializable solid CSG tree node. */
export type SerializedSolidTreeNode = SerializedSolidTreeBrushNode | SerializedSolidTreeGroupNode;

/**
 * Serializable snapshot of a solid model (brushes + optional hierarchy; mesh
 * geometry is rebuilt).
 */
export interface SerializedSolidModel {
  brushes: SerializedSolidBrush[];
  /** When true, CSG starts solid so subtractives carve rooms. */
  invertedWorld?: boolean;
  /**
   * Optional hierarchical CSG tree under the solid root. When omitted, brushes
   * are restored as a flat sibling list (legacy).
   */
  hierarchy?: SerializedSolidTreeNode[];
}

/** Encodes and decodes solid models for scene persistence. */
export class SolidModelCodec {
  /**
   * Serializes a solid model into a JSON-safe snapshot.
   *
   * @param model Solid model to encode.
   * @returns Serialized solid model payload.
   */
  static encode(model: SolidModel): SerializedSolidModel {
    this.encodePrepare(model);
    const payload: SerializedSolidModel = {
      brushes: model.getBrushes().map((brush) => this.encodeBrush(brush)),
    };
    if (model.isInvertedWorld()) {
      payload.invertedWorld = true;
    }
    const hierarchy = this.encodeHierarchy(model.root);
    if (hierarchy.length > 0 && hierarchy.some((node) => node.kind === 'group')) {
      payload.hierarchy = hierarchy;
    }
    return payload;
  }

  /**
   * Rebuilds a solid model from a serialized snapshot.
   *
   * @param data Serialized solid model.
   * @param name Root display name.
   * @returns Restored solid model with rebuilt geometry.
   */
  static decode(data: SerializedSolidModel, name: string): SolidModel {
    const model = new SolidModel(name);
    const instances = [];
    for (const brushData of data.brushes ?? []) {
      const instance = this.decodeBrush(brushData);
      hierarchyNameAllocator.noteExistingName(instance.name);
      instances.push(instance);
    }
    model.addBrushInstancesBatch(instances, 2, false);
    if (data.hierarchy && data.hierarchy.length > 0) {
      this.applyHierarchy(model, data.hierarchy);
    }
    model.markDirty();
    if (data.invertedWorld === true) {
      model.setInvertedWorld(true);
    } else {
      model.rebuild(true);
    }
    return model;
  }

  /**
   * Encodes brush meshes and solid CSG groups of one model. The transform of
   * each given node is written in world space so the nodes can be decoded into
   * any model; nested children keep transforms local to their group.
   *
   * @param model Solid model owning the nodes.
   * @param nodes Brush meshes and solid CSG groups of the model, in the order
   *   they are written; other objects are skipped.
   * @returns Brushes under the nodes and one hierarchy entry per node.
   */
  static encodeNodesWorldSpace(model: SolidModel, nodes: readonly THREE.Object3D[]): SerializedSolidModel {
    this.encodePrepare(model);
    const brushes: SerializedSolidBrush[] = [];
    const hierarchy: SerializedSolidTreeNode[] = [];
    for (const node of nodes) {
      this.encodeNodeWorldSpaceAppend(model, node, brushes, hierarchy);
    }
    return { brushes, hierarchy };
  }

  /**
   * Adds brushes and solid CSG groups to an existing model after its current
   * root children, whose order stays unchanged. Top-level node transforms are
   * read as world space and converted into the model root's space. Brush ids
   * are used as given, so callers pass fresh ids. The model is rebuilt for the
   * new brushes only.
   *
   * @param model Solid model receiving the nodes.
   * @param data Brushes and their hierarchy; without a hierarchy every brush is
   *   a top-level node.
   * @returns Created top-level brush meshes and groups in hierarchy order.
   */
  static decodeNodesInto(model: SolidModel, data: SerializedSolidModel): THREE.Object3D[] {
    const localized = this.nodesLocalizeToModel(model, data);
    const existingChildren = model.root.children.slice();
    const brushIds = this.brushesDecodeInto(model, localized.brushes);
    this.childrenOrderRestore(model.root, existingChildren);
    const brushMeshById = this.buildBrushMeshMap(model);
    const created = this.nodesHierarchyRead(localized)
      .map((node) => this.attachHierarchyNode(model.root, node, brushMeshById))
      .filter((object): object is THREE.Object3D => object !== null);
    model.syncBrushOrderFromScene();
    model.markBrushesDirty(brushIds);
    model.rebuild();
    return created;
  }

  /**
   * Syncs brush transforms and authored mappings from the scene before
   * encoding.
   *
   * @param model Solid model about to be encoded.
   */
  private static encodePrepare(model: SolidModel): void {
    model.syncBrushesFromScene();
    model.syncAuthoredMappingsFromResultMesh();
  }

  /**
   * Encodes one node with its brushes and writes its world transform onto the
   * node's own serialized transform.
   *
   * @param model Solid model owning the node.
   * @param node Brush mesh or solid CSG group.
   * @param brushes Accumulator for serialized brushes.
   * @param hierarchy Accumulator for top-level tree nodes.
   */
  private static encodeNodeWorldSpaceAppend(
    model: SolidModel,
    node: THREE.Object3D,
    brushes: SerializedSolidBrush[],
    hierarchy: SerializedSolidTreeNode[],
  ): void {
    const treeNode = this.encodeHierarchyChild(node);
    if (!treeNode) return;
    const nodeBrushes = this.encodeBrushesUnder(model, node);
    node.updateWorldMatrix(true, false);
    const ownTransform =
      treeNode.kind === 'group' ? treeNode : nodeBrushes.find((brush) => brush.id === treeNode.brushId);
    if (ownTransform) {
      solidSerializedTransformAssignFromMatrix(ownTransform, node.matrixWorld);
    }
    brushes.push(...nodeBrushes);
    hierarchy.push(treeNode);
  }

  /**
   * Encodes every registered brush at or under a scene node in scene order.
   *
   * @param model Solid model owning the brushes.
   * @param node Scene node to scan.
   * @returns Serialized brushes.
   */
  private static encodeBrushesUnder(model: SolidModel, node: THREE.Object3D): SerializedSolidBrush[] {
    const brushes: SerializedSolidBrush[] = [];
    node.traverse((object) => {
      const instance = SolidBrushVisual.isBrushObject(object) ? model.findBrushByMesh(object) : undefined;
      if (instance) brushes.push(this.encodeBrush(instance));
    });
    return brushes;
  }

  /**
   * Copies node data and converts top-level node transforms from world space
   * into the space of a model's root.
   *
   * @param model Solid model receiving the nodes.
   * @param data Nodes with world-space top-level transforms.
   * @returns Independent copy with root-space top-level transforms.
   */
  private static nodesLocalizeToModel(model: SolidModel, data: SerializedSolidModel): SerializedSolidModel {
    const copy = JSON.parse(JSON.stringify(data)) as SerializedSolidModel;
    model.root.updateWorldMatrix(true, false);
    const worldToRoot = model.root.matrixWorld.clone().invert();
    this.topLevelTransformsRead(copy).forEach((transform) =>
      solidSerializedTransformSpaceChange(transform, worldToRoot),
    );
    return copy;
  }

  /**
   * Returns the stored transforms of the top-level nodes of node data: group
   * nodes themselves and, for brush leaves, their serialized brushes.
   *
   * @param data Node data.
   * @returns Live references to the top-level transforms.
   */
  static topLevelTransformsRead(data: SerializedSolidModel): SolidSerializedTransform[] {
    const brushById = new Map(data.brushes.map((brush) => [brush.id, brush] as const));
    return this.nodesHierarchyRead(data)
      .map((node) => (node.kind === 'group' ? node : brushById.get(node.brushId)))
      .filter((transform): transform is SerializedSolidTreeGroupNode | SerializedSolidBrush => transform !== undefined);
  }

  /**
   * Returns the top-level tree nodes of node data, treating every brush as a
   * top-level node when no hierarchy is stored.
   *
   * @param data Node data.
   * @returns Top-level tree nodes.
   */
  private static nodesHierarchyRead(data: SerializedSolidModel): SerializedSolidTreeNode[] {
    return data.hierarchy ?? data.brushes.map((brush) => ({ kind: 'brush', brushId: brush.id }));
  }

  /**
   * Decodes brushes and registers them on a model with preview meshes, marking
   * nothing for rebuild yet.
   *
   * @param model Solid model receiving the brushes.
   * @param brushes Serialized brushes.
   * @returns Ids of the registered brushes.
   */
  private static brushesDecodeInto(model: SolidModel, brushes: readonly SerializedSolidBrush[]): string[] {
    const brushIds: string[] = [];
    for (const brushData of brushes) {
      const instance = this.decodeBrush(brushData);
      hierarchyNameAllocator.noteExistingName(instance.name);
      model.insertBrushInstance(instance, model.getBrushCount(), 2, undefined, false);
      brushIds.push(instance.id);
    }
    return brushIds;
  }

  /**
   * Puts the given children back in their saved order at the front of a
   * parent's child list; children not in the saved list follow in their current
   * order.
   *
   * @param parent Parent whose children are reordered.
   * @param savedOrder Children in the order to restore.
   */
  private static childrenOrderRestore(parent: THREE.Object3D, savedOrder: readonly THREE.Object3D[]): void {
    const saved = new Set(savedOrder);
    const restored = savedOrder.filter((child) => child.parent === parent);
    const added = parent.children.filter((child) => !saved.has(child));
    parent.children.splice(0, parent.children.length, ...restored, ...added);
  }

  /**
   * Encodes the solid root's hierarchical CSG tree (brushes + solid groups).
   *
   * @param solidRoot Solid model root group.
   * @returns Ordered top-level tree nodes.
   */
  private static encodeHierarchy(solidRoot: THREE.Object3D): SerializedSolidTreeNode[] {
    const nodes: SerializedSolidTreeNode[] = [];
    for (const child of solidRoot.children) {
      const node = this.encodeHierarchyChild(child);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /**
   * Encodes one scene child under the solid hierarchy.
   *
   * @param child Scene child.
   * @returns Tree node or null when not a CSG operand.
   */
  private static encodeHierarchyChild(child: THREE.Object3D): SerializedSolidTreeNode | null {
    if (isResultMesh(child)) return null;
    if (SolidBrushVisual.isBrushObject(child)) {
      const brushId = SolidBrushVisual.getBrushId(child);
      if (!brushId) return null;
      return { kind: 'brush', brushId };
    }
    if (child instanceof THREE.Group && (isSolidCsgGroup(child) || this.groupHasBrushDescendant(child))) {
      return this.encodeHierarchyGroup(child);
    }
    return null;
  }

  /**
   * Encodes a solid CSG group branch.
   *
   * @param group Solid CSG group.
   * @returns Group tree node or null when empty.
   */
  private static encodeHierarchyGroup(group: THREE.Group): SerializedSolidTreeGroupNode | null {
    const children: SerializedSolidTreeNode[] = [];
    for (const child of group.children) {
      const node = this.encodeHierarchyChild(child);
      if (node) children.push(node);
    }
    if (children.length === 0) return null;
    return {
      kind: 'group',
      id: group.uuid,
      name: group.name,
      operation: getSolidGroupOperation(group),
      position: this.encodeVector3(group.position),
      rotation: this.encodeEuler(group.rotation),
      scale: this.encodeVector3(group.scale),
      children,
      ...this.groupShapeRecipeEncode(group),
    };
  }

  /**
   * Reads a group's shape recipe for serialization.
   *
   * @param group Solid CSG group.
   * @returns Object with the recipe, or an empty object for plain groups.
   */
  private static groupShapeRecipeEncode(group: THREE.Group): { shape?: SolidGroupShapeRecipe } {
    const recipe = solidGroupShapeRecipeRead(group);
    return recipe ? { shape: recipe } : {};
  }

  /**
   * Returns whether a group has any solid brush descendant.
   *
   * @param group Scene group.
   * @returns True when a brush mesh is nested under the group.
   */
  private static groupHasBrushDescendant(group: THREE.Group): boolean {
    let found = false;
    group.traverse((object) => {
      if (found) return;
      if (SolidBrushVisual.isBrushObject(object)) found = true;
    });
    return found;
  }

  /**
   * Restores solid CSG group nesting under a model that already owns flat brush
   * instances with preview meshes.
   *
   * @param model Solid model with brushes attached.
   * @param hierarchy Serialized hierarchy roots.
   */
  private static applyHierarchy(model: SolidModel, hierarchy: SerializedSolidTreeNode[]): void {
    const brushMeshById = this.buildBrushMeshMap(model);
    for (const node of hierarchy) {
      this.attachHierarchyNode(model.root, node, brushMeshById);
    }
    model.syncBrushOrderFromScene();
    model.markDirty();
  }

  /**
   * Maps brush ids to their preview meshes for hierarchy restore.
   *
   * @param model Solid model.
   * @returns Brush id → mesh map.
   */
  private static buildBrushMeshMap(model: SolidModel): Map<string, THREE.Mesh> {
    const map = new Map<string, THREE.Mesh>();
    for (const brush of model.getBrushes()) {
      if (brush.mesh) map.set(brush.id, brush.mesh);
    }
    return map;
  }

  /**
   * Attaches one hierarchy node under a parent (reparents brushes / creates
   * groups).
   *
   * @param parent Solid root or solid CSG group.
   * @param node Serialized node.
   * @param brushMeshById Brush meshes by id.
   * @returns The attached brush mesh or created group, or null when the brush
   *   is missing.
   */
  private static attachHierarchyNode(
    parent: THREE.Object3D,
    node: SerializedSolidTreeNode,
    brushMeshById: Map<string, THREE.Mesh>,
  ): THREE.Object3D | null {
    if (node.kind === 'brush') {
      return this.attachBrushNode(parent, node.brushId, brushMeshById);
    }
    return this.attachGroupNode(parent, node, brushMeshById);
  }

  /**
   * Reparents a brush mesh under a hierarchy parent.
   *
   * @param parent Parent object.
   * @param brushId Brush id.
   * @param brushMeshById Brush meshes by id.
   * @returns The reparented mesh, or null when no mesh has the id.
   */
  private static attachBrushNode(
    parent: THREE.Object3D,
    brushId: string,
    brushMeshById: Map<string, THREE.Mesh>,
  ): THREE.Mesh | null {
    const mesh = brushMeshById.get(brushId);
    if (!mesh) return null;
    parent.add(mesh);
    return mesh;
  }

  /**
   * Creates a solid CSG group, restores transform, and attaches children.
   *
   * @param parent Parent object.
   * @param node Serialized group node.
   * @param brushMeshById Brush meshes by id.
   * @returns The created group.
   */
  private static attachGroupNode(
    parent: THREE.Object3D,
    node: SerializedSolidTreeGroupNode,
    brushMeshById: Map<string, THREE.Mesh>,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = node.name || 'Group';
    hierarchyNameAllocator.noteExistingName(group.name);
    markAsSolidCsgGroup(group, node.operation);
    group.position.set(node.position.x, node.position.y, node.position.z);
    group.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z, 'XYZ');
    group.scale.set(node.scale.x, node.scale.y, node.scale.z);
    if (node.shape) {
      solidGroupShapeRecipeWrite(group, node.shape);
    }
    parent.add(group);
    for (const child of node.children) {
      this.attachHierarchyNode(group, child, brushMeshById);
    }
    return group;
  }

  /**
   * Encodes one brush instance.
   *
   * @param instance Brush instance.
   * @returns Serialized brush.
   */
  private static encodeBrush(instance: SolidBrushInstance): SerializedSolidBrush {
    instance.pullTransformFromMesh();
    const defaultSurface = instance.serializeDefaultSurface();
    const defaultMapping = instance.serializeDefaultMapping();
    return {
      id: instance.id,
      name: instance.name,
      operation: instance.operation,
      position: this.encodeVector3(instance.position),
      rotation: this.encodeEuler(instance.rotation),
      scale: this.encodeVector3(instance.scale),
      visible: instance.visible,
      surfaceTextureId: defaultSurface.textureId,
      faceTextureIds: instance.serializeFaceTextureIds(),
      defaultSurface,
      faceSurfaces: instance.serializeFaceSurfaces(),
      defaultMapping,
      faceMappings: instance.serializeFaceMappings(),
      ...this.encodeBrushGeometry(instance.brush),
    };
  }

  /**
   * Encodes a Vector3 into a plain object.
   *
   * @param vector Source vector.
   * @returns Serializable xyz components.
   */
  private static encodeVector3(vector: THREE.Vector3): { x: number; y: number; z: number } {
    return { x: vector.x, y: vector.y, z: vector.z };
  }

  /**
   * Encodes an Euler into a plain object (order restored on decode).
   *
   * @param euler Source rotation.
   * @returns Serializable xyz components.
   */
  private static encodeEuler(euler: THREE.Euler): { x: number; y: number; z: number } {
    return { x: euler.x, y: euler.y, z: euler.z };
  }

  /**
   * Encodes brush wing-edge topology and vertices.
   *
   * @param brush Source brush geometry.
   * @returns Geometry fields for a serialized brush.
   */
  private static encodeBrushGeometry(
    brush: SolidBrush,
  ): Pick<SerializedSolidBrush, 'vertices' | 'wingEdges' | 'edgeFaceIndices' | 'faces'> {
    return {
      vertices: this.flattenVertices(brush.vertices),
      wingEdges: brush.wingEdges.map((edge) => ({
        vertexIndex: edge.vertexIndex,
        twinIndex: edge.twinIndex,
      })),
      edgeFaceIndices: brush.edgeFaceIndices.slice(),
      faces: brush.faces.map((face) => ({
        firstEdge: face.firstEdge,
        edgeCount: face.edgeCount,
        surfaceIndex: face.surfaceIndex,
      })),
    };
  }

  /**
   * Decodes one brush instance.
   *
   * @param data Serialized brush.
   * @returns Brush instance.
   */
  private static decodeBrush(data: SerializedSolidBrush): SolidBrushInstance {
    const brush = this.decodeBrushGeometry(data);
    const instance = new SolidBrushInstance(data.id, data.name, brush, data.operation ?? SolidOperation.Additive);
    instance.position.set(data.position.x, data.position.y, data.position.z);
    instance.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z, 'XYZ');
    instance.scale.set(data.scale.x, data.scale.y, data.scale.z);
    instance.visible = data.visible !== false;
    this.restoreBrushSurfaceData(instance, data);
    return instance;
  }

  /**
   * Restores default and per-face UV mappings, with legacy texture-id fallback.
   *
   * @param instance Target brush instance.
   * @param data Serialized brush data.
   */
  private static restoreBrushSurfaceData(instance: SolidBrushInstance, data: SerializedSolidBrush): void {
    if (data.defaultSurface || data.faceSurfaces) {
      instance.restoreFaceSurfaces(data.defaultSurface, data.faceSurfaces);
      return;
    }
    if (data.defaultMapping || data.faceMappings) {
      instance.restoreFaceMappings(
        this.normalizeMapping(data.defaultMapping, data.surfaceTextureId),
        this.normalizeFaceMappingList(data.faceMappings),
      );
      return;
    }
    instance.surfaceTextureId = data.surfaceTextureId || DEFAULT_CHECKER_TEXTURE_ID;
    instance.restoreFaceTextureIds(data.faceTextureIds);
  }

  /**
   * Normalizes a stored mapping or builds a default from a legacy texture id.
   *
   * @param mapping Optional stored mapping.
   * @param fallbackTextureId Legacy texture id fallback.
   * @returns Normalized mapping.
   */
  private static normalizeMapping(
    mapping: FaceTextureMapping | ReturnType<typeof serializeFaceTextureMapping> | undefined,
    fallbackTextureId?: string,
  ): FaceTextureMapping {
    if (mapping) {
      const copy = deserializeFaceTextureMapping(mapping as never);
      if (!copy.textureId) {
        copy.textureId = fallbackTextureId || DEFAULT_CHECKER_TEXTURE_ID;
      }
      return copy;
    }
    return createDefaultFaceTextureMapping(fallbackTextureId || DEFAULT_CHECKER_TEXTURE_ID);
  }

  /**
   * Normalizes a sparse face mapping list from JSON.
   *
   * @param faceMappings Optional sparse list.
   * @returns Cloned sparse list.
   */
  private static normalizeFaceMappingList(
    faceMappings: (FaceTextureMapping | undefined)[] | undefined,
  ): (FaceTextureMapping | undefined)[] {
    if (!faceMappings) return [];
    return faceMappings.map((mapping) => (mapping ? this.normalizeMapping(mapping) : undefined));
  }

  /**
   * Rebuilds wing-edge brush geometry from serialized arrays. Falls back to a
   * unit box when topology data is missing.
   *
   * @param data Serialized brush.
   * @returns Solid brush geometry.
   */
  private static decodeBrushGeometry(data: SerializedSolidBrush): SolidBrush {
    if (!data.vertices || data.vertices.length < 12 || !data.wingEdges?.length) {
      return SolidBrushFactory.createCenteredBox(2, 2, 2);
    }
    const brush = new SolidBrush();
    brush.vertices = this.inflateVertices(data.vertices);
    brush.wingEdges = data.wingEdges.map((edge) => createWingEdge(edge.vertexIndex, edge.twinIndex));
    brush.edgeFaceIndices = data.edgeFaceIndices?.slice() ?? [];
    brush.faces = (data.faces ?? []).map((face) => createSolidFace(face.firstEdge, face.edgeCount, face.surfaceIndex));
    if (brush.edgeFaceIndices.length !== brush.wingEdges.length) {
      brush.rebuildEdgeFaceIndices();
    }
    brush.recalculatePlanes();
    return brush;
  }

  /**
   * Flattens vertex vectors into a number array.
   *
   * @param vertices Vertex list.
   * @returns Flat xyz components.
   */
  private static flattenVertices(vertices: THREE.Vector3[]): number[] {
    const result: number[] = [];
    for (const vertex of vertices) {
      result.push(vertex.x, vertex.y, vertex.z);
    }
    return result;
  }

  /**
   * Inflates a flat xyz array into Vector3 vertices.
   *
   * @param values Flat components.
   * @returns Vertex list.
   */
  private static inflateVertices(values: number[]): THREE.Vector3[] {
    const vertices: THREE.Vector3[] = [];
    for (let index = 0; index + 2 < values.length; index += 3) {
      vertices.push(new THREE.Vector3(values[index], values[index + 1], values[index + 2]));
    }
    return vertices;
  }
}
