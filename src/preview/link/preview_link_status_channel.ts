import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PreviewLinkChannel, type PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';

/** Time between status polls. */
export const PREVIEW_STATUS_INTERVAL_MILLISECONDS = 1000;

/** Time a status request may take before the game counts as unreachable. */
const PREVIEW_STATUS_TIMEOUT_MILLISECONDS = 1500;

/**
 * Called when a different game process answers than the one seen before; the
 * status poll waits for a returned promise.
 */
export type PreviewGameInstanceChangedCallback = (status: PreviewBridgeStatus) => Promise<void> | void;

/**
 * Polls the game bridge status and detects when the game process was replaced,
 * which happens when the game restarts.
 */
export class PreviewLinkStatusChannel extends PreviewLinkChannel {
  private readonly transport: PreviewLinkTransport;
  private readonly onInstanceChanged: PreviewGameInstanceChangedCallback;
  private latestStatus: PreviewBridgeStatus | null = null;
  private nextPollMilliseconds = 0;

  /**
   * Creates a status channel.
   *
   * @param transport Bridge transport.
   * @param onInstanceChanged Called when a new game process answers.
   * @param listener Receives request outcomes.
   */
  constructor(
    transport: PreviewLinkTransport,
    onInstanceChanged: PreviewGameInstanceChangedCallback,
    listener: PreviewLinkChannelListener,
  ) {
    super(listener);
    this.transport = transport;
    this.onInstanceChanged = onInstanceChanged;
  }

  /**
   * Polls the status when the poll interval elapsed.
   *
   * @param nowMilliseconds Current time.
   * @returns A promise settling after the reply, or null when no poll was due.
   */
  pollIfDue(nowMilliseconds: number): Promise<void> | null {
    if (nowMilliseconds < this.nextPollMilliseconds || this.isBusy()) {
      return null;
    }
    this.nextPollMilliseconds = nowMilliseconds + PREVIEW_STATUS_INTERVAL_MILLISECONDS;
    return this.requestRun(() => this.statusFetch());
  }

  /**
   * Returns the newest status, or null before the first reply.
   *
   * @returns Bridge status.
   */
  latestStatusRead(): PreviewBridgeStatus | null {
    return this.latestStatus;
  }

  /** Forgets the known game so the next answer counts as a new game process. */
  instanceForget(): void {
    this.latestStatus = null;
    this.nextPollMilliseconds = 0;
  }

  /**
   * Fetches the status and reports a changed game process. When that report
   * fails, the process stays unknown so the next poll reports it again.
   */
  private async statusFetch(): Promise<void> {
    const status = await this.transport.call<PreviewBridgeStatus>(
      PREVIEW_METHOD.status,
      null,
      PREVIEW_STATUS_TIMEOUT_MILLISECONDS,
    );
    const previousInstance = this.latestStatus?.instance_id ?? null;
    this.latestStatus = status;
    if (previousInstance === status.instance_id) {
      return;
    }
    try {
      await this.onInstanceChanged(status);
    } catch (error) {
      this.latestStatus = null;
      throw error;
    }
  }
}
