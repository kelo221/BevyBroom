import { ObjectDataContributorDisplacementCollision } from '@/displacement/export/object_data_contributor_displacement_collision.js';
import { ObjectDataContributorGameComponents } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import { ObjectDataContributorGameLogic } from '@/game_entity/contributors/object_data_contributor_game_logic.js';
import { ObjectDataContributorLightNodes } from '@/light/export/object_data_contributor_light_nodes.js';
import { ObjectDataContributorLayers } from '@/layer/persistence/object_data_contributor_layers.js';
import type { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { ObjectDataContributorPortalCells } from '@/portal/export/object_data_contributor_portal_cells.js';
import { ObjectDataContributorPreviewEntitySettings } from '@/preview/state/object_data_contributor_preview_entity_settings.js';
import { ObjectDataContributorProjectLink } from '@/project/document/object_data_contributor_project_link.js';
import { ObjectDataContributorPolygonOutline } from '@/tools/polygon/object_data_contributor_polygon_outline.js';
import { ObjectDataContributorSprinkleMark } from '@/tools/sprinkle/mark/object_data_contributor_sprinkle_mark.js';

/**
 * Creates the object data contributors the editor ships with, in the order they
 * run.
 *
 * @returns New contributor instances.
 */
export function objectDataContributorsBuiltinCreate(): readonly ObjectDataContributor[] {
  return [
    new ObjectDataContributorPreviewEntitySettings(),
    new ObjectDataContributorPortalCells(),
    new ObjectDataContributorLightNodes(),
    new ObjectDataContributorGameComponents(),
    new ObjectDataContributorGameLogic(),
    new ObjectDataContributorPolygonOutline(),
    new ObjectDataContributorSprinkleMark(),
    new ObjectDataContributorLayers(),
    new ObjectDataContributorProjectLink(),
    new ObjectDataContributorDisplacementCollision(),
  ];
}
