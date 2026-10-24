import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import { LevelPackageWriter } from '@/desktop/bun/level_build/level_package_writer.js';
import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';

/** Desktop requests that open projects and drive the managed game. */
export interface GameProcessRpcHandlers {
  projectChooseFile: () => Promise<string | null>;
  projectOpen: (params: { projectFile: string }) => Promise<ProjectOpenResult>;
  gameProcessAction: (params: { action: GameProcessAction }) => GameProcessStatus;
  gameProcessStatus: () => GameProcessStatus;
  levelPackagePublish: (params: LevelBuildPublishRequest) => LevelBuildPublishResult;
}

/**
 * Creates the request handlers of the game process host.
 *
 * @param host Host that owns the managed game.
 * @param fileChoose Shows a native file dialog and returns the chosen paths.
 * @param levelPackageWriter Writer that publishes built levels.
 * @returns Request handlers keyed by request name.
 */
export function gameProcessRpcHandlersCreate(
  host: GameProcessHost,
  fileChoose: () => Promise<string[]>,
  levelPackageWriter: LevelPackageWriter = new LevelPackageWriter(),
): GameProcessRpcHandlers {
  return {
    projectChooseFile: async () => (await fileChoose()).find((path) => path.trim() !== '') ?? null,
    projectOpen: ({ projectFile }) => host.projectOpen(projectFile),
    gameProcessAction: ({ action }) => host.actionStart(action),
    gameProcessStatus: () => host.statusRead(),
    levelPackagePublish: (request) => levelPackagePublishToProject(host, levelPackageWriter, request),
  };
}

/**
 * Writes a level package into the level directory of the open project.
 *
 * @param host Host that knows the open project.
 * @param levelPackageWriter Writer that publishes the package atomically.
 * @param request Geometry and manifest to publish.
 * @returns Where the package went, or why nothing was written.
 */
function levelPackagePublishToProject(
  host: GameProcessHost,
  levelPackageWriter: LevelPackageWriter,
  request: LevelBuildPublishRequest,
): LevelBuildPublishResult {
  const definition = host.projectDefinitionRead();
  if (!definition) {
    return { ok: false, message: 'Open a game project before building a level.' };
  }
  const levelName = levelBuildNameSanitize(request.levelName);
  return levelPackageWriter.publish(`${definition.levelDirectory}/${levelName}`, { ...request, levelName });
}
