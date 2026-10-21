import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PreviewLinkChannel, type PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import { PreviewCatalogEntryLoader, type PreviewCatalogEntries } from '@/preview/catalog/preview_catalog_entries.js';

/** Time between catalog change checks. */
export const PREVIEW_CATALOG_INTERVAL_MILLISECONDS = 2000;

/** Receives the game material catalog whenever it changed. */
export type PreviewCatalogLoadedCallback = (catalog: PreviewCatalogEntries) => void;

/**
 * Watches the game material catalog. Every check reads the catalog counters;
 * when the catalog or one of its textures changed, the materials are loaded
 * again and handed to the callback.
 */
export class PreviewLinkCatalogChannel extends PreviewLinkChannel {
  private readonly transport: PreviewLinkTransport;
  private readonly onCatalogLoaded: PreviewCatalogLoadedCallback;
  private loadedVersion: string | null = null;
  private nextCheckMilliseconds = 0;
  private readonly gameMaterialIdentifiers = new Set<string>();

  /**
   * Creates a catalog channel.
   *
   * @param transport Bridge transport.
   * @param onCatalogLoaded Receives every newly loaded catalog.
   * @param listener Receives request outcomes.
   */
  constructor(
    transport: PreviewLinkTransport,
    onCatalogLoaded: PreviewCatalogLoadedCallback,
    listener: PreviewLinkChannelListener,
  ) {
    super(listener);
    this.transport = transport;
    this.onCatalogLoaded = onCatalogLoaded;
  }

  /**
   * Checks the catalog when the check interval elapsed.
   *
   * @param nowMilliseconds Current time.
   * @returns A promise settling after the check, or null when no check was due.
   */
  checkIfDue(nowMilliseconds: number): Promise<void> | null {
    if (nowMilliseconds < this.nextCheckMilliseconds || this.isBusy()) {
      return null;
    }
    this.nextCheckMilliseconds = nowMilliseconds + PREVIEW_CATALOG_INTERVAL_MILLISECONDS;
    return this.requestRun(() => this.catalogCheck());
  }

  /** Forgets the loaded catalog so the next check loads it again. */
  reloadRequest(): void {
    this.loadedVersion = null;
    this.nextCheckMilliseconds = 0;
  }

  /**
   * Returns whether an identity names a material of the loaded game catalog.
   *
   * @param materialIdentifier Material or texture identity.
   * @returns True for game materials.
   */
  isGameMaterial(materialIdentifier: string): boolean {
    return this.gameMaterialIdentifiers.has(materialIdentifier);
  }

  /** Loads the catalog again when its counters changed. */
  private async catalogCheck(): Promise<void> {
    const reply = await PreviewCatalogEntryLoader.catalogFetch(this.transport);
    const version = `${reply.generation}:${reply.texture_generation ?? 0}`;
    if (version === this.loadedVersion) {
      return;
    }
    const catalog = await PreviewCatalogEntryLoader.load(this.transport);
    this.loadedVersion = `${catalog.generation}:${catalog.textureGeneration}`;
    this.gameMaterialIdentifiers.clear();
    catalog.entries.forEach((entry) => this.gameMaterialIdentifiers.add(entry.id));
    this.onCatalogLoaded(catalog);
  }
}
