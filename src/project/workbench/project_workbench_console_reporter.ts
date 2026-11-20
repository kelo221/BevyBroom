import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ProjectBuildDiagnosticsParser } from '@/project/build/project_build_diagnostics_parser.js';
import type { GameProcessStatus } from '@/project/process/game_process_types.js';
import { gameNoticeObjectReferenceParse } from '@/project/issues/game_notice_object_reference.js';

/**
 * Writes the managed game's phase changes, build errors and the warnings and
 * errors the game prints to the console log. Statuses that repeat the previous
 * phase and message write nothing, and each game notice is written once.
 */
export class ProjectWorkbenchConsoleReporter {
  private readonly logResolve: () => ConsoleLog;
  private reportedKey = '';
  private readonly reportedGameNoticeKeys = new Set<string>();
  private reportedGameNoticeGeneration = -1;

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
    this.statusPhaseReport(status);
    this.gameNoticesReport(status);
  }

  /**
   * Writes the phase and message when they changed.
   *
   * @param status Newest status.
   */
  private statusPhaseReport(status: GameProcessStatus): void {
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
   * Writes each warning or error the game printed that was not written yet for
   * the current action.
   *
   * @param status Newest status.
   */
  private gameNoticesReport(status: GameProcessStatus): void {
    if (status.generation !== this.reportedGameNoticeGeneration) {
      this.reportedGameNoticeGeneration = status.generation;
      this.reportedGameNoticeKeys.clear();
    }
    for (const notice of status.gameNotices) {
      const noticeKey = `${notice.severity}|${notice.message}`;
      if (!this.reportedGameNoticeKeys.has(noticeKey)) {
        this.reportedGameNoticeKeys.add(noticeKey);
        this.gameNoticeWrite(notice.severity, notice.message);
      }
    }
  }

  /**
   * Writes one game notice to the console.
   *
   * @param severity Importance of the notice.
   * @param message What the game said.
   */
  private gameNoticeWrite(severity: 'error' | 'warning', message: string): void {
    const consoleLog = this.logResolve();
    const objectReference = gameNoticeObjectReferenceParse(message) ?? undefined;
    if (severity === 'error') {
      consoleLog.entryAppendError(`Game: ${message}`, objectReference);
      return;
    }
    consoleLog.entryAppendWarning(`Game: ${message}`, objectReference);
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
