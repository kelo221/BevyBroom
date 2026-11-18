/**
 * Work that runs around a component drag: it sees the dragged targets when the
 * drag starts and may tidy their topology when it commits.
 */
export interface ComponentTransformCommitCleanup {
  /**
   * Called when a component drag starts.
   *
   * @param targetIds Ids of the meshes and brushes being dragged.
   */
  dragBegin(targetIds: readonly string[]): void;

  /**
   * Called when a component drag commits, after the final positions are
   * written.
   *
   * @param targetIds Ids of the meshes and brushes that were dragged.
   * @returns True when the cleanup changed topology and recorded the undo step
   *   for the whole drag itself.
   */
  dragCommit(targetIds: readonly string[]): boolean;
}
