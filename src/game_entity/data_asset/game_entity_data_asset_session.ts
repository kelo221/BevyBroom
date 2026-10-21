import type { GameEntityAssetType } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { gameEntityDataAssetPathMatches } from '@/game_entity/data_asset/game_entity_data_asset_class.js';
import type { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import type { PreviewComponentFields } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * One open data asset file: its type, path and the overrides it stores. Edits
 * are written to the game's file right away.
 */
export class GameEntityDataAssetSession {
  readonly assetType: GameEntityAssetType;
  readonly path: string;
  private readonly client: GameEntityDataAssetClient;
  private values: PreviewComponentFields;

  /**
   * Creates a session for already loaded overrides.
   *
   * @param assetType Asset type of the file.
   * @param path Asset path of the file.
   * @param client Client used for writes.
   * @param values Overrides the file stores.
   */
  private constructor(
    assetType: GameEntityAssetType,
    path: string,
    client: GameEntityDataAssetClient,
    values: PreviewComponentFields,
  ) {
    this.assetType = assetType;
    this.path = path;
    this.client = client;
    this.values = values;
  }

  /**
   * Reads an existing file.
   *
   * @param assetType Asset type the file must hold.
   * @param path Asset path of the file.
   * @param client Client used for the read and later writes.
   * @returns Session of the file.
   */
  static async open(
    assetType: GameEntityAssetType,
    path: string,
    client: GameEntityDataAssetClient,
  ): Promise<GameEntityDataAssetSession> {
    const reply = await client.read(path);
    if (reply.type_path !== assetType.type_path) {
      throw new Error(`${path} holds ${reply.type_path}, not ${assetType.type_path}`);
    }
    return new GameEntityDataAssetSession(assetType, path, client, reply.values);
  }

  /**
   * Creates a file holding the type's defaults.
   *
   * @param assetType Asset type of the new file.
   * @param path Asset path of the new file; it must end with a type extension.
   * @param client Client used for the write and later writes.
   * @returns Session of the new file.
   */
  static async create(
    assetType: GameEntityAssetType,
    path: string,
    client: GameEntityDataAssetClient,
  ): Promise<GameEntityDataAssetSession> {
    if (!gameEntityDataAssetPathMatches(assetType, path)) {
      throw new Error(`${path} must end with .${assetType.extensions.join(' or .')}`);
    }
    await client.write(path, assetType.type_path, {});
    return new GameEntityDataAssetSession(assetType, path, client, {});
  }

  /**
   * Returns the overrides as a component map keyed by the asset type path.
   *
   * @returns Independent component overrides.
   */
  componentsRead(): GameEntityComponents {
    return { [this.assetType.type_path]: structuredClone(this.values) };
  }

  /**
   * Applies an edit to the overrides and writes the file.
   *
   * @param edit Turns the current component map into the new one.
   * @returns Resolves once the game accepted the write.
   */
  async valuesEdit(edit: (components: GameEntityComponents) => GameEntityComponents): Promise<void> {
    const nextValues = edit(this.componentsRead())[this.assetType.type_path] ?? {};
    await this.client.write(this.path, this.assetType.type_path, nextValues);
    this.values = nextValues;
  }
}
