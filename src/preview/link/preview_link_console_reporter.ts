import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { PreviewLinkConnectionState, PreviewLinkController } from '@/preview/link/preview_link_controller.js';

/** The parts of a preview link controller the reporter watches. */
export type PreviewLinkConsoleReporterSource = Pick<
  PreviewLinkController,
  'connectionStateRead' | 'lastErrorRead' | 'changeListenerAdd'
>;

/**
 * Writes the game preview link's connection changes and new request errors to
 * the console log. Repeated polls that change nothing write nothing.
 */
export class PreviewLinkConsoleReporter {
  private readonly source: PreviewLinkConsoleReporterSource;
  private readonly endpoint: string;
  private readonly logResolve: () => ConsoleLog;
  private readonly changeListenerRemove: () => void;
  private reportedState: PreviewLinkConnectionState;
  private reportedError: string;

  /**
   * Starts watching a controller; its current state is taken as already known.
   *
   * @param source Controller watched.
   * @param endpoint Address of the game, named in the messages.
   * @param logResolve Returns the log written to; defaults to the shared log.
   */
  constructor(
    source: PreviewLinkConsoleReporterSource,
    endpoint: string,
    logResolve: () => ConsoleLog = () => ConsoleLog.shared(),
  ) {
    this.source = source;
    this.endpoint = endpoint;
    this.logResolve = logResolve;
    this.reportedState = source.connectionStateRead();
    this.reportedError = source.lastErrorRead();
    this.changeListenerRemove = source.changeListenerAdd(() => this.sourceChangeReport());
  }

  /** Stops watching. */
  dispose(): void {
    this.changeListenerRemove();
  }

  /** Writes what changed since the previous report. */
  private sourceChangeReport(): void {
    const state = this.source.connectionStateRead();
    const error = this.source.lastErrorRead();
    const isStateChanged = state !== this.reportedState;
    const isErrorChanged = error !== this.reportedError;
    this.reportedState = state;
    this.reportedError = error;
    if (isStateChanged) {
      this.connectionStateReport(state, error);
      return;
    }
    if (isErrorChanged && error !== '') {
      this.logResolve().entryAppendError(`Game preview error: ${error}`);
    }
  }

  /**
   * Writes the message of a new connection state.
   *
   * @param state New connection state.
   * @param error Current request error, empty when none.
   */
  private connectionStateReport(state: PreviewLinkConnectionState, error: string): void {
    const consoleLog = this.logResolve();
    if (state === 'connecting') {
      consoleLog.entryAppendInfo(`Game preview connecting to ${this.endpoint}`);
    } else if (state === 'connected') {
      consoleLog.entryAppendInfo(`Game preview connected to ${this.endpoint}`);
    } else if (state === 'unreachable') {
      const reason = error === '' ? '' : `: ${error}`;
      consoleLog.entryAppendWarning(`Game preview unreachable at ${this.endpoint}${reason}`);
    } else {
      consoleLog.entryAppendInfo('Game preview disconnected');
    }
  }
}
