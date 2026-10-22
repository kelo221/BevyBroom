import {
  previewLaunchCommandFromSection,
  previewLaunchIsRecord,
  type PreviewLaunchCommand,
} from '@/preview/launch/preview_launch_command.js';

/** Cargo flag that prints one line per compiler message. */
const CARGO_SHORT_MESSAGES_FLAG = '--message-format=short';

/**
 * Finds the command that builds a game project: the explicit `preview.build`
 * section, or the build matching a `cargo run` launch command.
 */
export class ProjectBuildCommandResolver {
  /**
   * Resolves the build command of a project.
   *
   * @param preview Parsed preview section of the project file.
   * @param launch Launch command of the project.
   * @param projectDirectory Absolute project directory.
   * @returns Build command, or null when the editor cannot build the project.
   */
  static resolve(
    preview: Record<string, unknown>,
    launch: PreviewLaunchCommand,
    projectDirectory: string,
  ): PreviewLaunchCommand | null {
    const explicitBuild = preview['build'];
    if (previewLaunchIsRecord(explicitBuild)) {
      return previewLaunchCommandFromSection(explicitBuild, projectDirectory, 'preview.build');
    }
    return ProjectBuildCommandResolver.isCargoRun(launch) ? ProjectBuildCommandResolver.cargoBuildDerive(launch) : null;
  }

  /**
   * Returns whether a launch command runs a program through `cargo run`.
   *
   * @param launch Launch command.
   * @returns True for cargo run commands.
   */
  static isCargoRun(launch: PreviewLaunchCommand): boolean {
    const programName = launch.program.replace(/\\/g, '/').split('/').pop() ?? '';
    const isCargo = programName.toLowerCase().replace(/\.exe$/, '') === 'cargo';
    return isCargo && ProjectBuildCommandResolver.cargoArguments(launch).includes('run');
  }

  /**
   * Builds the `cargo build` command matching a `cargo run` command.
   *
   * @param launch Cargo run command.
   * @returns Cargo build command with short compiler messages.
   */
  private static cargoBuildDerive(launch: PreviewLaunchCommand): PreviewLaunchCommand {
    const buildArguments = ProjectBuildCommandResolver.cargoArguments(launch).map((argument) =>
      argument === 'run' ? 'build' : argument,
    );
    if (!buildArguments.includes(CARGO_SHORT_MESSAGES_FLAG)) {
      buildArguments.push(CARGO_SHORT_MESSAGES_FLAG);
    }
    return {
      program: launch.program,
      arguments: buildArguments,
      workingDirectory: launch.workingDirectory,
      endpoint: '',
    };
  }

  /**
   * Returns the arguments cargo itself reads: those before `--`.
   *
   * @param launch Launch command.
   * @returns Cargo arguments.
   */
  private static cargoArguments(launch: PreviewLaunchCommand): string[] {
    const separatorIndex = launch.arguments.indexOf('--');
    return separatorIndex < 0 ? [...launch.arguments] : launch.arguments.slice(0, separatorIndex);
  }
}
