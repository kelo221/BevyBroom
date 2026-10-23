import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';
import type { ProjectDefinition, ProjectProblem } from '@/project/model/project_definition.js';

/** File system questions the validator asks. */
export interface ProjectFileSystemProbe {
  /**
   * Returns whether a directory exists.
   *
   * @param path Absolute path.
   */
  isDirectory(path: string): boolean;
  /**
   * Returns whether a file exists.
   *
   * @param path Absolute path.
   */
  isFile(path: string): boolean;
}

/**
 * Checks a parsed project against the file system before the editor starts or
 * builds its game, and explains every problem found.
 */
export class ProjectDefinitionValidator {
  /**
   * Finds the problems of a project.
   *
   * @param definition Parsed project.
   * @param probe File system access.
   * @returns Problems; errors stop the game from being started.
   */
  static validate(definition: ProjectDefinition, probe: ProjectFileSystemProbe): ProjectProblem[] {
    const problems: ProjectProblem[] = [];
    if (!probe.isDirectory(definition.assetRoot)) {
      problems.push({ severity: 'error', message: `The asset root ${definition.assetRoot} does not exist.` });
    }
    problems.push(...ProjectDefinitionValidator.commandProblems('launch', definition.launch, probe));
    if (definition.build) {
      problems.push(...ProjectDefinitionValidator.commandProblems('build', definition.build, probe));
    }
    problems.push(...ProjectDefinitionValidator.endpointProblems(definition.launch.endpoint));
    return problems;
  }

  /**
   * Checks the working directory and, when given as a path, the program of a
   * command.
   *
   * @param commandName Name of the command in messages.
   * @param command Command to check.
   * @param probe File system access.
   * @returns Problems of the command.
   */
  private static commandProblems(
    commandName: string,
    command: PreviewLaunchCommand,
    probe: ProjectFileSystemProbe,
  ): ProjectProblem[] {
    const problems: ProjectProblem[] = [];
    if (!probe.isDirectory(command.workingDirectory)) {
      problems.push({
        severity: 'error',
        message: `The ${commandName} directory ${command.workingDirectory} does not exist.`,
      });
    }
    const programPath = ProjectDefinitionValidator.programPathResolve(command);
    if (programPath !== null && !probe.isFile(programPath)) {
      problems.push({ severity: 'error', message: `The ${commandName} program ${programPath} does not exist.` });
    }
    return problems;
  }

  /**
   * Resolves a program given as a path; programs found through PATH are not
   * checked.
   *
   * @param command Command whose program is resolved.
   * @returns Absolute program path, or null for a bare program name.
   */
  private static programPathResolve(command: PreviewLaunchCommand): string | null {
    const program = command.program.replace(/\\/g, '/');
    if (!program.includes('/')) {
      return null;
    }
    const isAbsolute = /^([a-zA-Z]:)?\//.test(program);
    return isAbsolute ? program : `${command.workingDirectory}/${program}`;
  }

  /**
   * Checks that the endpoint is a local HTTP address.
   *
   * @param endpoint Endpoint from the project file; empty uses the default.
   * @returns Problems of the endpoint.
   */
  private static endpointProblems(endpoint: string): ProjectProblem[] {
    if (endpoint === '') {
      return [];
    }
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return [{ severity: 'error', message: `The endpoint "${endpoint}" is not a URL.` }];
    }
    const isLocal = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    return url.protocol === 'http:' && isLocal
      ? []
      : [{ severity: 'warning', message: `The endpoint ${endpoint} is not a local http address.` }];
  }
}
