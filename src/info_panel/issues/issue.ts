import type { InfoPanelSeverity } from '@/info_panel/info_panel_severity.js';

/** Importance of an issue. */
export type IssueSeverity = Extract<InfoPanelSeverity, 'warning' | 'error'>;

/** One problem found in the open map. */
export interface Issue {
  /** Identifier stable across validation runs while the problem stays. */
  readonly id: string;
  /** Importance of the problem. */
  readonly severity: IssueSeverity;
  /** Uuid of the scene object to select for the problem, or null. */
  readonly objectUuid: string | null;
  /** Display name of the object the problem is about. */
  readonly objectName: string;
  /** Explanation of the problem. */
  readonly description: string;
  /** Identifier of the provider that found the problem. */
  readonly providerId: string;
}

/** Fields a provider gives when reporting an issue; the rest is derived. */
export interface IssueFields {
  /** Importance of the problem. */
  readonly severity: IssueSeverity;
  /** Uuid of the scene object to select for the problem, or null. */
  readonly objectUuid: string | null;
  /** Display name of the object the problem is about. */
  readonly objectName: string;
  /** Explanation of the problem. */
  readonly description: string;
}

/**
 * Creates an issue whose identifier is derived from its provider, object and
 * description so it stays the same across validation runs.
 *
 * @param providerId Identifier of the reporting provider.
 * @param fields What the provider reports.
 * @returns The issue.
 */
export function issueCreate(providerId: string, fields: IssueFields): Issue {
  return {
    id: `${providerId}|${fields.objectUuid ?? ''}|${fields.description}`,
    severity: fields.severity,
    objectUuid: fields.objectUuid,
    objectName: fields.objectName,
    description: fields.description,
    providerId,
  };
}
