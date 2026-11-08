import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PREVIEW_CAPABILITY_LIGHTS, type PreviewHelloReply } from '@/preview/protocol/preview_protocol_types.js';

/** An optional game bridge feature and the notice shown when a game lacks it. */
export interface PreviewOptionalCapabilityNotice {
  /** Capability name the game's handshake may leave out. */
  capability: string;
  /** Console text shown when a connected game does not serve the capability. */
  notice: string;
}

/** Optional game bridge features whose absence the editor points out. */
export const PREVIEW_OPTIONAL_CAPABILITY_NOTICES: readonly PreviewOptionalCapabilityNotice[] = [
  { capability: PREVIEW_CAPABILITY_LIGHTS, notice: 'This game does not render editor lights' },
];

/** The parts of a preview link controller the notice reporter watches. */
export type PreviewLinkCapabilityNoticeReporterSource = Pick<
  PreviewLinkController,
  'connectionStateRead' | 'gameHelloRead' | 'changeListenerAdd'
>;

/**
 * Writes one console warning per optional feature a connected game does not
 * serve, once per game process.
 */
export class PreviewLinkCapabilityNoticeReporter {
  private readonly source: PreviewLinkCapabilityNoticeReporterSource;
  private readonly logResolve: () => ConsoleLog;
  private readonly changeListenerRemove: () => void;
  private noticedInstanceIdentifier: string | null = null;

  /**
   * Starts watching a controller.
   *
   * @param source Controller watched.
   * @param logResolve Returns the log written to; defaults to the shared log.
   */
  constructor(
    source: PreviewLinkCapabilityNoticeReporterSource,
    logResolve: () => ConsoleLog = () => ConsoleLog.shared(),
  ) {
    this.source = source;
    this.logResolve = logResolve;
    this.changeListenerRemove = source.changeListenerAdd(() => this.sourceChangeCheck());
  }

  /** Stops watching. */
  dispose(): void {
    this.changeListenerRemove();
  }

  /** Writes the notices of a game process that is connected and not yet checked. */
  private sourceChangeCheck(): void {
    const hello = this.connectedHelloRead();
    if (hello === null || hello.instance_id === this.noticedInstanceIdentifier) {
      return;
    }
    this.noticedInstanceIdentifier = hello.instance_id;
    this.missingCapabilityNoticesWrite(hello);
  }

  /**
   * Returns the handshake reply of the game while the link is connected.
   *
   * @returns Reply, or null while not connected.
   */
  private connectedHelloRead(): PreviewHelloReply | null {
    if (this.source.connectionStateRead() !== 'connected') {
      return null;
    }
    return this.source.gameHelloRead();
  }

  /**
   * Writes a warning for every optional feature the game does not serve.
   *
   * @param hello Handshake reply of the connected game.
   */
  private missingCapabilityNoticesWrite(hello: PreviewHelloReply): void {
    PREVIEW_OPTIONAL_CAPABILITY_NOTICES.filter((optional) => !hello.capabilities.includes(optional.capability)).forEach(
      (optional) => this.logResolve().entryAppendWarning(optional.notice),
    );
  }
}
