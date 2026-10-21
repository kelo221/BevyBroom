import type { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { IssueProviderSolidBrushInvalid } from '@/info_panel/issues/providers/issue_provider_solid_brush_invalid.js';
import { IssueProviderSolidModelWarnings } from '@/info_panel/issues/providers/issue_provider_solid_model_warnings.js';
import { IssueProviderGameComponentUnknown } from '@/info_panel/issues/providers/issue_provider_game_component_unknown.js';

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
  ];
}
