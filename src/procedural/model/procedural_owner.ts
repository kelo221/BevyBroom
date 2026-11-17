import { EntityOwner } from '@/entity/model/entity_owner.js';
import { ProceduralDefinition } from '@/procedural/model/procedural_definition.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/** Owner helper of procedural objects. */
export const ProceduralOwner = new EntityOwner<ProceduralSettings>(new ProceduralDefinition());
