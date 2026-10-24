import type { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { IssueProviderSolidBrushInvalid } from '@/info_panel/issues/providers/issue_provider_solid_brush_invalid.js';
import { IssueProviderSolidModelWarnings } from '@/info_panel/issues/providers/issue_provider_solid_model_warnings.js';
import { IssueProviderGameComponentUnknown } from '@/info_panel/issues/providers/issue_provider_game_component_unknown.js';
import { IssueProviderGameComponentOnBrush } from '@/info_panel/issues/providers/issue_provider_game_component_on_brush.js';
import { IssueProviderFaceUvScale } from '@/info_panel/issues/providers/issue_provider_face_uv_scale.js';
import { IssueProviderProjectBuild } from '@/project/issues/issue_provider_project_build.js';

/**
 * Returns the issue providers the editor ships with, in report order.
 *
 * @returns Built-in providers.
 */
export function issueProvidersBuiltin(): readonly IssueProvider[] {
  return [
    new IssueProviderSolidBrushInvalid(),
    new IssueProviderSolidModelWarnings(),
    new IssueProviderGameComponentUnknown(),
    new IssueProviderGameComponentOnBrush(),
    new IssueProviderFaceUvScale(),
    new IssueProviderProjectBuild(),
  ];
}
