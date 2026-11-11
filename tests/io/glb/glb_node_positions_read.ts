import * as THREE from 'three';

/** Size of the GLB file header in bytes. */
const GLB_HEADER_BYTES = 12;

/** Size of one GLB chunk header in bytes. */
const GLB_CHUNK_HEADER_BYTES = 8;

/** Bytes of one float32 XYZ position. */
const GLB_POSITION_BYTES = 12;

/** One node of the glTF JSON, with the fields needed to place its mesh. */
interface GlbPositionNode {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

/** Parts of the glTF JSON needed to read node positions. */
interface GlbPositionJson {
  nodes?: GlbPositionNode[];
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number; count: number }>;
  bufferViews?: Array<{ byteOffset?: number; byteStride?: number }>;
}

/** Vertex positions of one mesh node of a GLB file. */
export interface GlbMeshNodePositions {
  name: string;
  positions: THREE.Vector3[];
}

/**
 * Reads the vertex positions of the first primitive of the first node of a
 * binary glTF file with a given name, placed by the node's own transform.
 *
 * @param buffer GLB bytes.
 * @param nodeName Name of the mesh node.
 * @returns Positions in the node's parent space.
 */
export function glbNodePositionsRead(buffer: ArrayBuffer, nodeName: string): THREE.Vector3[] {
  const json = glbPositionJsonRead(buffer);
  const node = json.nodes?.find((candidate) => candidate.name === nodeName);
  if (!node) {
    throw new Error(`GLB has no mesh positions for node ${nodeName}`);
  }
  return glbPrimitivePositionsRead(buffer, json, node, glbNodeMatrixRead(node));
}

/**
 * Reads the vertex positions of the first primitive of every mesh node of a
 * binary glTF file, placed in scene space by the transforms of the node and of
 * all its ancestors, so nodes sharing a name stay apart.
 *
 * @param buffer GLB bytes.
 * @returns One entry per mesh node, in file order.
 */
export function glbMeshNodesScenePositionsRead(buffer: ArrayBuffer): GlbMeshNodePositions[] {
  const json = glbPositionJsonRead(buffer);
  const nodes = json.nodes ?? [];
  const parentByIndex = glbNodeParentsRead(nodes);
  return nodes.flatMap((node, index) => {
    if (node.mesh === undefined) return [];
    const sceneMatrix = glbNodeSceneMatrixRead(nodes, parentByIndex, index);
    return [{ name: node.name ?? '', positions: glbPrimitivePositionsRead(buffer, json, node, sceneMatrix) }];
  });
}

/**
 * Reads the positions of the first primitive of a mesh node.
 *
 * @param buffer GLB bytes.
 * @param json Parsed glTF JSON of the same file.
 * @param node Mesh node.
 * @param placement Matrix applied to every position.
 * @returns Placed positions.
 */
function glbPrimitivePositionsRead(
  buffer: ArrayBuffer,
  json: GlbPositionJson,
  node: GlbPositionNode,
  placement: THREE.Matrix4,
): THREE.Vector3[] {
  const accessorIndex = json.meshes?.[node.mesh ?? -1]?.primitives[0]?.attributes['POSITION'];
  const accessor = json.accessors?.[accessorIndex ?? -1];
  const view = json.bufferViews?.[accessor?.bufferView ?? -1];
  if (!accessor || !view) {
    throw new Error(`GLB has no mesh positions for node ${node.name ?? ''}`);
  }
  const data = new DataView(buffer, glbBinaryChunkOffsetRead(buffer));
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? GLB_POSITION_BYTES;
  return Array.from({ length: accessor.count }, (_unused, index) =>
    glbPositionAtRead(data, start + index * stride).applyMatrix4(placement),
  );
}

/**
 * Maps every child node index to the index of its parent node.
 *
 * @param nodes GlTF nodes.
 * @returns Parent index per child index.
 */
function glbNodeParentsRead(nodes: readonly GlbPositionNode[]): Map<number, number> {
  const parentByIndex = new Map<number, number>();
  nodes.forEach((node, index) => node.children?.forEach((child) => parentByIndex.set(child, index)));
  return parentByIndex;
}

/**
 * Builds the matrix that places a node in scene space: its local matrix after
 * the local matrices of all its ancestors.
 *
 * @param nodes GlTF nodes.
 * @param parentByIndex Parent index per child index.
 * @param nodeIndex Index of the node.
 * @returns Scene-space matrix of the node.
 */
function glbNodeSceneMatrixRead(
  nodes: readonly GlbPositionNode[],
  parentByIndex: ReadonlyMap<number, number>,
  nodeIndex: number,
): THREE.Matrix4 {
  const sceneMatrix = new THREE.Matrix4();
  for (let index: number | undefined = nodeIndex; index !== undefined; index = parentByIndex.get(index)) {
    const node = nodes[index];
    if (node) sceneMatrix.premultiply(glbNodeMatrixRead(node));
  }
  return sceneMatrix;
}

/**
 * Counts the distinct positions of one list that sit on a position of another
 * list, so vertices repeated by unindexed triangles count once.
 *
 * @param first Positions to count.
 * @param second Positions to compare against.
 * @param tolerance Largest distance at which two positions are the same point.
 * @returns Number of distinct coincident points.
 */
export function glbPositionsCoincidentCountRead(
  first: readonly THREE.Vector3[],
  second: readonly THREE.Vector3[],
  tolerance: number,
): number {
  const coincident: THREE.Vector3[] = [];
  first.forEach((position) => {
    const onSecond = second.some((other) => other.distanceTo(position) < tolerance);
    if (onSecond && !coincident.some((known) => known.distanceTo(position) < tolerance)) {
      coincident.push(position);
    }
  });
  return coincident.length;
}

/**
 * Lists the names of the nodes of a binary glTF file, and whether each holds a
 * mesh.
 *
 * @param buffer GLB bytes.
 * @returns One entry per node, in file order; unnamed nodes have an empty name.
 */
export function glbNodeNamesRead(buffer: ArrayBuffer): Array<{ name: string; hasMesh: boolean }> {
  return (glbPositionJsonRead(buffer).nodes ?? []).map((node) => ({
    name: node.name ?? '',
    hasMesh: node.mesh !== undefined,
  }));
}

/**
 * Parses the JSON chunk of a binary glTF file.
 *
 * @param buffer GLB bytes.
 * @returns Parsed glTF JSON.
 */
function glbPositionJsonRead(buffer: ArrayBuffer): GlbPositionJson {
  const jsonLength = new DataView(buffer).getUint32(GLB_HEADER_BYTES, true);
  const jsonBytes = new Uint8Array(buffer, GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES, jsonLength);
  return JSON.parse(new TextDecoder().decode(jsonBytes)) as GlbPositionJson;
}

/**
 * Returns where the data of the binary chunk of a GLB file starts.
 *
 * @param buffer GLB bytes.
 * @returns Byte offset of the binary chunk data.
 */
function glbBinaryChunkOffsetRead(buffer: ArrayBuffer): number {
  const jsonLength = new DataView(buffer).getUint32(GLB_HEADER_BYTES, true);
  return GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + jsonLength + GLB_CHUNK_HEADER_BYTES;
}

/**
 * Reads one little-endian float32 XYZ position.
 *
 * @param data View over the binary chunk.
 * @param byteOffset Offset of the position inside the chunk.
 * @returns Position.
 */
function glbPositionAtRead(data: DataView, byteOffset: number): THREE.Vector3 {
  return new THREE.Vector3(
    data.getFloat32(byteOffset, true),
    data.getFloat32(byteOffset + 4, true),
    data.getFloat32(byteOffset + 8, true),
  );
}

/**
 * Builds the local matrix of a glTF node from its matrix or its translation,
 * rotation and scale.
 *
 * @param node GlTF node.
 * @returns Local node matrix.
 */
function glbNodeMatrixRead(node: GlbPositionNode): THREE.Matrix4 {
  if (node.matrix) {
    return new THREE.Matrix4().fromArray(node.matrix);
  }
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
}
