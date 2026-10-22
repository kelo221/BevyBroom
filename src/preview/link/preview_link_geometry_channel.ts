import type { PreviewGeometryPublication, PreviewRevisionReply } from '@/preview/protocol/preview_protocol_types.js';
import { PREVIEW_METHOD, PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import {
  PreviewLinkChannel,
  type PreviewLinkChannelGenerationCheck,
  type PreviewLinkChannelListener,
} from '@/preview/link/preview_link_channel.js';

/** Time a geometry upload may take before the game counts as unreachable. */
const PREVIEW_GEOMETRY_TIMEOUT_MILLISECONDS = 30000;

/** Quiet time after the last geometry change before it is published. */
export const PREVIEW_GEOMETRY_SETTLE_MILLISECONDS = 400;

/** Wait before publishing again after a failed publication. */
const PREVIEW_GEOMETRY_RETRY_MILLISECONDS = 2000;

/** Inputs of one geometry publication check. */
export interface PreviewGeometryCheck {
  /** Signature of the current exportable geometry. */
  signature: string;
  /** Current time in milliseconds. */
  nowMilliseconds: number;
  /** True while the user holds a pointer button, so edits are still in progress. */
  isEditInProgress: boolean;
  /** Document the geometry belongs to. */
  documentIdentifier: string;
  /** Level name the game stores the geometry under. */
  levelName: string;
}

/** Produces the binary glTF of the current geometry as base64 text. */
export type PreviewGeometryEncoder = () => Promise<string>;

/**
 * Publishes committed level geometry. A changed signature is published once it
 * stayed unchanged for the settle time while no edit is in progress, and a
 * changed document or level name is published as soon as the geometry is
 * settled; every publication gets a new geometry revision.
 */
export class PreviewLinkGeometryChannel extends PreviewLinkChannel {
  private readonly transport: PreviewLinkTransport;
  private readonly sessionIdentifier: string;
  private readonly encoder: PreviewGeometryEncoder;
  private geometryRevision = 0;
  private publishedKey: string | null = null;
  private publishedRevision = 0;
  private retriedKey: string | null = null;
  private observedSignature: string | null = null;
  private observedSinceMilliseconds = 0;
  private retryNotBeforeMilliseconds = 0;

  /**
   * Creates a geometry channel.
   *
   * @param transport Bridge transport.
   * @param sessionIdentifier Identifier of this editor session.
   * @param encoder Produces the GLB to publish.
   * @param listener Receives request outcomes.
   */
  constructor(
    transport: PreviewLinkTransport,
    sessionIdentifier: string,
    encoder: PreviewGeometryEncoder,
    listener: PreviewLinkChannelListener,
  ) {
    super(listener);
    this.transport = transport;
    this.sessionIdentifier = sessionIdentifier;
    this.encoder = encoder;
  }

  /**
   * Publishes the geometry when it changed and has settled.
   *
   * @param check Current signature, time and edit state.
   * @returns A promise settling after the reply, or null when nothing was sent.
   */
  publishIfSettled(check: PreviewGeometryCheck): Promise<void> | null {
    this.observedSignatureTrack(check.signature, check.nowMilliseconds);
    if (this.isBusy() || check.isEditInProgress || this.publicationKeyOf(check) === this.publishedKey) {
      return null;
    }
    if (!this.isSettled(check.nowMilliseconds)) {
      return null;
    }
    this.geometryRevision += 1;
    const revision = this.geometryRevision;
    return this.requestRun((isCurrent) => this.geometrySend(check, revision, isCurrent));
  }

  /**
   * Forgets what the game shows and any retry wait, so the next settled check
   * publishes again.
   */
  republishRequest(): void {
    this.publishedKey = null;
    this.retryNotBeforeMilliseconds = 0;
  }

  /**
   * Publishes the accepted geometry once more, under a new revision, when the
   * game reports that it failed to load it. A publication whose retry failed as
   * well is not retried again until the geometry, document or level name
   * changes.
   *
   * @param failedRevision Newest geometry revision the game failed to load.
   */
  failedRevisionObserve(failedRevision: number): void {
    const isPublishedRevision = failedRevision > 0 && failedRevision === this.publishedRevision;
    if (!isPublishedRevision || this.publishedKey === this.retriedKey) {
      return;
    }
    this.retriedKey = this.publishedKey;
    this.publishedKey = null;
  }

  /**
   * Returns the newest geometry revision this channel built.
   *
   * @returns Geometry revision, 0 before the first publication.
   */
  geometryRevisionRead(): number {
    return this.geometryRevision;
  }

  /**
   * Returns the key that tells whether a check describes what was already
   * published: the document, the level name and the geometry signature.
   *
   * @param check Geometry check.
   * @returns Publication key.
   */
  private publicationKeyOf(check: PreviewGeometryCheck): string {
    return `${check.documentIdentifier}
${check.levelName}
${check.signature}`;
  }

  /**
   * Returns whether the geometry stayed unchanged long enough and no retry wait
   * is pending.
   *
   * @param nowMilliseconds Current time.
   * @returns True when a publication may start.
   */
  private isSettled(nowMilliseconds: number): boolean {
    if (nowMilliseconds < this.retryNotBeforeMilliseconds) {
      return false;
    }
    return nowMilliseconds - this.observedSinceMilliseconds >= PREVIEW_GEOMETRY_SETTLE_MILLISECONDS;
  }

  /**
   * Restarts the settle timer whenever the signature changes.
   *
   * @param signature Current signature.
   * @param nowMilliseconds Current time.
   */
  private observedSignatureTrack(signature: string, nowMilliseconds: number): void {
    if (signature === this.observedSignature) {
      return;
    }
    this.observedSignature = signature;
    this.observedSinceMilliseconds = nowMilliseconds;
  }

  /**
   * Encodes and uploads one geometry revision. A failure delays the next
   * attempt; a reply that arrives after the game was replaced, or that names
   * another revision, changes nothing.
   *
   * @param check The check that triggered the publication.
   * @param geometryRevision Revision of this publication.
   * @param isCurrent Tells whether the request still belongs to the current
   *   game.
   */
  private async geometrySend(
    check: PreviewGeometryCheck,
    geometryRevision: number,
    isCurrent: PreviewLinkChannelGenerationCheck,
  ): Promise<void> {
    this.retryNotBeforeMilliseconds = check.nowMilliseconds + PREVIEW_GEOMETRY_RETRY_MILLISECONDS;
    const publication: PreviewGeometryPublication = {
      protocol: PREVIEW_PROTOCOL_VERSION,
      document_id: check.documentIdentifier,
      session_id: this.sessionIdentifier,
      geometry_revision: geometryRevision,
      level_name: check.levelName,
      glb_base64: await this.encoder(),
    };
    const reply = await this.transport.call<PreviewRevisionReply>(
      PREVIEW_METHOD.publishGeometry,
      publication,
      PREVIEW_GEOMETRY_TIMEOUT_MILLISECONDS,
    );
    if (isCurrent() && reply.accepted && reply.revision === geometryRevision) {
      this.publishedKey = this.publicationKeyOf(check);
      this.publishedRevision = geometryRevision;
      this.retryNotBeforeMilliseconds = 0;
    }
  }
}
