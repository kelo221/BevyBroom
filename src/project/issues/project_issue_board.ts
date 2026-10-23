import type { ProjectBuildDiagnostic } from '@/project/build/project_build_diagnostics_parser.js';
import type { ProjectProblem } from '@/project/model/project_definition.js';

/** What the open project currently reports as problems. */
export interface ProjectIssueBoardContent {
  /** Compiler messages of the newest game build. */
  diagnostics: readonly ProjectBuildDiagnostic[];
  /** Problems of the open project definition. */
  problems: readonly ProjectProblem[];
}

/**
 * Holds the newest build messages and project problems so the Issues list can
 * show them, and tells listeners when they change.
 */
export class ProjectIssueBoard {
  private static content: ProjectIssueBoardContent = { diagnostics: [], problems: [] };
  private static readonly listeners = new Set<() => void>();

  /**
   * Replaces the board content; listeners run only when something changed.
   *
   * @param content New build messages and project problems.
   */
  static publish(content: ProjectIssueBoardContent): void {
    if (JSON.stringify(content) === JSON.stringify(ProjectIssueBoard.content)) {
      return;
    }
    ProjectIssueBoard.content = { diagnostics: [...content.diagnostics], problems: [...content.problems] };
    ProjectIssueBoard.listeners.forEach((listener) => listener());
  }

  /**
   * Returns the current board content.
   *
   * @returns Build messages and project problems.
   */
  static read(): ProjectIssueBoardContent {
    return ProjectIssueBoard.content;
  }

  /**
   * Registers a callback run whenever the content changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  static changeListenerAdd(listener: () => void): () => void {
    ProjectIssueBoard.listeners.add(listener);
    return () => ProjectIssueBoard.listeners.delete(listener);
  }
}
