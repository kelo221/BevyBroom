import type { PreviewHelloReply } from '@/preview/protocol/preview_protocol_types.js';

/** Outcome of comparing a game's handshake with what the editor needs. */
export type PreviewHandshakeVerdict = { compatible: true } | { compatible: false; reason: string };

/** What the editor needs from a game before it publishes a scene into it. */
export interface PreviewHandshakeExpectation {
  /** Protocol version the editor speaks. */
  protocol: number;
  /** Bridge features the editor cannot work without. */
  requiredCapabilities: readonly string[];
  /** Project the open document belongs to, or null when any project is fine. */
  expectedProjectIdentifier: string | null;
}

/**
 * Decides whether a game that answered the handshake may receive the editor's
 * scene, and explains why not when it may not.
 */
export class PreviewHandshakeJudge {
  /**
   * Compares a handshake reply with the editor's expectation.
   *
   * @param hello Reply of the game bridge.
   * @param expectation What the editor needs.
   * @returns Compatible, or the first reason it is not.
   */
  static evaluate(hello: PreviewHelloReply, expectation: PreviewHandshakeExpectation): PreviewHandshakeVerdict {
    const reason =
      PreviewHandshakeJudge.protocolMismatchDescribe(hello, expectation.protocol) ??
      PreviewHandshakeJudge.capabilityMissingDescribe(hello, expectation.requiredCapabilities) ??
      PreviewHandshakeJudge.projectMismatchDescribe(hello, expectation.expectedProjectIdentifier);
    return reason === null ? { compatible: true } : { compatible: false, reason };
  }

  /**
   * Describes a protocol version the bridge does not accept.
   *
   * @param hello Reply of the game bridge.
   * @param editorProtocol Protocol version the editor speaks.
   * @returns Explanation, or null when the bridge accepts the editor's version.
   */
  private static protocolMismatchDescribe(hello: PreviewHelloReply, editorProtocol: number): string | null {
    if (editorProtocol >= hello.min_protocol && editorProtocol <= hello.protocol) {
      return null;
    }
    const remedy =
      editorProtocol > hello.protocol
        ? 'Rebuild the game with the current broom_bridge.'
        : 'Update BevyBroom to a version that speaks this protocol.';
    return `The game speaks preview protocol ${hello.min_protocol} to ${hello.protocol}, this editor speaks ${editorProtocol}. ${remedy}`;
  }

  /**
   * Describes the first required feature the bridge does not serve.
   *
   * @param hello Reply of the game bridge.
   * @param requiredCapabilities Features the editor needs.
   * @returns Explanation, or null when every feature is served.
   */
  private static capabilityMissingDescribe(
    hello: PreviewHelloReply,
    requiredCapabilities: readonly string[],
  ): string | null {
    const missing = requiredCapabilities.filter((capability) => !hello.capabilities.includes(capability));
    if (missing.length === 0) {
      return null;
    }
    return `The game bridge does not serve ${missing.join(', ')}. Rebuild the game with the current broom_bridge.`;
  }

  /**
   * Describes a game started for another project than the open document's.
   *
   * @param hello Reply of the game bridge.
   * @param expectedProjectIdentifier Project of the open document, or null for
   *   any.
   * @returns Explanation, or null when the projects match.
   */
  private static projectMismatchDescribe(
    hello: PreviewHelloReply,
    expectedProjectIdentifier: string | null,
  ): string | null {
    if (expectedProjectIdentifier === null || expectedProjectIdentifier === hello.project_id) {
      return null;
    }
    return `The running game belongs to project "${hello.project_id}", but this document belongs to "${expectedProjectIdentifier}". Start the game of this document's project.`;
  }
}
