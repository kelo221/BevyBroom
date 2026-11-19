import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import { ProjectModelReader } from '@/desktop/bun/project_models/project_model_reader.js';

/** Message returned while no project is open. */
const PROJECT_MODEL_NO_PROJECT_MESSAGE = 'Open a game project before reading its models.';

/** Desktop requests that read the models of the open project. */
export interface ProjectModelRpcHandlers {
  projectModelRead: (params: { path: string }) => ProjectFileReadResult;
}

/**
 * Creates the request handlers that serve the open project's models.
 *
 * @param host Host that knows the open project.
 * @param reader Reader that returns one model.
 * @returns Request handlers keyed by request name.
 */
export function projectModelRpcHandlersCreate(
  host: GameProcessHost,
  reader: ProjectModelReader = new ProjectModelReader(),
): ProjectModelRpcHandlers {
  return {
    projectModelRead: ({ path }) => {
      const definition = host.projectDefinitionRead();
      return definition
        ? reader.read(definition.assetRoot, path)
        : { ok: false, message: PROJECT_MODEL_NO_PROJECT_MESSAGE };
    },
  };
}
