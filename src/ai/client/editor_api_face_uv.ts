import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { findBrush } from './editor_api_lookup.js';
import { editorApiFaceUvOperationParse } from './editor_api_face_uv_operation_parse.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type {
  CommandTextureSolidFaceEdit,
  SolidFaceTextureTarget,
} from '@/texture/commands/command_texture_solid_face_edit.js';
import { CommandTextureSolidFaceAssign } from '@/texture/commands/command_texture_solid_face_assign.js';
import { CommandTextureSolidFaceUvOperation } from '@/texture/commands/command_texture_solid_face_uv_operation.js';
import { CommandTextureSolidFaceUvSet } from '@/texture/commands/command_texture_solid_face_uv_set.js';

/** Texture and UV state of one brush face in a get_face_uv reply. */
export interface EditorApiFaceUvRow {
  /** Face index on the brush. */
  faceIndex: number;
  /** Texture identity. */
  textureId: string;
  /** Brush-local outward normal. */
  normal: [number, number, number];
  /** U row: u = U·p + U.w for a brush-local point p. */
  u: [number, number, number, number];
  /** V row: v = V·p + V.w. */
  v: [number, number, number, number];
  /** Texture rotation in degrees around the face normal. */
  rotationDeg: number;
  /** Signed U scale in tiles per meter. */
  scaleU: number;
  /** Signed V scale in tiles per meter. */
  scaleV: number;
  /** U offset in tiles. */
  offsetU: number;
  /** V offset in tiles. */
  offsetV: number;
}

/** Brush faces resolved from brushId and faceIndices arguments. */
interface EditorApiFaceUvTargets {
  model: SolidModel;
  brush: SolidBrushInstance;
  faceIndices: number[];
}

/** Reads and edits the texture and UV mapping of authored brush faces. */
export class EditorApiFaceUv {
  /**
   * Creates the face UV tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a face UV tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no face UV tool.
   */
  faceUvToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_face_uv':
        return this.faceUvRead(args);
      case 'set_face_material':
        return this.faceMaterialSet(args);
      case 'set_face_uv':
        return this.faceUvSet(args);
      case 'transform_face_uv':
        return this.faceUvTransform(args);
      default:
        return null;
    }
  }

  /**
   * Reports the texture and UV mapping of brush faces.
   *
   * @param args Tool arguments with brushId and optional faceIndices.
   * @returns Result with one row per face.
   */
  private faceUvRead(args: Record<string, unknown>): McpToolResult {
    const targets = this.targetsResolve(args);
    if (typeof targets === 'string') {
      return failResult(targets);
    }
    const faces = targets.faceIndices.map((faceIndex) => faceUvRowBuild(targets.brush, faceIndex));
    return okResult(`Read ${faces.length} face(s)`, { brushId: targets.brush.id, faces });
  }

  /**
   * Paints brush faces with a texture, keeping their UV mapping.
   *
   * @param args Tool arguments with brushId, faceIndices and textureId.
   * @returns Result with the edited face count.
   */
  private faceMaterialSet(args: Record<string, unknown>): McpToolResult {
    const textureId = args['textureId'];
    if (typeof textureId !== 'string' || textureId.length === 0) {
      return failResult('textureId must be a non-empty string');
    }
    return this.commandRun(args, (faceTargets) => new CommandTextureSolidFaceAssign(faceTargets, textureId));
  }

  /**
   * Replaces the UV matrix of brush faces.
   *
   * @param args Tool arguments with brushId, faceIndices, u and v rows.
   * @returns Result with the edited face count.
   */
  private faceUvSet(args: Record<string, unknown>): McpToolResult {
    const u = uvRowRead(args['u']);
    const v = uvRowRead(args['v']);
    if (!u || !v) {
      return failResult('u and v must be arrays of four numbers');
    }
    const uv = new SurfaceUvMatrix(u, v);
    return this.commandRun(args, (faceTargets) => new CommandTextureSolidFaceUvSet(faceTargets, uv));
  }

  /**
   * Applies a face UV operation (fit, justify, rotate, ...) to brush faces.
   *
   * @param args Tool arguments with brushId, faceIndices, operation and its
   *   parameters.
   * @returns Result with the edited face count.
   */
  private faceUvTransform(args: Record<string, unknown>): McpToolResult {
    const operation = editorApiFaceUvOperationParse(args);
    if (typeof operation === 'string') {
      return failResult(operation);
    }
    return this.commandRun(args, (faceTargets) => new CommandTextureSolidFaceUvOperation(faceTargets, operation));
  }

  /**
   * Resolves the target faces, pushes one face edit command and reports it.
   *
   * @param args Tool arguments with brushId and optional faceIndices.
   * @param commandCreate Builds the command for the resolved faces.
   * @returns Result with the brush id and edited face count.
   */
  private commandRun(
    args: Record<string, unknown>,
    commandCreate: (faceTargets: SolidFaceTextureTarget[]) => CommandTextureSolidFaceEdit,
  ): McpToolResult {
    const targets = this.targetsResolve(args);
    if (typeof targets === 'string') {
      return failResult(targets);
    }
    const faceTargets = targets.faceIndices.map((surfaceIndex) => ({
      model: targets.model,
      brushId: targets.brush.id,
      surfaceIndex,
    }));
    const command = commandCreate(faceTargets);
    this.host.commandStack.push(command);
    this.host.refreshAfterWorldMutation();
    const editedFaceCount = command.getEditedFaceCount();
    return okResult(`Edited ${editedFaceCount} face(s)`, { brushId: targets.brush.id, editedFaceCount });
  }

  /**
   * Resolves the brush and face indices of a tool call.
   *
   * @param args Tool arguments with brushId and optional faceIndices.
   * @returns Targets, or a message explaining the bad argument.
   */
  private targetsResolve(args: Record<string, unknown>): EditorApiFaceUvTargets | string {
    const brushId = args['brushId'];
    const found = typeof brushId === 'string' ? findBrush(this.host.worldObject, brushId) : null;
    if (!found) {
      return `Brush not found: ${String(brushId)}`;
    }
    const faceCount = found.brush.brush.faces.length;
    const faceIndices = faceIndicesRead(args['faceIndices'], faceCount);
    if (typeof faceIndices === 'string') {
      return faceIndices;
    }
    return { model: found.model, brush: found.brush, faceIndices };
  }
}

/**
 * Reads the face indices argument, all faces when it is omitted.
 *
 * @param value Raw faceIndices argument.
 * @param faceCount Face count of the brush.
 * @returns Face indices, or a message naming the valid range.
 */
function faceIndicesRead(value: unknown, faceCount: number): number[] | string {
  if (value === undefined) {
    return Array.from({ length: faceCount }, (_unused, index) => index);
  }
  const indices = Array.isArray(value) ? value : [value];
  const valid = indices.every((index) => Number.isInteger(index) && index >= 0 && index < faceCount);
  return valid ? (indices as number[]) : `faceIndices must be integers from 0 to ${faceCount - 1}`;
}

/**
 * Reads one UV row of four numbers.
 *
 * @param value Raw row argument.
 * @returns Row vector, or null when the value is no four-number array.
 */
function uvRowRead(value: unknown): THREE.Vector4 | null {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }
  const numbers = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  return numbers.length === 4 ? new THREE.Vector4().fromArray(numbers) : null;
}

/**
 * Builds the reply row of one brush face.
 *
 * @param brush Brush owning the face.
 * @param faceIndex Face index.
 * @returns Texture and UV state of the face.
 */
function faceUvRowBuild(brush: SolidBrushInstance, faceIndex: number): EditorApiFaceUvRow {
  const surface = brush.getFaceSurface(faceIndex);
  const normal = brush.faceNormalLocal(faceIndex);
  const trs = surface.uv.decompose(normal);
  return {
    faceIndex,
    textureId: surface.textureId,
    normal: [normal.x, normal.y, normal.z],
    u: [surface.uv.u.x, surface.uv.u.y, surface.uv.u.z, surface.uv.u.w],
    v: [surface.uv.v.x, surface.uv.v.y, surface.uv.v.z, surface.uv.v.w],
    rotationDeg: trs.rotationDeg,
    scaleU: trs.scaleU,
    scaleV: trs.scaleV,
    offsetU: trs.translation.x,
    offsetV: trs.translation.y,
  };
}
