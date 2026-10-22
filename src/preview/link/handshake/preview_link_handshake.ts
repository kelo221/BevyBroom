import { PREVIEW_METHOD, type PreviewHelloReply } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewLinkTransportError, type PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import {
  PreviewHandshakeJudge,
  type PreviewHandshakeExpectation,
  type PreviewHandshakeVerdict,
} from '@/preview/link/handshake/preview_handshake_judge.js';

/** Time the handshake may take before the game counts as unreachable. */
const PREVIEW_HANDSHAKE_TIMEOUT_MILLISECONDS = 1500;

/** Explanation shown when the bridge predates the handshake. */
const PREVIEW_HANDSHAKE_UNSUPPORTED_REASON =
  'The game bridge does not answer the handshake, so it speaks preview protocol 3 or older. Rebuild the game with the current broom_bridge.';

/**
 * Asks one game process which protocol, features and project it has, and
 * remembers whether the editor may publish into it.
 */
export class PreviewLinkHandshake {
  private verdict: PreviewHandshakeVerdict | null = null;
  private hello: PreviewHelloReply | null = null;

  /**
   * Runs the handshake and stores its verdict. A bridge that rejects the
   * handshake method counts as incompatible.
   *
   * @param transport Bridge transport.
   * @param expectation What the editor needs.
   * @throws PreviewLinkTransportError when the game could not be reached.
   */
  async perform(transport: PreviewLinkTransport, expectation: PreviewHandshakeExpectation): Promise<void> {
    this.forget();
    try {
      this.hello = await transport.call<PreviewHelloReply>(
        PREVIEW_METHOD.hello,
        null,
        PREVIEW_HANDSHAKE_TIMEOUT_MILLISECONDS,
      );
    } catch (error) {
      this.failureRecord(error);
      return;
    }
    this.verdict = PreviewHandshakeJudge.evaluate(this.hello, expectation);
  }

  /** Forgets the previous verdict so the next game process is checked again. */
  forget(): void {
    this.verdict = null;
    this.hello = null;
  }

  /**
   * Returns the reason publishing is refused.
   *
   * @returns Explanation, or null while compatible or not yet checked.
   */
  incompatibilityReasonRead(): string | null {
    return this.verdict && !this.verdict.compatible ? this.verdict.reason : null;
  }

  /**
   * Returns whether the checked game may receive the scene.
   *
   * @returns True only after a compatible handshake.
   */
  isCompatible(): boolean {
    return this.verdict?.compatible === true;
  }

  /**
   * Returns the last handshake reply.
   *
   * @returns Reply, or null before a successful handshake.
   */
  helloRead(): PreviewHelloReply | null {
    return this.hello;
  }

  /**
   * Treats a rejected handshake as an old bridge and rethrows unreachable
   * games.
   *
   * @param error Thrown value of the handshake call.
   * @throws The same error when the game could not be reached.
   */
  private failureRecord(error: unknown): void {
    if (!(error instanceof PreviewLinkTransportError) || error.isUnreachable) {
      throw error;
    }
    this.verdict = { compatible: false, reason: PREVIEW_HANDSHAKE_UNSUPPORTED_REASON };
  }
}
