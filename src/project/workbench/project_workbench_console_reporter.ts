import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ProjectBuildDiagnosticsParser } from '@/project/build/project_build_diagnostics_parser.js';
import type { GameProcessStatus } from '@/project/process/game_process_types.js';

/**
 * Writes the managed game's phase changes and build errors to the console log.
 * Statuses that repeat the previous phase and message write nothing.
 */
export class ProjectWorkbenchConsoleReporter {
  private readonly logResolve: () => ConsoleLog;
  private reportedKey = '';

  /**
   * Creates a reporter.
   *
   * @param logResolve Returns the log written to; defaults to the shared log.
   */
  constructor(logResolve: () => ConsoleLog = () => ConsoleLog.shared()) {
    this.logResolve = logResolve;
  }

  /**
   * Writes what changed since the previously reported status.
   *
   * @param status Newest status.
   */
  report(status: GameProcessStatus): void {
    const key = `${status.generation}|${status.phase}|${status.message}`;
    if (key === this.reportedKey) {
      return;
    }
    this.reportedKey = key;
    if (status.phase === 'build_failed') {
      this.buildFailureReport(status);
      return;
    }
    if (status.message !== '') {
      this.logResolve().entryAppendInfo(`Game: ${status.message}`);
    }
  }

  /**
   * Writes a failed build and each of its compiler errors.
   *
   * @param status Status of the failed build.
   */
  private buildFailureReport(status: GameProcessStatus): void {
    const consoleLog = this.logResolve();
    consoleLog.entryAppendError(`Game: ${status.message}`);
    status.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .forEach((diagnostic) => consoleLog.entryAppendError(ProjectBuildDiagnosticsParser.describe(diagnostic)));
  }
}
