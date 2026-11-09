import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { ProjectSprinkleDefinitionOpener } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_opener.js';
import { ProjectSprinkleDefinitionReader } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_reader.js';
import type {
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Message returned while no project is open. */
const PROJECT_SPRINKLE_NO_PROJECT_MESSAGE = 'Open a game project before reading its sprinkle definitions.';

/**
 * Desktop requests that read and open the sprinkle definition files of the open
 * project.
 */
export interface ProjectSprinkleRpcHandlers {
  projectSprinkleDefinitionFilesRead: () => SprinkleDefinitionFilesReadResult;
  projectSprinkleDefinitionOpen: (params: { path: string }) => Promise<SprinkleDefinitionOpenResult>;
}

/** Collaborators of the sprinkle request handlers. */
export interface ProjectSprinkleRpcHandlerParts {
  /** Reads every definition file. */
  reader: ProjectSprinkleDefinitionReader;
  /** Opens one definition file in the system's text editor. */
  opener: ProjectSprinkleDefinitionOpener;
}

/**
 * Creates the request handlers that serve the open project's sprinkle
 * directories.
 *
 * @param host Host that knows the open project.
 * @param parts Reader and opener used by the handlers.
 * @returns Request handlers keyed by request name.
 */
export function projectSprinkleRpcHandlersCreate(
  host: GameProcessHost,
  parts: ProjectSprinkleRpcHandlerParts = {
    reader: new ProjectSprinkleDefinitionReader(),
    opener: new ProjectSprinkleDefinitionOpener(),
  },
): ProjectSprinkleRpcHandlers {
  return {
    projectSprinkleDefinitionFilesRead: () => projectSprinkleDefinitionFilesReadFromHost(host, parts.reader),
    projectSprinkleDefinitionOpen: ({ path }) => projectSprinkleDefinitionOpenFromHost(host, parts.opener, path),
  };
}

/**
 * Reads every definition file of the open project.
 *
 * @param host Host that knows the open project.
 * @param reader Reader of the definition files.
 * @returns The files, or why there are none.
 */
function projectSprinkleDefinitionFilesReadFromHost(
  host: GameProcessHost,
  reader: ProjectSprinkleDefinitionReader,
): SprinkleDefinitionFilesReadResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_SPRINKLE_NO_PROJECT_MESSAGE };
  }
  return reader.readAll(definition.assetRoot, definition.sprinkleDirectories);
}

/**
 * Opens one definition file of the open project in the system's text editor.
 *
 * @param host Host that knows the open project.
 * @param opener Opener of definition files.
 * @param definitionPath File path relative to the asset root.
 * @returns Success, or why the file was not opened.
 */
async function projectSprinkleDefinitionOpenFromHost(
  host: GameProcessHost,
  opener: ProjectSprinkleDefinitionOpener,
  definitionPath: string,
): Promise<SprinkleDefinitionOpenResult> {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_SPRINKLE_NO_PROJECT_MESSAGE };
  }
  return opener.open(definition.assetRoot, definition.sprinkleDirectories, definitionPath);
}
