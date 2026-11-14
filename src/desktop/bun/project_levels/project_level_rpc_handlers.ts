import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { ProjectLevelLister } from '@/desktop/bun/project_levels/project_level_lister.js';
import { ProjectLevelReader } from '@/desktop/bun/project_levels/project_level_reader.js';
import { ProjectLevelWriter } from '@/desktop/bun/project_levels/project_level_writer.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import type {
  ProjectLevelCreateRequest,
  ProjectLevelListResult,
  ProjectLevelReadResult,
  ProjectLevelRenameRequest,
  ProjectLevelWriteRequest,
  ProjectLevelWriteResult,
} from '@/project/level/project_level_types.js';

/** Message returned while no project is open. */
const PROJECT_LEVEL_NO_PROJECT_MESSAGE = 'Open a game project before working with its levels.';

/**
 * Desktop requests that list, read and write the level documents of the open
 * project.
 */
export interface ProjectLevelRpcHandlers {
  projectLevelList: () => ProjectLevelListResult;
  projectLevelRead: (params: { document: string }) => ProjectLevelReadResult;
  projectLevelWrite: (params: ProjectLevelWriteRequest) => ProjectLevelWriteResult;
  projectLevelCreate: (params: ProjectLevelCreateRequest) => ProjectLevelWriteResult;
  projectLevelRename: (params: ProjectLevelRenameRequest) => ProjectLevelWriteResult;
}

/** Collaborators of the level request handlers. */
export interface ProjectLevelRpcHandlerParts {
  /** Reads one document. */
  reader: ProjectLevelReader;
  /** Writes, creates and renames documents. */
  writer: ProjectLevelWriter;
}

/**
 * Creates the request handlers that serve the open project's level documents.
 *
 * @param host Host that knows the open project.
 * @param parts Reader and writer used by the handlers.
 * @returns Request handlers keyed by request name.
 */
export function projectLevelRpcHandlersCreate(
  host: GameProcessHost,
  parts: ProjectLevelRpcHandlerParts = { reader: new ProjectLevelReader(), writer: new ProjectLevelWriter() },
): ProjectLevelRpcHandlers {
  return {
    projectLevelList: () => projectLevelWithDefinition(host, (definition) => projectLevelListBuild(definition)),
    projectLevelRead: ({ document }) =>
      projectLevelWithDefinition(host, (definition) => parts.reader.read(definition, document)),
    projectLevelWrite: (request) =>
      projectLevelWithDefinition(host, (definition) => parts.writer.write(definition, request)),
    projectLevelCreate: (request) =>
      projectLevelWithDefinition(host, (definition) => parts.writer.create(definition, request)),
    projectLevelRename: (request) =>
      projectLevelWithDefinition(host, (definition) => parts.writer.rename(definition, request)),
  };
}

/**
 * Runs a request against the open project, answering with a failure while no
 * project is open or the request throws.
 *
 * @param host Host that knows the open project.
 * @param run Request body given the open project.
 * @returns The request's result, or a failure.
 */
function projectLevelWithDefinition<Result extends { ok: boolean }>(
  host: GameProcessHost,
  run: (definition: ProjectDefinition) => Result,
): Result | { ok: false; message: string } {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_LEVEL_NO_PROJECT_MESSAGE };
  }
  try {
    return run(definition);
  } catch (error) {
    return { ok: false, message: `Project levels: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Lists the levels of the open project.
 *
 * @param definition Open project.
 * @returns The levels with the project file and document directory.
 */
function projectLevelListBuild(definition: ProjectDefinition): ProjectLevelListResult {
  return {
    ok: true,
    projectFile: definition.projectFile,
    documentDirectory: definition.documentDirectory,
    levels: ProjectLevelLister.list(definition),
  };
}
