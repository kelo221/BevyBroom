import type {
  PreviewAuthoredObject,
  PreviewAuthoredState,
  PreviewRevisionReply,
} from '@/preview/protocol/preview_protocol_types.js';
import { PREVIEW_METHOD, PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PreviewLinkChannel, type PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';

/** Identity of the document a state snapshot belongs to. */
export interface PreviewStateDocument {
  projectIdentifier: string;
  documentIdentifier: string;
  geometryRevision: number;
}

/** Time a state request may take before the game counts as unreachable. */
const PREVIEW_STATE_TIMEOUT_MILLISECONDS = 3000;

/**
 * Sends authored state snapshots. A snapshot is sent only when it differs from
 * the last one the game accepted, at most one request is in flight, and later
 * edits made while a request is in flight are coalesced into the next send.
 */
export class PreviewLinkStateChannel extends PreviewLinkChannel {
  private readonly transport: PreviewLinkTransport;
  private readonly sessionIdentifier: string;
  private revision = 0;
  private acceptedSignature: string | null = null;
  private lastVerdict = '';

  /**
   * Creates a state channel.
   *
   * @param transport Bridge transport.
   * @param sessionIdentifier Identifier of this editor session.
   * @param listener Receives request outcomes.
   */
  constructor(transport: PreviewLinkTransport, sessionIdentifier: string, listener: PreviewLinkChannelListener) {
    super(listener);
    this.transport = transport;
    this.sessionIdentifier = sessionIdentifier;
  }

  /**
   * Sends the snapshot when it changed since the last accepted one.
   *
   * @param document Document identity and newest geometry revision.
   * @param objects Authored objects of the document.
   * @returns A promise settling after the reply, or null when nothing was sent.
   */
  sendIfChanged(document: PreviewStateDocument, objects: PreviewAuthoredObject[]): Promise<void> | null {
    if (this.isBusy()) {
      return null;
    }
    const signature = JSON.stringify([document, objects]);
    if (signature === this.acceptedSignature) {
      return null;
    }
    const state = this.stateCreate(document, objects);
    return this.requestRun(() => this.stateSend(state, signature));
  }

  /**
   * Forgets what the game accepted so the next call sends a full snapshot
   * again.
   */
  resendRequest(): void {
    this.acceptedSignature = null;
  }

  /**
   * Returns the newest revision this channel built.
   *
   * @returns Revision number, 0 before the first send.
   */
  revisionRead(): number {
    return this.revision;
  }

  /**
   * Returns the verdict of the last reply.
   *
   * @returns Verdict text such as newer or stale, empty before the first reply.
   */
  lastVerdictRead(): string {
    return this.lastVerdict;
  }

  /**
   * Builds the next snapshot with a new revision.
   *
   * @param document Document identity.
   * @param objects Authored objects.
   * @returns Snapshot ready to send.
   */
  private stateCreate(document: PreviewStateDocument, objects: PreviewAuthoredObject[]): PreviewAuthoredState {
    this.revision += 1;
    return {
      protocol: PREVIEW_PROTOCOL_VERSION,
      project_id: document.projectIdentifier,
      document_id: document.documentIdentifier,
      session_id: this.sessionIdentifier,
      revision: this.revision,
      geometry_revision: document.geometryRevision,
      objects,
    };
  }

  /**
   * Sends one snapshot and remembers it when the game accepted it.
   *
   * @param state Snapshot.
   * @param signature Signature of the snapshot content.
   */
  private async stateSend(state: PreviewAuthoredState, signature: string): Promise<void> {
    const reply = await this.transport.call<PreviewRevisionReply>(
      PREVIEW_METHOD.applyState,
      state,
      PREVIEW_STATE_TIMEOUT_MILLISECONDS,
    );
    this.lastVerdict = reply.verdict;
    if (reply.accepted) {
      this.acceptedSignature = signature;
    }
  }
}
