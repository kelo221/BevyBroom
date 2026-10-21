import { EntityOwner } from '@/entity/model/entity_owner.js';
import { PortalDefinition } from '@/portal/model/portal_definition.js';
import type { PortalSettings } from '@/portal/model/portal_settings.js';

/** Owner helper of authored portals. */
export const PortalOwner = new EntityOwner<PortalSettings>(new PortalDefinition());
