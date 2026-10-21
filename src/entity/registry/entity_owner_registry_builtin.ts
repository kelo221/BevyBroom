import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/**
 * Returns the owner helpers of every entity kind the editor ships with.
 *
 * @returns Owner helpers in lookup order.
 */
export function entityOwnersBuiltinList(): readonly EntityOwner<object>[] {
  return [LightOwner, RoomOwner, PortalOwner, GameEntityOwner];
}
