import { GameEntityClassProviderPreview } from '@/game_entity/class/game_entity_class_provider_preview.js';
import { gameEntityClassListFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import type {
  PreviewLinkChannelGenerationCheck,
  PreviewLinkChannelListener,
} from '@/preview/link/preview_link_channel.js';
import { PreviewLinkFeatureChannel } from '@/preview/link/preview_link_feature_channel.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { type PreviewBridgeStatus, PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';

/** Time between class list checks. */
export const GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS = 2000;

/** Longest wait for the class list reply. */
const GAME_ENTITY_CLASS_TIMEOUT_MILLISECONDS = 5000;

/**
 * Watches the game's placeable component classes and hands every changed list
 * to the preview class provider.
 */
export class GameEntityPreviewClassChannel extends PreviewLinkFeatureChannel {
  private readonly transport: PreviewLinkTransport;
  private readonly provider: GameEntityClassProviderPreview;
  private loadedVersion: string | null = null;
  private nextCheckMilliseconds = 0;

  /**
   * Creates the channel.
   *
   * @param transport Bridge transport.
   * @param listener Receives request outcomes.
   * @param provider Receives the class lists; the shared preview provider by
   *   default.
   */
  constructor(
    transport: PreviewLinkTransport,
    listener: PreviewLinkChannelListener,
    provider: GameEntityClassProviderPreview = GameEntityClassProviderPreview.shared,
  ) {
    super(listener);
    this.transport = transport;
    this.provider = provider;
  }

  /**
   * Checks the class list when the check interval elapsed.
   *
   * @param nowMilliseconds Current time.
   * @returns The started request, or null when no check was due.
   */
  tickIfDue(nowMilliseconds: number): Promise<void> | null {
    if (nowMilliseconds < this.nextCheckMilliseconds || this.isBusy()) {
      return null;
    }
    this.nextCheckMilliseconds = nowMilliseconds + GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS;
    return this.requestRun((isCurrent) => this.classesFetch(isCurrent));
  }

  /**
   * Switches the provider to the new game's project and loads its classes on
   * the next tick.
   *
   * @param status First status of the new game process.
   */
  gameInstanceAdopt(status: PreviewBridgeStatus): void {
    this.provider.projectAdopt(status.project_id);
    this.loadedVersion = null;
    this.nextCheckMilliseconds = 0;
  }

  /**
   * Fetches the class list and hands it on when its counters changed; a list
   * that arrives after the game was replaced is dropped.
   *
   * @param isCurrent Tells whether the request still belongs to the current
   *   game.
   */
  private async classesFetch(isCurrent: PreviewLinkChannelGenerationCheck): Promise<void> {
    const reply = await this.transport.call<unknown>(
      PREVIEW_METHOD.placeableClasses,
      null,
      GAME_ENTITY_CLASS_TIMEOUT_MILLISECONDS,
    );
    const list = gameEntityClassListFromUnknown(reply);
    if (!list) {
      throw new Error('The game sent an unreadable component class list');
    }
    const version = `${list.generation}:${list.asset_generation}`;
    if (!isCurrent() || version === this.loadedVersion) {
      return;
    }
    this.loadedVersion = version;
    this.provider.listWrite(list);
  }
}
