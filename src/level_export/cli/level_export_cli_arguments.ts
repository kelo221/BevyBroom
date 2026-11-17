/** Options of the command-line level export. */
export interface LevelExportCliArguments {
  /** Path of the project's `broom.project.json`. */
  projectFile: string;
  /** Id of the level to export, as the Level Browser lists it. */
  levelId: string;
  /**
   * Directory the package goes to; the project's level directory for the level
   * when null.
   */
  outDirectory: string | null;
  /** Compare the files on disk with a fresh export instead of writing. */
  isCheck: boolean;
}

/** Usage text of the command. */
export const LEVEL_EXPORT_CLI_USAGE =
  'Usage: bun scripts/level_export.ts --project <broom.project.json> --level <id> [--out <dir>] [--check]';

/** Reads the command-line options of the level export. */
export class LevelExportCliArgumentsParser {
  /**
   * Parses the arguments after the script name.
   *
   * @param argv Arguments, such as `process.argv.slice(2)`.
   * @returns Parsed options.
   * @throws Error naming the problem and the usage when an option is missing or
   *   unknown.
   */
  static parse(argv: readonly string[]): LevelExportCliArguments {
    const parsed: LevelExportCliArguments = { projectFile: '', levelId: '', outDirectory: null, isCheck: false };
    for (let index = 0; index < argv.length; index++) {
      const flag = argv[index] ?? '';
      if (flag === '--check') {
        parsed.isCheck = true;
        continue;
      }
      LevelExportCliArgumentsParser.valueFlagApply(parsed, flag, argv[index + 1]);
      index += 1;
    }
    if (parsed.projectFile === '' || parsed.levelId === '') {
      throw new Error(`--project and --level are required. ${LEVEL_EXPORT_CLI_USAGE}`);
    }
    return parsed;
  }

  /**
   * Applies one flag that takes a value.
   *
   * @param parsed Options being filled.
   * @param flag Flag name.
   * @param value Following argument.
   * @throws Error for an unknown flag or a missing value.
   */
  private static valueFlagApply(parsed: LevelExportCliArguments, flag: string, value: string | undefined): void {
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value. ${LEVEL_EXPORT_CLI_USAGE}`);
    }
    if (flag === '--project') {
      parsed.projectFile = value;
    } else if (flag === '--level') {
      parsed.levelId = value;
    } else if (flag === '--out') {
      parsed.outDirectory = value;
    } else {
      throw new Error(`Unknown option ${flag}. ${LEVEL_EXPORT_CLI_USAGE}`);
    }
  }
}
