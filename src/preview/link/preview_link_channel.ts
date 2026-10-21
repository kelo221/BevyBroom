import { PreviewLinkTransportError } from '@/preview/link/preview_link_transport.js';

/** Receives the outcome of every finished channel request. */
export interface PreviewLinkChannelListener {
  /** Called when a request reached the game. */
  onRequestSucceeded(): void;
  /**
   * Called when a request failed.
   *
   * @param message Reason shown to the user.
   * @param isUnreachable True when the game could not be reached.
   */
  onRequestFailed(message: string, isUnreachable: boolean): void;
}

/**
 * Base for preview channels that keep at most one request in flight and report
 * every outcome to a listener.
 */
export abstract class PreviewLinkChannel {
  private requestInFlight = false;
  protected readonly listener: PreviewLinkChannelListener;

  /**
   * Creates a channel.
   *
   * @param listener Receives request outcomes.
   */
  protected constructor(listener: PreviewLinkChannelListener) {
    this.listener = listener;
  }

  /**
   * Returns whether a request is waiting for its reply.
   *
   * @returns True while a request is in flight.
   */
  isBusy(): boolean {
    return this.requestInFlight;
  }

  /**
   * Runs one request unless another is in flight.
   *
   * @param request Starts the request; its rejection is reported as a failure.
   * @returns A promise that settles after the outcome was reported, or null
   *   when the channel was busy.
   */
  protected requestRun(request: () => Promise<void>): Promise<void> | null {
    if (this.requestInFlight) {
      return null;
    }
    this.requestInFlight = true;
    return request()
      .then(() => this.listener.onRequestSucceeded())
      .catch((error: unknown) => this.requestFailureReport(error))
      .finally(() => {
        this.requestInFlight = false;
      });
  }

  /**
   * Reports a failed request to the listener.
   *
   * @param error Thrown value.
   */
  private requestFailureReport(error: unknown): void {
    const isUnreachable = error instanceof PreviewLinkTransportError ? error.isUnreachable : false;
    const message = error instanceof Error ? error.message : String(error);
    this.listener.onRequestFailed(message, isUnreachable);
  }
}
