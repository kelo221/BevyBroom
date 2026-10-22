import { ObjectDataContributorGameComponents } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import { ObjectDataContributorLayers } from '@/layer/persistence/object_data_contributor_layers.js';
import type { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { ObjectDataContributorPortalCells } from '@/portal/export/object_data_contributor_portal_cells.js';
import { ObjectDataContributorPreviewEntitySettings } from '@/preview/state/object_data_contributor_preview_entity_settings.js';
import { ObjectDataContributorProjectLink } from '@/project/document/object_data_contributor_project_link.js';

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
    new ObjectDataContributorGameComponents(),
    new ObjectDataContributorLayers(),
    new ObjectDataContributorProjectLink(),
  ];
}
