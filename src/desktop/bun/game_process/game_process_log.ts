import {
  ProjectBuildDiagnosticsParser,
  type ProjectBuildDiagnostic,
} from '@/project/build/project_build_diagnostics_parser.js';

/** Number of output lines kept for the editor. */
const GAME_PROCESS_LOG_TAIL_LINES = 300;

/**
 * Keeps the newest output lines of builds and the game, and the compiler
 * messages of the last build.
 */
export class GameProcessLog {
  private readonly tail: string[] = [];
  private buildLines: string[] | null = null;
  private diagnostics: ProjectBuildDiagnostic[] = [];

  /**
   * Records one output line; during a build it also counts as compiler output.
   *
   * @param line Output line.
   */
  lineAdd(line: string): void {
    this.tail.push(line);
    if (this.tail.length > GAME_PROCESS_LOG_TAIL_LINES) {
      this.tail.splice(0, this.tail.length - GAME_PROCESS_LOG_TAIL_LINES);
    }
    this.buildLines?.push(line);
  }

  /**
   * Starts collecting compiler output and forgets the previous build's
   * messages.
   */
  buildBegin(): void {
    this.buildLines = [];
    this.diagnostics = [];
  }

  /**
   * Stops collecting compiler output and parses it.
   *
   * @returns Number of errors the build reported.
   */
  buildEnd(): number {
    this.diagnostics = ProjectBuildDiagnosticsParser.parse((this.buildLines ?? []).join('\n'));
    this.buildLines = null;
    return this.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  }

  /**
   * Returns the compiler messages of the last build.
   *
   * @returns Messages in output order.
   */
  diagnosticsRead(): readonly ProjectBuildDiagnostic[] {
    return this.diagnostics;
  }

  /**
   * Returns the newest output lines.
   *
   * @returns Copy of the kept lines, oldest first.
   */
  tailRead(): string[] {
    return [...this.tail];
  }
}
