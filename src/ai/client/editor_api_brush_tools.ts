import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { resolveBrushMeshes } from './editor_api_lookup.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidBrushGeometryEditResult } from '@/solid/commands/brushes/command_solid_brushes_geometry_edit.js';
import { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { FlipAxis } from '@/transform/flip/flip_axis.js';

/** World axis names accepted by the brush tools. */
const EDITOR_API_BRUSH_TOOL_AXES: readonly FlipAxis[] = ['x', 'y', 'z'];

/** Hollow, convex merge, flip, shear and vertex snap tools over brush ids. */
export class EditorApiBrushTools {
  private lastStatusMessage = '';

  /**
   * Creates the brush editing tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a brush editing tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no brush editing tool.
   */
  brushToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'hollow_brushes':
        return this.brushesHollow(args);
      case 'convex_merge_brushes':
        return this.brushesConvexMerge(args);
      case 'flip_brushes':
        return this.brushesFlip(args);
      case 'shear_brushes':
        return this.brushesShear(args);
      case 'snap_brush_vertices':
        return this.brushVerticesSnap(args);
      default:
        return null;
    }
  }

  /**
   * Hollows the target brushes.
   *
   * @param args Tool arguments with brushIds and an optional thickness.
   * @returns Result with the wall brush ids.
   */
  private brushesHollow(args: Record<string, unknown>): McpToolResult {
    const thickness = typeof args['thickness'] === 'number' ? args['thickness'] : undefined;
    const walls = this.toolsCreate(args).hollow(thickness);
    if (!walls) {
      return failResult(this.lastStatusMessage);
    }
    const wallBrushIds = walls.flatMap((mesh) => this.meshBrushIdList(mesh));
    return okResult(this.lastStatusMessage, { wallBrushIds, count: wallBrushIds.length }, { createdIds: wallBrushIds });
  }

  /**
   * Merges the target brushes into one convex brush.
   *
   * @param args Tool arguments with brushIds.
   * @returns Result with the merged brush id.
   */
  private brushesConvexMerge(args: Record<string, unknown>): McpToolResult {
    const created = this.toolsCreate(args).convexMerge();
    if (!created) {
      return failResult(this.lastStatusMessage);
    }
    return okResult(this.lastStatusMessage, { brushId: created.id }, { createdIds: [created.id] });
  }

  /**
   * Mirrors the target brushes across one world axis.
   *
   * @param args Tool arguments with brushIds, axis and lockTextures.
   * @returns Result with the flipped brush ids and the mirror plane.
   */
  private brushesFlip(args: Record<string, unknown>): McpToolResult {
    const axis = this.axisRead(args, 'axis');
    if (!axis) {
      return failResult('axis must be x, y or z');
    }
    const result = this.toolsCreate(args).flipAxis(axis);
    if (!result) {
      return failResult(this.lastStatusMessage);
    }
    const brushIds = result.flipped.map((brush) => brush.id);
    return okResult(this.lastStatusMessage, { brushIds, axis: result.axis, center: result.center });
  }

  /**
   * Shears the target brushes.
   *
   * @param args Tool arguments with brushIds, axis, along, offset and
   *   lockTextures.
   * @returns Result with the edited and skipped brush ids.
   */
  private brushesShear(args: Record<string, unknown>): McpToolResult {
    const axis = this.axisRead(args, 'axis');
    const along = this.axisRead(args, 'along');
    const offset = args['offset'];
    if (!axis || !along || typeof offset !== 'number') {
      return failResult('axis and along must be x, y or z and offset a number');
    }
    return this.editResultBuild(this.toolsCreate(args).shear(axis, along, offset));
  }

  /**
   * Rounds the vertices of the target brushes.
   *
   * @param args Tool arguments with brushIds and step.
   * @returns Result with the edited and skipped brush ids.
   */
  private brushVerticesSnap(args: Record<string, unknown>): McpToolResult {
    const step = args['step'] === 'integer' ? 'integer' : 'grid';
    return this.editResultBuild(this.toolsCreate(args).snapVertices(step));
  }

  /**
   * Turns a geometry edit result into a tool result.
   *
   * @param result Edit result, or null when nothing could be edited.
   * @returns Tool result with edited and skipped brush ids.
   */
  private editResultBuild(result: SolidBrushGeometryEditResult | null): McpToolResult {
    if (!result || result.edited.length === 0) {
      return failResult(this.lastStatusMessage);
    }
    return okResult(this.lastStatusMessage, {
      brushIds: this.brushIdList(result.edited),
      skippedBrushIds: this.brushIdList(result.skipped),
    });
  }

  /**
   * Builds brush tools that act on the target brushes of a tool call.
   *
   * @param args Tool arguments with optional brushIds and lockTextures.
   * @returns Brush tools.
   */
  private toolsCreate(args: Record<string, unknown>): HandlerSolidBrushTools {
    const targets = this.targetMeshesRead(args);
    const lockTextures = args['lockTextures'] !== false;
    this.lastStatusMessage = '';
    return new HandlerSolidBrushTools({
      commandStack: this.host.commandStack,
      gridSnap: this.host.gridSnap,
      selectedObjectsRead: () => targets,
      selectedFacesRead: () => [],
      activeCameraRead: () => null,
      isTexturePositionLockEnabled: () => lockTextures,
      showStatusMessage: (message) => this.statusMessageRecord(message),
      selectionReplace: (meshes) => this.host.selectionManager.setSelection([...meshes]),
      afterWorldMutation: () => this.worldMutationRefresh(),
    });
  }

  /**
   * Resolves the brush meshes named by brushIds, or the selection without ids.
   *
   * @param args Tool arguments.
   * @returns Target meshes.
   */
  private targetMeshesRead(args: Record<string, unknown>): THREE.Mesh[] {
    const brushIds = args['brushIds'];
    if (!Array.isArray(brushIds)) {
      return this.host.selectionManager.getAllSelectedObjectsAsArray();
    }
    const ids = brushIds.filter((id): id is string => typeof id === 'string');
    return resolveBrushMeshes(this.host.worldObject, ids);
  }

  /**
   * Reads one world axis argument.
   *
   * @param args Tool arguments.
   * @param key Argument name.
   * @returns Axis, or null when the value is no axis.
   */
  private axisRead(args: Record<string, unknown>, key: string): FlipAxis | null {
    const value = args[key];
    return EDITOR_API_BRUSH_TOOL_AXES.find((axis) => axis === value) ?? null;
  }

  /**
   * Records a status message and shows it in the editor.
   *
   * @param message Status text.
   */
  private statusMessageRecord(message: string): void {
    this.lastStatusMessage = message;
    this.host.showStatus(message);
  }

  /** Refreshes the views and the outliner after a brush edit. */
  private worldMutationRefresh(): void {
    this.host.refreshAfterWorldMutation();
    this.host.refreshOutliner();
  }

  /**
   * Returns the brush id of a brush mesh as a list.
   *
   * @param mesh Brush preview mesh.
   * @returns One id, or none when the mesh is no brush.
   */
  private meshBrushIdList(mesh: THREE.Mesh): string[] {
    const brush = SolidModel.fromObject(mesh)?.findBrushByMesh(mesh);
    return brush ? [brush.id] : [];
  }

  /**
   * Lists the ids of brush instances.
   *
   * @param brushes Brush instances.
   * @returns Brush ids.
   */
  private brushIdList(brushes: readonly SolidBrushInstance[]): string[] {
    return brushes.map((brush) => brush.id);
  }
}
