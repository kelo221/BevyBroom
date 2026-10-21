import { gameEntityRecordIs } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import type {
  PreviewDataAssetReadReply,
  PreviewDataAssetWriteReply,
  PreviewDataAssetWriteRequest,
} from '@/preview/protocol/preview_protocol_data_asset_types.js';
import type { PreviewComponentFields } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';

/** Longest wait for a data asset reply. */
const GAME_ENTITY_DATA_ASSET_TIMEOUT_MILLISECONDS = 5000;

/**
 * Reads and writes data asset files through the running game. The newest
 * preview link registers its client as the active one.
 */
export class GameEntityDataAssetClient {
  private static active: GameEntityDataAssetClient | null = null;
  private readonly transport: PreviewLinkTransport;

  /**
   * Creates a client.
   *
   * @param transport Bridge transport of one preview link.
   */
  constructor(transport: PreviewLinkTransport) {
    this.transport = transport;
  }

  /**
   * Makes a client the one editor features use.
   *
   * @param client Client of the newest preview link, or null to forget it.
   */
  static activeAdopt(client: GameEntityDataAssetClient | null): void {
    GameEntityDataAssetClient.active = client;
  }

  /**
   * Returns the client editor features use.
   *
   * @returns Active client, or null before a preview link exists.
   */
  static activeRead(): GameEntityDataAssetClient | null {
    return GameEntityDataAssetClient.active;
  }

  /**
   * Reads the type and overrides of a data asset file.
   *
   * @param path Asset path of the file.
   * @returns The file's type and overrides.
   */
  async read(path: string): Promise<PreviewDataAssetReadReply> {
    const reply = await this.transport.call<unknown>(
      PREVIEW_METHOD.dataAssetRead,
      { path },
      GAME_ENTITY_DATA_ASSET_TIMEOUT_MILLISECONDS,
    );
    return GameEntityDataAssetClient.readReplyFromUnknown(reply);
  }

  /**
   * Replaces a data asset file with new overrides, creating it when missing.
   *
   * @param path Asset path of the file.
   * @param typePath Asset type path the file holds.
   * @param values Fields that differ from the type's default.
   * @returns The status generation that shows the write is done.
   */
  async write(path: string, typePath: string, values: PreviewComponentFields): Promise<number> {
    const request: PreviewDataAssetWriteRequest = { path, type_path: typePath, values };
    const reply = await this.transport.call<PreviewDataAssetWriteReply>(
      PREVIEW_METHOD.dataAssetWrite,
      request,
      GAME_ENTITY_DATA_ASSET_TIMEOUT_MILLISECONDS,
    );
    return typeof reply.generation === 'number' ? reply.generation : 0;
  }

  /**
   * Reads an untrusted read reply.
   *
   * @param reply Any value.
   * @returns Sanitized reply.
   */
  private static readReplyFromUnknown(reply: unknown): PreviewDataAssetReadReply {
    if (!gameEntityRecordIs(reply) || typeof reply['path'] !== 'string' || typeof reply['type_path'] !== 'string') {
      throw new Error('The game sent an unreadable data asset');
    }
    return {
      path: reply['path'],
      type_path: reply['type_path'],
      values: GameEntityComponentStore.fieldsFromUnknown(reply['values']),
    };
  }
}
