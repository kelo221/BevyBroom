/**
 * Returns whether two lists hold the same items, compared by identity, in the
 * same order.
 *
 * @param first First list.
 * @param second Second list.
 * @returns True when both lists match item for item.
 */
export function listItemsIdentical<Item>(first: readonly Item[], second: readonly Item[]): boolean {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}
