import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import type { GameProcessLevelTarget } from '@/project/process/game_process_types.js';
import { levelBuildPublishDirectoryRead } from '@/level_build/publish/level_build_publish_directory.js';
import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';

/** Placeholder replaced by the id of the open level, as its package is named. */
export const GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_ID = 'level_id';

/** Placeholder replaced by the absolute path of the open level's document. */
export const GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_DOCUMENT = 'level_document';

/** Placeholder replaced by the absolute directory the open level is exported to. */
export const GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_EXPORT_DIRECTORY = 'level_export_directory';

/** Every placeholder the game's arguments may name. */
export const GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES: readonly string[] = [
  GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_ID,
  GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_DOCUMENT,
  GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_EXPORT_DIRECTORY,
];

/** Pattern of one placeholder: a lowercase name in curly braces. */
const GAME_PROCESS_LAUNCH_PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g;

/**
 * Finds and replaces the placeholders such as `{level_id}` in the arguments
 * that start the game, so the game starts in the level open in the editor.
 */
export class GameProcessLaunchPlaceholders {
  /**
   * Returns the placeholder names the arguments use, in order of appearance,
   * each once.
   *
   * @param argumentList Arguments of the command.
   * @returns Placeholder names without braces.
   */
  static namesRead(argumentList: readonly string[]): string[] {
    const names = argumentList.flatMap((argument) =>
      Array.from(argument.matchAll(GAME_PROCESS_LAUNCH_PLACEHOLDER_PATTERN), (match) => match[1] ?? ''),
    );
    return Array.from(new Set(names));
  }

  /**
   * Returns the placeholder names the arguments use that the editor cannot fill
   * in.
   *
   * @param argumentList Arguments of the command.
   * @returns Unknown placeholder names without braces.
   */
  static unknownNamesRead(argumentList: readonly string[]): string[] {
    return GameProcessLaunchPlaceholders.namesRead(argumentList).filter(
      (name) => !GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES.includes(name),
    );
  }

  /**
   * Returns true when the command needs an open level to start.
   *
   * @param command Command that starts the game, or null.
   * @returns True when the arguments name a known placeholder.
   */
  static isLevelNeeded(command: PreviewLaunchCommand | null): boolean {
    if (command === null) {
      return false;
    }
    return GameProcessLaunchPlaceholders.namesRead(command.arguments).some((name) =>
      GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES.includes(name),
    );
  }

  /**
   * Returns true when the command reads the open level's built package.
   *
   * @param command Command that starts the game, or null.
   * @returns True when the arguments name `{level_id}` or
   *   `{level_export_directory}`.
   */
  static isLevelExportNeeded(command: PreviewLaunchCommand | null): boolean {
    const exportNames = [
      GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_ID,
      GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_EXPORT_DIRECTORY,
    ];
    const names = command === null ? [] : GameProcessLaunchPlaceholders.namesRead(command.arguments);
    return names.some((name) => exportNames.includes(name));
  }

  /**
   * Builds the value of every placeholder for one level of a project.
   *
   * @param definition Open project.
   * @param target Level the game starts in.
   * @returns Values by placeholder name; paths are absolute with forward
   *   slashes.
   */
  static valuesCreate(definition: ProjectDefinition, target: GameProcessLevelTarget): Map<string, string> {
    return new Map([
      [GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_ID, levelBuildNameSanitize(target.levelId)],
      [GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_DOCUMENT, `${definition.documentDirectory}/${target.levelDocument}`],
      [
        GAME_PROCESS_LAUNCH_PLACEHOLDER_LEVEL_EXPORT_DIRECTORY,
        levelBuildPublishDirectoryRead(definition.levelDirectory, target.levelId),
      ],
    ]);
  }

  /**
   * Returns a copy of the command with every known placeholder replaced; text
   * that is not a known placeholder stays as written.
   *
   * @param command Command that starts the game.
   * @param values Values by placeholder name.
   * @returns Command with the replaced arguments.
   */
  static commandResolve(command: PreviewLaunchCommand, values: ReadonlyMap<string, string>): PreviewLaunchCommand {
    const resolvedArguments = command.arguments.map((argument) =>
      argument.replace(GAME_PROCESS_LAUNCH_PLACEHOLDER_PATTERN, (written, name: string) => values.get(name) ?? written),
    );
    return { ...command, arguments: resolvedArguments };
  }
}
