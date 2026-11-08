import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import { ProjectTextureLister } from '@/desktop/bun/project_textures/project_texture_lister.js';
import { ProjectTextureReader } from '@/desktop/bun/project_textures/project_texture_reader.js';

/** Message returned while no project is open. */
const PROJECT_TEXTURE_NO_PROJECT_MESSAGE = 'Open a game project before reading its textures.';

/** Desktop requests that list and read the images of the open project. */
export interface ProjectTextureRpcHandlers {
  projectTextureList: () => TextureProjectListResult;
  projectTextureRead: (params: { path: string }) => TextureProjectReadResult;
}

/**
 * Creates the request handlers that serve the open project's texture
 * directories.
 *
 * @param host Host that knows the open project.
 * @param reader Reader that returns one image.
 * @returns Request handlers keyed by request name.
 */
export function projectTextureRpcHandlersCreate(
  host: GameProcessHost,
  reader: ProjectTextureReader = new ProjectTextureReader(),
): ProjectTextureRpcHandlers {
  return {
    projectTextureList: () => projectTextureListFromHost(host),
    projectTextureRead: ({ path }) => projectTextureReadFromHost(host, reader, path),
  };
}

/**
 * Lists the images of the open project's texture directories.
 *
 * @param host Host that knows the open project.
 * @returns Image paths relative to the asset root, or why there are none.
 */
function projectTextureListFromHost(host: GameProcessHost): TextureProjectListResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_TEXTURE_NO_PROJECT_MESSAGE };
  }
  try {
    const texturePaths = ProjectTextureLister.list(definition.assetRoot, definition.textureDirectories);
    return { ok: true, projectFile: definition.projectFile, texturePaths };
  } catch (error) {
    return {
      ok: false,
      message: `Cannot list project textures: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Reads one image of the open project's texture directories.
 *
 * @param host Host that knows the open project.
 * @param reader Reader that returns one image.
 * @param texturePath Image path relative to the asset root.
 * @returns The bytes as base64, or why the file is not returned.
 */
function projectTextureReadFromHost(
  host: GameProcessHost,
  reader: ProjectTextureReader,
  texturePath: string,
): TextureProjectReadResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: PROJECT_TEXTURE_NO_PROJECT_MESSAGE };
  }
  return reader.read(definition.assetRoot, definition.textureDirectories, texturePath);
}
