import type { SelectionQuery, SelectionQueryId } from './selection_query.js';
import { SelectionQueryInverse } from './selection_query_inverse.js';
import { SelectionQuerySiblings } from './selection_query_siblings.js';
import { SelectionQueryTouching } from './selection_query_touching.js';
import { SelectionQueryInside } from './selection_query_inside.js';
import { SelectionQueryTall } from './selection_query_tall.js';
import { SelectionQueryByMaterial } from './selection_query_by_material.js';

/** Every selection query in menu order. */
const SELECTION_QUERIES: readonly SelectionQuery[] = [
  new SelectionQueryInverse(),
  new SelectionQuerySiblings(),
  new SelectionQueryTouching(),
  new SelectionQueryInside(),
  new SelectionQueryTall(),
  new SelectionQueryByMaterial(),
];

/**
 * Lists every selection query in menu order.
 *
 * @returns Selection queries.
 */
export function selectionQueriesList(): readonly SelectionQuery[] {
  return SELECTION_QUERIES;
}

/**
 * Finds a selection query by id.
 *
 * @param id Query identifier.
 * @returns Query, or null when the id is unknown.
 */
export function selectionQueryFind(id: SelectionQueryId): SelectionQuery | null {
  return SELECTION_QUERIES.find((query) => query.id === id) ?? null;
}
