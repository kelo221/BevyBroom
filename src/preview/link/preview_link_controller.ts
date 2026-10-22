import * as THREE from 'three';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import type { PreviewBridgeStatus, PreviewHelloReply } from '@/preview/protocol/preview_protocol_types.js';
import {
  PREVIEW_METHOD,
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_REQUIRED_CAPABILITIES,
} from '@/preview/protocol/preview_protocol_types.js';
import { PreviewLinkHandshake } from '@/preview/link/handshake/preview_link_handshake.js';
import type { PreviewHandshakeExpectation } from '@/preview/link/handshake/preview_handshake_judge.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import { PreviewLinkStateChannel } from '@/preview/link/preview_link_state_channel.js';
import { PreviewLinkGeometryChannel } from '@/preview/link/preview_link_geometry_channel.js';
import { PreviewLinkStatusChannel } from '@/preview/link/preview_link_status_channel.js';
import {
  PreviewLinkCatalogChannel,
  type PreviewCatalogLoadedCallback,
} from '@/preview/link/preview_link_catalog_channel.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import type { PreviewLinkFeatureChannel } from '@/preview/link/preview_link_feature_channel.js';
import { PreviewLinkFeatureChannelRegistry } from '@/preview/link/preview_link_feature_channel_registry.js';
import { PreviewGeometrySignature } from '@/preview/geometry/preview_geometry_signature.js';

/**
 * Where the link to the game stands. An incompatible game answered but failed
 * the handshake, so nothing is published into it.
 */
export type PreviewLinkConnectionState = 'disconnected' | 'connecting' | 'connected' | 'unreachable' | 'incompatible';

/** Collaborators of a preview link controller. */
export interface PreviewLinkControllerOptions {
  /** Editor world root whose content is mirrored. */
  worldGroup: THREE.Group;
  /** Bridge transport. */
  transport: PreviewLinkTransport;
  /**
   * Produces the GLB of the world as base64 text; receives a test for game
   * material identities.
   */
  geometryEncoder: (isGameMaterial: (materialIdentifier: string) => boolean) => Promise<string>;
  /** Receives the game material catalog whenever it changed. */
  onCatalogLoaded: PreviewCatalogLoadedCallback;
  /** Current time in milliseconds. */
  clock: () => number;
  /** Returns true while an edit gesture is in progress. */
  isEditInProgress: () => boolean;
  /** Returns the level name the game stores geometry under. */
  levelNameProvider: () => string;
  /**
   * Returns the project the open document belongs to; a game of another project
   * fails the handshake. Omitted or null accepts any project.
   */
  expectedProjectProvider?: () => string | null;
}

/** Time between geometry signature checks. */
const PREVIEW_GEOMETRY_CHECK_INTERVAL_MILLISECONDS = 120;

/**
 * Mirrors the open editor document into a running game: authored state on every
 * change, committed geometry after edits settle, the game material catalog when
 * it changes, every registered feature channel, and a full resend when the game
 * restarts. Call {@link tick} regularly while connected.
 */
export class PreviewLinkController implements PreviewLinkChannelListener {
  private readonly options: PreviewLinkControllerOptions;
  private readonly sessionIdentifier = THREE.MathUtils.generateUUID();
  private readonly stateChannel: PreviewLinkStateChannel;
  private readonly geometryChannel: PreviewLinkGeometryChannel;
  private readonly statusChannel: PreviewLinkStatusChannel;
  private readonly catalogChannel: PreviewLinkCatalogChannel;
  private readonly featureChannels: readonly PreviewLinkFeatureChannel[];
  private readonly changeListeners = new Set<() => void>();
  private readonly handshake = new PreviewLinkHandshake();
  private connectionState: PreviewLinkConnectionState = 'disconnected';
  private lastErrorMessage = '';
  private nextGeometryCheckMilliseconds = 0;

  /**
   * Creates a disconnected controller.
   *
   * @param options Collaborators.
   */
  constructor(options: PreviewLinkControllerOptions) {
    this.options = options;
    this.stateChannel = new PreviewLinkStateChannel(options.transport, this.sessionIdentifier, this);
    this.catalogChannel = new PreviewLinkCatalogChannel(options.transport, options.onCatalogLoaded, this);
    const encoder = (): Promise<string> =>
      options.geometryEncoder((materialIdentifier) => this.catalogChannel.isGameMaterial(materialIdentifier));
    this.geometryChannel = new PreviewLinkGeometryChannel(options.transport, this.sessionIdentifier, encoder, this);
    this.statusChannel = new PreviewLinkStatusChannel(
      options.transport,
      (status) => this.gameInstanceAdopt(status),
      this,
    );
    this.featureChannels = PreviewLinkFeatureChannelRegistry.channelsCreate(options.transport, this);
  }

  /** Starts mirroring; the first status reply makes the link connected. */
  connect(): void {
    if (this.connectionState !== 'disconnected') {
      return;
    }
    this.statusChannel.instanceForget();
    this.handshake.forget();
    this.connectionStateWrite('connecting');
  }

  /** Stops mirroring. The game keeps showing what it received. */
  disconnect(): void {
    this.connectionStateWrite('disconnected');
  }

  /**
   * Runs one update: polls status and sends state and geometry when due.
   *
   * @returns Every request started by this update, for callers that wait on
   *   them.
   */
  tick(): Promise<void>[] {
    if (this.connectionState === 'disconnected') {
      return [];
    }
    const nowMilliseconds = this.options.clock();
    const started = [this.statusChannel.pollIfDue(nowMilliseconds)];
    if (this.connectionState === 'connected') {
      started.push(
        this.stateSend(),
        this.catalogChannel.checkIfDue(nowMilliseconds),
        this.geometryPublishIfDue(nowMilliseconds),
        ...this.featureChannels.map((channel) => channel.tickIfDue(nowMilliseconds)),
      );
    }
    return started.filter((request): request is Promise<void> => request !== null);
  }

  /**
   * Asks the game to bake preview lighting.
   *
   * @returns A promise settling once the game accepted the request.
   */
  async previewBakeRequest(): Promise<void> {
    await this.options.transport.call(PREVIEW_METHOD.bakePreview, null, 3000);
  }

  /**
   * Returns where the link stands.
   *
   * @returns Connection state.
   */
  connectionStateRead(): PreviewLinkConnectionState {
    return this.connectionState;
  }

  /**
   * Returns the newest game status.
   *
   * @returns Status, or null before the game answered.
   */
  gameStatusRead(): PreviewBridgeStatus | null {
    return this.statusChannel.latestStatusRead();
  }

  /**
   * Returns the handshake reply of the current game process.
   *
   * @returns Reply, or null before a game answered the handshake.
   */
  gameHelloRead(): PreviewHelloReply | null {
    return this.handshake.helloRead();
  }

  /**
   * Returns the last request error.
   *
   * @returns Error text, empty when the last request succeeded.
   */
  lastErrorRead(): string {
    return this.lastErrorMessage;
  }

  /**
   * Returns the newest state and geometry revisions this editor built.
   *
   * @returns Revision numbers.
   */
  revisionsRead(): { state: number; geometry: number } {
    return { state: this.stateChannel.revisionRead(), geometry: this.geometryChannel.geometryRevisionRead() };
  }

  /**
   * Registers a callback run whenever connection state, status or errors
   * change.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Marks the link connected after a reply from a game that passed the
   * handshake, or incompatible with the handshake's reason.
   */
  onRequestSucceeded(): void {
    if (this.connectionState === 'disconnected') {
      return;
    }
    const incompatibilityReason = this.handshake.incompatibilityReasonRead();
    this.lastErrorMessage = incompatibilityReason ?? '';
    if (incompatibilityReason !== null) {
      this.connectionStateWrite('incompatible');
      return;
    }
    this.connectionStateWrite(this.handshake.isCompatible() ? 'connected' : 'connecting');
  }

  /**
   * Records a failed request and marks the game unreachable when no reply came.
   *
   * @param message Reason shown to the user.
   * @param isUnreachable True when the game could not be reached.
   */
  onRequestFailed(message: string, isUnreachable: boolean): void {
    if (this.connectionState === 'disconnected') {
      return;
    }
    this.lastErrorMessage = message;
    this.connectionStateWrite(isUnreachable ? 'unreachable' : this.connectionState);
  }

  /**
   * Checks a new game process with the handshake and, when it passes, resends
   * everything and reloads the catalog and every feature channel.
   *
   * @param status First status of the new game process.
   */
  private async gameInstanceAdopt(status: PreviewBridgeStatus): Promise<void> {
    await this.handshake.perform(this.options.transport, this.handshakeExpectationBuild());
    if (this.handshake.isCompatible()) {
      this.gameContentResendRequest(status);
    }
  }

  /**
   * Builds what the editor needs from a game before publishing into it.
   *
   * @returns Handshake expectation.
   */
  private handshakeExpectationBuild(): PreviewHandshakeExpectation {
    return {
      protocol: PREVIEW_PROTOCOL_VERSION,
      requiredCapabilities: PREVIEW_REQUIRED_CAPABILITIES,
      expectedProjectIdentifier: this.options.expectedProjectProvider?.() ?? null,
    };
  }

  /**
   * Resends everything and reloads the catalog and every feature channel.
   *
   * @param status First status of the new game process.
   */
  private gameContentResendRequest(status: PreviewBridgeStatus): void {
    this.stateChannel.resendRequest();
    this.geometryChannel.republishRequest();
    this.catalogChannel.reloadRequest();
    this.featureChannels.forEach((channel) => channel.gameInstanceAdopt(status));
  }

  /**
   * Sends the authored state when it changed.
   *
   * @returns The started request, or null.
   */
  private stateSend(): Promise<void> | null {
    const worldGroup = this.options.worldGroup;
    const document = {
      projectIdentifier: this.statusChannel.latestStatusRead()?.project_id ?? '',
      documentIdentifier: documentIdentityEnsure(worldGroup),
      geometryRevision: this.geometryChannel.geometryRevisionRead(),
    };
    return this.stateChannel.sendIfChanged(document, PreviewStateObjectCollector.collect(worldGroup));
  }

  /**
   * Publishes geometry when the check interval elapsed and the geometry
   * settled.
   *
   * @param nowMilliseconds Current time.
   * @returns The started request, or null.
   */
  private geometryPublishIfDue(nowMilliseconds: number): Promise<void> | null {
    if (nowMilliseconds < this.nextGeometryCheckMilliseconds) {
      return null;
    }
    this.nextGeometryCheckMilliseconds = nowMilliseconds + PREVIEW_GEOMETRY_CHECK_INTERVAL_MILLISECONDS;
    this.geometryChannel.failedRevisionObserve(this.statusChannel.latestStatusRead()?.geometry_revision_failed ?? 0);
    return this.geometryChannel.publishIfSettled({
      signature: PreviewGeometrySignature.compute(this.options.worldGroup),
      nowMilliseconds,
      isEditInProgress: this.options.isEditInProgress(),
      documentIdentifier: documentIdentityEnsure(this.options.worldGroup),
      levelName: this.options.levelNameProvider(),
    });
  }

  /**
   * Stores the connection state and notifies listeners.
   *
   * @param connectionState New state.
   */
  private connectionStateWrite(connectionState: PreviewLinkConnectionState): void {
    this.connectionState = connectionState;
    this.changeListeners.forEach((listener) => listener());
  }
}
