import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { gridConformancePointFormat } from '@/grid_conformance/grid_conformance_point_check.js';
import { GridConformanceScanner } from '@/grid_conformance/grid_conformance_scanner.js';
import type {
  GridConformanceMeshObject,
  GridConformanceViolation,
} from '@/grid_conformance/grid_conformance_violation.js';
import type { EditorApiHost } from './editor_api_host.js';

/** Most off-grid objects named in one rejection message. */
const EDITOR_API_GRID_GUARD_LISTED_VIOLATIONS = 5;

/** World state recorded before a tool runs. */
interface EditorApiGridGuardSnapshot {
  /** Commands recorded on the undo stack so far. */
  readonly recordedCommandCount: number;
  /** Keys of objects already off the grid. */
  readonly offGridKeys: ReadonlySet<string>;
  /** Uuids of editable meshes that already exist. */
  readonly meshUuids: ReadonlySet<string>;
}

/**
 * Enforces the AI grid rule around every tool call: a call that leaves new
 * geometry off the minimum grid is undone and fails, and a call that creates
 * editable meshes gets a warning to use brushes.
 */
export class EditorApiGridGuard {
  private readonly scanner = new GridConformanceScanner();
  private readonly host: EditorApiHost;

  /**
   * Creates a guard over the live editor.
   *
   * @param host Editor API host.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs one tool call under the grid rule.
   *
   * @param toolRun Runs the tool and returns its result.
   * @returns The tool result, or a failure when the call broke the grid rule.
   */
  guard(toolRun: () => McpToolResult): McpToolResult {
    const before = this.snapshotTake();
    return this.resultCheck(before, toolRun());
  }

  /**
   * Runs one waiting tool call under the grid rule.
   *
   * @param toolRun Runs the tool and resolves to its result.
   * @returns The tool result, or a failure when the call broke the grid rule.
   */
  async guardAsync(toolRun: () => Promise<McpToolResult>): Promise<McpToolResult> {
    const before = this.snapshotTake();
    return this.resultCheck(before, await toolRun());
  }

  /**
   * Records the off-grid objects, meshes and undo depth before a call.
   *
   * @returns Snapshot of the world state.
   */
  private snapshotTake(): EditorApiGridGuardSnapshot {
    const world = this.host.worldObject;
    return {
      recordedCommandCount: this.recordedCommandCountRead(),
      offGridKeys: new Set(this.scanner.violationsCollect(world).map((violation) => violation.key)),
      meshUuids: new Set(this.scanner.meshObjectsList(world).map((mesh) => mesh.objectUuid)),
    };
  }

  /**
   * Checks what a successful call recorded against the snapshot.
   *
   * @param before Snapshot taken before the call.
   * @param result Result of the call.
   * @returns The result, a failure for new off-grid geometry, or the result
   *   with a mesh warning.
   */
  private resultCheck(before: EditorApiGridGuardSnapshot, result: McpToolResult): McpToolResult {
    const recordedCommands = this.recordedCommandCountRead() - before.recordedCommandCount;
    if (!result.ok || recordedCommands <= 0) {
      return result;
    }
    const world = this.host.worldObject;
    const newViolations = this.scanner
      .violationsCollect(world)
      .filter((violation) => !before.offGridKeys.has(violation.key));
    if (newViolations.length > 0) {
      return this.callReject(recordedCommands, newViolations);
    }
    const newMeshes = this.scanner.meshObjectsList(world).filter((mesh) => !before.meshUuids.has(mesh.objectUuid));
    return newMeshes.length > 0 ? this.meshWarningAppend(result, newMeshes) : result;
  }

  /**
   * Undoes the commands of a call that broke the grid rule.
   *
   * @param recordedCommands Commands the call recorded.
   * @param violations Objects the call left off the grid.
   * @returns Failure explaining the rule.
   */
  private callReject(recordedCommands: number, violations: GridConformanceViolation[]): McpToolResult {
    for (let undone = 0; undone < recordedCommands; undone += 1) {
      this.host.commandStack.undo();
    }
    this.host.refreshAfterWorldMutation();
    return { ok: false, message: this.rejectMessageBuild(violations) };
  }

  /**
   * Builds the message of a rejected call.
   *
   * @param violations Objects the call left off the grid.
   * @returns Message naming the rule and the first offending corners.
   */
  private rejectMessageBuild(violations: GridConformanceViolation[]): string {
    const listed = violations
      .slice(0, EDITOR_API_GRID_GUARD_LISTED_VIOLATIONS)
      .map(
        (violation) =>
          `${violation.kind} "${violation.objectName}" bounds corner ${gridConformancePointFormat(violation.offGridPoint)}`,
      );
    return (
      `Rejected and undone: every brush and mesh must start and end on the ${GRID_INTERVAL_MINIMUM} grid. ` +
      `Off-grid: ${listed.join('; ')}. Use grid-aligned positions and sizes, 90 degree turns, ` +
      'and slopes from the ramp shape or clips between grid points.'
    );
  }

  /**
   * Adds the prefer-brushes warning for meshes a call created.
   *
   * @param result Successful result.
   * @param meshes Editable meshes the call created.
   * @returns Result with the warning appended.
   */
  private meshWarningAppend(result: McpToolResult, meshes: GridConformanceMeshObject[]): McpToolResult {
    const names = meshes.map((mesh) => `"${mesh.objectName}"`).join(', ');
    const warning = `Created mesh objects ${names}; build level geometry from brushes instead of meshes.`;
    return { ...result, warnings: [...(result.warnings ?? []), warning] };
  }

  /**
   * Counts every command recorded on the undo stack, including trimmed ones.
   *
   * @returns Recorded command count.
   */
  private recordedCommandCountRead(): number {
    const stack = this.host.commandStack;
    return stack.undoTrimmedTotalRead() + stack.undoAvailableCount();
  }
}
