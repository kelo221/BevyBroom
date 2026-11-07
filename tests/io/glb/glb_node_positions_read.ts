import * as THREE from 'three';

/** Size of the GLB file header in bytes. */
const GLB_HEADER_BYTES = 12;

/** Size of one GLB chunk header in bytes. */
const GLB_CHUNK_HEADER_BYTES = 8;

/** Bytes of one float32 XYZ position. */
const GLB_POSITION_BYTES = 12;

/** Parts of the glTF JSON needed to read node positions. */
interface GlbPositionJson {
  nodes?: Array<{
    name?: string;
    mesh?: number;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number; count: number }>;
  bufferViews?: Array<{ byteOffset?: number; byteStride?: number }>;
}

/**
 * Reads the vertex positions of the first primitive of a named mesh node of a
 * binary glTF file, placed by the node's own transform.
 *
 * @param buffer GLB bytes.
 * @param nodeName Name of the mesh node.
 * @returns Positions in the node's parent space.
 */
export function glbNodePositionsRead(buffer: ArrayBuffer, nodeName: string): THREE.Vector3[] {
  const json = glbPositionJsonRead(buffer);
  const node = json.nodes?.find((candidate) => candidate.name === nodeName);
  const accessorIndex = json.meshes?.[node?.mesh ?? -1]?.primitives[0]?.attributes['POSITION'];
  const accessor = json.accessors?.[accessorIndex ?? -1];
  const view = json.bufferViews?.[accessor?.bufferView ?? -1];
  if (!node || !accessor || !view) {
    throw new Error(`GLB has no mesh positions for node ${nodeName}`);
  }
  const nodeMatrix = glbNodeMatrixRead(node);
  const data = new DataView(buffer, glbBinaryChunkOffsetRead(buffer));
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? GLB_POSITION_BYTES;
  return Array.from({ length: accessor.count }, (_unused, index) =>
    glbPositionAtRead(data, start + index * stride).applyMatrix4(nodeMatrix),
  );
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
function glbNodeMatrixRead(node: NonNullable<GlbPositionJson['nodes']>[number]): THREE.Matrix4 {
  if (node.matrix) {
    return new THREE.Matrix4().fromArray(node.matrix);
  }
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
}
