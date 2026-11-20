import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import {
  ProjectBuildDiagnosticsParser,
  type ProjectBuildDiagnostic,
} from '@/project/build/project_build_diagnostics_parser.js';
import { gameNoticeObjectFind, gameNoticeObjectReferenceParse } from '@/project/issues/game_notice_object_reference.js';
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
  collect(worldGroup: THREE.Object3D): Issue[] {
    const content = ProjectIssueBoard.read();
    const problemIssues = content.problems.map((problem) =>
      this.projectIssueCreate(problem.severity, problem.message, null),
    );
    const buildIssues = content.diagnostics.map((diagnostic) => this.diagnosticIssueCreate(diagnostic, worldGroup));
    return [...problemIssues, ...buildIssues];
  }

  /**
   * Creates the issue of one build or game message, pointing at the scene
   * object when the message is a game warning about one.
   *
   * @param diagnostic Build or game message.
   * @param worldGroup World root searched for the object the message names.
   * @returns The issue.
   */
  private diagnosticIssueCreate(diagnostic: ProjectBuildDiagnostic, worldGroup: THREE.Object3D): Issue {
    const reference = gameNoticeObjectReferenceParse(diagnostic.message);
    const object = reference === null ? null : gameNoticeObjectFind(reference, worldGroup);
    return this.projectIssueCreate(diagnostic.severity, ProjectBuildDiagnosticsParser.describe(diagnostic), object);
  }

  /**
   * Creates an issue that belongs to the project, or to a scene object when one
   * is given.
   *
   * @param severity Importance.
   * @param description Explanation.
   * @param object Scene object the issue is about, or null for the project.
   * @returns The issue.
   */
  private projectIssueCreate(severity: 'error' | 'warning', description: string, object: THREE.Object3D | null): Issue {
    return this.issueCreate({
      severity,
      objectUuid: object?.uuid ?? null,
      objectName: object?.name ?? ISSUE_PROVIDER_PROJECT_BUILD_OBJECT_NAME,
      description,
    });
  }
}
