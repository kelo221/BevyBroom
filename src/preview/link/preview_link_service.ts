import type * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { PreviewLinkPointerTracker } from '@/preview/link/preview_link_pointer_tracker.js';
import { PreviewLinkConsoleReporter } from '@/preview/link/preview_link_console_reporter.js';
import type { PreviewCatalogLoadedCallback } from '@/preview/link/preview_link_catalog_channel.js';
import { previewGeometryEncodeGlb } from '@/preview/geometry/preview_geometry_encoder_glb.js';
import { PREVIEW_DEFAULT_ENDPOINT } from '@/preview/protocol/preview_protocol_types.js';

/** Local storage key of the remembered game preview endpoint. */
const PREVIEW_ENDPOINT_STORAGE_KEY = 'bevybroom.preview.endpoint';

/** Interval between link updates, about 30 per second. */
const PREVIEW_TICK_INTERVAL_MILLISECONDS = 33;

/** Editor hooks used by the preview link service. */
export interface PreviewLinkServiceHooks {
  /** Receives the game material catalog whenever it changed. */
  onCatalogLoaded: PreviewCatalogLoadedCallback;
  /** Returns the level name the game stores geometry under. */
  levelNameProvider: () => string;
  /** Returns the project id the game must report, or null to accept any game. */
  expectedProjectProvider?: () => string | null;
}

/**
 * Owns the live link between the editor and a game preview: the endpoint, the
 * update timer, pointer tracking and the controller for the current endpoint.
 */
export class PreviewLinkService {
  private readonly worldGroup: THREE.Group;
  private readonly hooks: PreviewLinkServiceHooks;
  private readonly changeListeners = new Set<() => void>();
  private controller: PreviewLinkController | null = null;
  private pointerTracker: PreviewLinkPointerTracker | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private removeControllerListener: (() => void) | null = null;
  private consoleReporter: PreviewLinkConsoleReporter | null = null;
  private endpoint: string | null = null;

  /**
   * Creates a disconnected service.
   *
   * @param worldGroup Editor world root that is mirrored.
   * @param hooks Editor hooks.
   */
  constructor(worldGroup: THREE.Group, hooks: PreviewLinkServiceHooks) {
    this.worldGroup = worldGroup;
    this.hooks = hooks;
  }

  /**
   * Returns this editor's endpoint: the last one written, or the one stored by
   * an earlier session.
   *
   * @returns Endpoint URL.
   */
  endpointRead(): string {
    return (
      this.endpoint ?? (globalThis.localStorage?.getItem(PREVIEW_ENDPOINT_STORAGE_KEY) || PREVIEW_DEFAULT_ENDPOINT)
    );
  }

  /**
   * Sets the endpoint the next connect uses, and stores it for later sessions.
   * The editor keeps its own copy because local storage is shared by every
   * editor window of the same profile.
   *
   * @param endpoint Endpoint URL; blank restores the default.
   */
  endpointWrite(endpoint: string): void {
    this.endpoint = endpoint.trim() || PREVIEW_DEFAULT_ENDPOINT;
    globalThis.localStorage?.setItem(PREVIEW_ENDPOINT_STORAGE_KEY, this.endpoint);
  }

  /** Connects to the remembered endpoint and starts the update timer. */
  connect(): void {
    this.disconnect();
    this.controller = this.controllerCreate();
    this.removeControllerListener = this.controller.changeListenerAdd(() => this.changeNotify());
    this.consoleReporter = new PreviewLinkConsoleReporter(this.controller, this.endpointRead());
    this.pointerTracker = new PreviewLinkPointerTracker(window);
    this.tickTimer = setInterval(() => this.controller?.tick(), PREVIEW_TICK_INTERVAL_MILLISECONDS);
    this.controller.connect();
  }

  /** Stops the update timer and disconnects. */
  disconnect(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.pointerTracker?.dispose();
    this.pointerTracker = null;
    this.controller?.disconnect();
    this.consoleReporter?.dispose();
    this.consoleReporter = null;
    this.removeControllerListener?.();
    this.removeControllerListener = null;
    this.changeNotify();
  }

  /**
   * Returns the controller of the current connection.
   *
   * @returns Controller, or null before the first connect.
   */
  controllerRead(): PreviewLinkController | null {
    return this.controller;
  }

  /**
   * Registers a callback run whenever the link changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Creates the controller for the remembered endpoint.
   *
   * @returns New disconnected controller.
   */
  private controllerCreate(): PreviewLinkController {
    return new PreviewLinkController({
      worldGroup: this.worldGroup,
      transport: new PreviewLinkTransportHttp(this.endpointRead()),
      geometryEncoder: (isGameMaterial) => previewGeometryEncodeGlb(this.worldGroup, isGameMaterial),
      onCatalogLoaded: this.hooks.onCatalogLoaded,
      clock: () => performance.now(),
      isEditInProgress: () => this.pointerTracker?.isPointerHeld() ?? false,
      levelNameProvider: this.hooks.levelNameProvider,
      expectedProjectProvider: () => this.hooks.expectedProjectProvider?.() ?? null,
    });
  }

  /** Runs every change listener. */
  private changeNotify(): void {
    this.changeListeners.forEach((listener) => listener());
  }
}
