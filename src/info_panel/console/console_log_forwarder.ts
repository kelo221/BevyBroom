import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { ConsoleLogLevel } from '@/info_panel/console/console_log_entry.js';

/**
 * Quiet time after which the same message is written again; repeats that keep
 * arriving sooner than this, such as refresh loops, are written once.
 */
export const CONSOLE_LOG_FORWARDER_REPEAT_QUIET_MILLISECONDS = 1000;

/** Collaborators of a console log forwarder. */
export interface ConsoleLogForwarderOptions {
  /** Log written to; resolved on every message so a reset shared log is used. */
  logResolve: () => ConsoleLog;
  /** Current time in milliseconds. */
  clock: () => number;
}

/**
 * Writes messages of a source such as the status bar into a console log,
 * skipping empty messages and a message equal to the previous one while it
 * keeps repeating without a quiet pause.
 */
export class ConsoleLogForwarder {
  private readonly options: ConsoleLogForwarderOptions;
  private previousLevel: ConsoleLogLevel | null = null;
  private previousText = '';
  private previousMilliseconds = Number.NEGATIVE_INFINITY;

  /**
   * Creates a forwarder.
   *
   * @param options Collaborators; defaults to the shared log and the
   *   performance clock.
   */
  constructor(options: Partial<ConsoleLogForwarderOptions> = {}) {
    this.options = {
      logResolve: options.logResolve ?? (() => ConsoleLog.shared()),
      clock: options.clock ?? (() => performance.now()),
    };
  }

  /**
   * Writes a message unless it is empty or a quick repeat of the previous one.
   *
   * @param level Importance of the message.
   * @param text Message text.
   */
  messageForward(level: ConsoleLogLevel, text: string): void {
    const trimmedText = text.trim();
    if (trimmedText === '') {
      return;
    }
    const nowMilliseconds = this.options.clock();
    const isQuickRepeat = this.messageQuickRepeatIs(level, trimmedText, nowMilliseconds);
    this.previousLevel = level;
    this.previousText = trimmedText;
    this.previousMilliseconds = nowMilliseconds;
    if (!isQuickRepeat) {
      this.options.logResolve().entryAppend(level, trimmedText);
    }
  }

  /**
   * Returns whether a message equals the previous one and arrived before the
   * quiet time passed.
   *
   * @param level Importance of the message.
   * @param text Trimmed message text.
   * @param nowMilliseconds Arrival time.
   * @returns True when the message is a quick repeat.
   */
  private messageQuickRepeatIs(level: ConsoleLogLevel, text: string, nowMilliseconds: number): boolean {
    const isSameMessage = level === this.previousLevel && text === this.previousText;
    const elapsedMilliseconds = nowMilliseconds - this.previousMilliseconds;
    return isSameMessage && elapsedMilliseconds < CONSOLE_LOG_FORWARDER_REPEAT_QUIET_MILLISECONDS;
  }
}
