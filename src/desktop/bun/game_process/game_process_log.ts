import {
  ProjectBuildDiagnosticsParser,
  type ProjectBuildDiagnostic,
} from '@/project/build/project_build_diagnostics_parser.js';

/** Prefix of the lines the editor writes into the log itself. */
export const GAME_PROCESS_LOG_EDITOR_PREFIX = '[editor] ';

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
   * Returns the newest line a program printed, skipping the editor's own lines
   * and blank lines.
   *
   * @returns Trimmed line, or null when no program printed anything kept.
   */
  programLineNewestRead(): string | null {
    for (let index = this.tail.length - 1; index >= 0; index -= 1) {
      const line = this.tail[index] ?? '';
      if (line.trim() !== '' && !line.startsWith(GAME_PROCESS_LOG_EDITOR_PREFIX)) {
        return line.trim();
      }
    }
    return null;
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
