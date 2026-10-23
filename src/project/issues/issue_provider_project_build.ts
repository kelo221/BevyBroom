import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { ProjectBuildDiagnosticsParser } from '@/project/build/project_build_diagnostics_parser.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';

/** Identifier of the game project check. */
export const ISSUE_PROVIDER_PROJECT_BUILD_ID = 'project_build';

/** Object name shown for issues that belong to the game project. */
export const ISSUE_PROVIDER_PROJECT_BUILD_OBJECT_NAME = 'Game project';

/**
 * Reports the open project's problems and the compiler messages of its newest
 * build.
 */
export class IssueProviderProjectBuild extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_PROJECT_BUILD_ID, 'Game project and build');
  }

  /** @inheritdoc */
  collect(): Issue[] {
    const content = ProjectIssueBoard.read();
    const problemIssues = content.problems.map((problem) => this.projectIssueCreate(problem.severity, problem.message));
    const buildIssues = content.diagnostics.map((diagnostic) =>
      this.projectIssueCreate(diagnostic.severity, ProjectBuildDiagnosticsParser.describe(diagnostic)),
    );
    return [...problemIssues, ...buildIssues];
  }

  /**
   * Creates an issue that belongs to the project rather than a scene object.
   *
   * @param severity Importance.
   * @param description Explanation.
   * @returns The issue.
   */
  private projectIssueCreate(severity: 'error' | 'warning', description: string): Issue {
    return this.issueCreate({
      severity,
      objectUuid: null,
      objectName: ISSUE_PROVIDER_PROJECT_BUILD_OBJECT_NAME,
      description,
    });
  }
}
