import { EntityOwner } from '@/entity/model/entity_owner.js';
import { RoomDefinition } from '@/portal/model/room_definition.js';
import type { RoomSettings } from '@/portal/model/room_settings.js';

/** Owner helper of authored room cells. */
export const RoomOwner = new EntityOwner<RoomSettings>(new RoomDefinition());
