import type { ProjectBuildDiagnostic } from '@/project/build/project_build_diagnostics_parser.js';

/** A line the game prints to warn or complain: `warning: …` or `error: …`. */
const GAME_PROCESS_NOTICE_PATTERN = /^(warning|error): (.+)$/;

/** Cargo's line that hands the terminal over to the program it built. */
const GAME_PROCESS_NOTICE_CARGO_RUNNING_PATTERN = /^\s*Running `/;

/** Terminal colour and style codes. */
const GAME_PROCESS_NOTICE_ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Most notices kept for one run of the game. */
const GAME_PROCESS_NOTICE_LIMIT = 100;

/**
 * Collects the warnings and errors a running game prints, one per `warning: …`
 * or `error: …` line. Lines printed before cargo hands over to the game are
 * compiler output and are dropped.
 */
export class GameProcessNoticeCollector {
  private notices: ProjectBuildDiagnostic[] = [];

  /** Forgets the notices of the previous run. */
  clear(): void {
    this.notices = [];
  }

  /**
   * Reads one output line of the game.
   *
   * @param line Output line.
   */
  lineAdd(line: string): void {
    const plainLine = line.replace(GAME_PROCESS_NOTICE_ANSI_PATTERN, '').trim();
    if (GAME_PROCESS_NOTICE_CARGO_RUNNING_PATTERN.test(plainLine)) {
      this.clear();
      return;
    }
    const notice = GameProcessNoticeCollector.noticeParse(plainLine);
    if (notice !== null && this.notices.length < GAME_PROCESS_NOTICE_LIMIT && !this.noticeIsKnown(notice)) {
      this.notices.push(notice);
    }
  }

  /**
   * Returns the notices of the current run.
   *
   * @returns Notices in output order.
   */
  noticesRead(): readonly ProjectBuildDiagnostic[] {
    return this.notices;
  }

  /**
   * Returns true when the same notice was already collected.
   *
   * @param notice Notice to look for.
   * @returns Whether it is kept already.
   */
  private noticeIsKnown(notice: ProjectBuildDiagnostic): boolean {
    return this.notices.some((kept) => kept.severity === notice.severity && kept.message === notice.message);
  }

  /**
   * Reads a notice from a line without colour codes.
   *
   * @param plainLine Trimmed line without colour codes.
   * @returns Notice without a source location, or null for any other line.
   */
  private static noticeParse(plainLine: string): ProjectBuildDiagnostic | null {
    const match = GAME_PROCESS_NOTICE_PATTERN.exec(plainLine);
    if (match === null) {
      return null;
    }
    const severity = match[1] === 'error' ? 'error' : 'warning';
    return { severity, message: match[2] ?? '', file: '', line: 0, column: 0 };
  }
}
