import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { ProjectDataFileStore } from '@/desktop/bun/project_data/project_data_file_store.js';
import {
  type ProjectDataLocation,
  ProjectDataLocationResolver,
} from '@/desktop/bun/project_data/project_data_location.js';
import type {
  ProjectDataFileChangeResult,
  ProjectDataFileKind,
  ProjectDataFileRemoveRequest,
  ProjectDataFilesReadResult,
  ProjectDataFileWriteRequest,
} from '@/project/data/project_data_file_types.js';

/** Message returned while no project is open. */
const PROJECT_DATA_NO_PROJECT_MESSAGE = 'Open a game project before reading or writing its files.';

/** Desktop requests that read and change the open project's data files. */
export interface ProjectDataRpcHandlers {
  projectDataFilesRead: (params: { kind: ProjectDataFileKind }) => ProjectDataFilesReadResult;
  projectDataFileWrite: (params: ProjectDataFileWriteRequest) => ProjectDataFileChangeResult;
  projectDataFileRemove: (params: ProjectDataFileRemoveRequest) => ProjectDataFileChangeResult;
}

/**
 * Creates the request handlers that serve the open project's class file and
 * prefab directory.
 *
 * @param host Host that knows the open project.
 * @param store Reads and writes the files.
 * @returns Request handlers keyed by request name.
 */
export function projectDataRpcHandlersCreate(
  host: GameProcessHost,
  store: ProjectDataFileStore = new ProjectDataFileStore(),
): ProjectDataRpcHandlers {
  return {
    projectDataFilesRead: ({ kind }) => projectDataFilesReadFromHost(host, store, kind),
    projectDataFileWrite: ({ kind, name, text }) =>
      projectDataChangeRun(host, kind, (location) => store.write(location, name, text)),
    projectDataFileRemove: ({ kind, name }) =>
      projectDataChangeRun(host, kind, (location) => store.remove(location, name)),
  };
}

/**
 * Reads every file of one kind of the open project's data.
 *
 * @param host Host that knows the open project.
 * @param store Reads the files.
 * @param kind Kind of data.
 * @returns The files, or why they cannot be read.
 */
function projectDataFilesReadFromHost(
  host: GameProcessHost,
  store: ProjectDataFileStore,
  kind: ProjectDataFileKind,
): ProjectDataFilesReadResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_DATA_NO_PROJECT_MESSAGE };
  }
  const location = ProjectDataLocationResolver.locationRead(definition, kind);
  if (location === null) {
    return { ok: true, isConfigured: false, fixedFileName: null, files: [] };
  }
  try {
    return { ok: true, isConfigured: true, fixedFileName: location.fixedFileName, files: store.readAll(location) };
  } catch (error) {
    return { ok: false, message: `Cannot read the project's ${kind}: ${projectDataErrorText(error)}` };
  }
}

/**
 * Runs a write or removal in the location of one kind of the open project's
 * data.
 *
 * @param host Host that knows the open project.
 * @param kind Kind of data.
 * @param change Writes or removes in the location.
 * @returns Success, or why nothing changed.
 */
function projectDataChangeRun(
  host: GameProcessHost,
  kind: ProjectDataFileKind,
  change: (location: ProjectDataLocation) => ProjectDataFileChangeResult,
): ProjectDataFileChangeResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_DATA_NO_PROJECT_MESSAGE };
  }
  const location = ProjectDataLocationResolver.locationRead(definition, kind);
  if (location === null) {
    return { ok: false, message: `The project file names no location for ${kind}.` };
  }
  try {
    return change(location);
  } catch (error) {
    return { ok: false, message: `Cannot change the project's ${kind}: ${projectDataErrorText(error)}` };
  }
}

/**
 * Turns a thrown value into text.
 *
 * @param error Thrown value.
 * @returns Message.
 */
function projectDataErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
