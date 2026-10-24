import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { selectionQueriesList } from '@/selection/query/selection_query_registry.js';
import { selectionQueryRun } from '@/selection/query/selection_query_run.js';

/** Runs the selection queries (inverse, siblings, touching, ...) for automation. */
export class EditorApiSelectionQuery {
  /**
   * Creates the selection query tool.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs the selection query tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no selection query tool.
   */
  selectionQueryToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'select_by_query' ? this.selectionQueryApply(args) : null;
  }

  /**
   * Replaces the selection with the result of the named query.
   *
   * @param args Tool arguments with query.
   * @returns Result with the selected brush ids and object uuids.
   */
  private selectionQueryApply(args: Record<string, unknown>): McpToolResult {
    const query = selectionQueriesList().find((entry) => entry.id === args['query']);
    if (!query) {
      return failResult(
        `query must be one of ${selectionQueriesList()
          .map((entry) => entry.id)
          .join(', ')}`,
      );
    }
    const count = selectionQueryRun(query, this.host.selectionManager, this.host.worldObject);
    const selected = this.host.selectionManager.getAllSelectedObjectsAsArray();
    return okResult(`Selected ${count} object(s)`, {
      count,
      brushIds: selected.flatMap((mesh) => this.meshBrushIdList(mesh)),
      objectIds: selected.map((mesh) => mesh.uuid),
    });
  }

  /**
   * Returns the brush id of a brush mesh as a list.
   *
   * @param mesh Selected mesh.
   * @returns One id, or none when the mesh is no brush.
   */
  private meshBrushIdList(mesh: THREE.Mesh): string[] {
    const brush = SolidModel.fromObject(mesh)?.findBrushByMesh(mesh);
    return brush ? [brush.id] : [];
  }
}
