import { PreviewLinkTransportError } from '@/preview/link/preview_link_transport.js';

/** Returns whether a request still belongs to the channel's current generation. */
export type PreviewLinkChannelGenerationCheck = () => boolean;

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
 * every outcome to a listener. Requests started before the newest generation
 * report nothing and must not commit what they learned.
 */
export abstract class PreviewLinkChannel {
  private requestInFlight = false;
  private generation = 0;
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
   * Starts a new generation: the outcome of every request already in flight is
   * ignored, so a late reply of a previous game process changes nothing.
   */
  generationAdvance(): void {
    this.generation += 1;
  }

  /**
   * Returns the current generation number.
   *
   * @returns Generation, 0 until the first advance.
   */
  generationRead(): number {
    return this.generation;
  }

  /**
   * Runs one request unless another is in flight.
   *
   * @param request Starts the request; it receives a check telling whether it
   *   still belongs to the current generation, and its rejection is reported as
   *   a failure.
   * @returns A promise that settles after the outcome was reported, or null
   *   when the channel was busy.
   */
  protected requestRun(request: (isCurrent: PreviewLinkChannelGenerationCheck) => Promise<void>): Promise<void> | null {
    if (this.requestInFlight) {
      return null;
    }
    this.requestInFlight = true;
    const startedGeneration = this.generation;
    const isCurrent = (): boolean => startedGeneration === this.generation;
    return request(isCurrent)
      .then(() => this.requestSuccessReport(isCurrent))
      .catch((error: unknown) => this.requestFailureReport(error, isCurrent))
      .finally(() => {
        this.requestInFlight = false;
      });
  }

  /**
   * Reports a succeeded request of the current generation.
   *
   * @param isCurrent Tells whether the request still belongs to the current
   *   generation.
   */
  private requestSuccessReport(isCurrent: PreviewLinkChannelGenerationCheck): void {
    if (isCurrent()) {
      this.listener.onRequestSucceeded();
    }
  }

  /**
   * Reports a failed request of the current generation to the listener.
   *
   * @param error Thrown value.
   * @param isCurrent Tells whether the request still belongs to the current
   *   generation.
   */
  private requestFailureReport(error: unknown, isCurrent: PreviewLinkChannelGenerationCheck): void {
    if (!isCurrent()) {
      return;
    }
    const isUnreachable = error instanceof PreviewLinkTransportError ? error.isUnreachable : false;
    const message = error instanceof Error ? error.message : String(error);
    this.listener.onRequestFailed(message, isUnreachable);
  }
}
