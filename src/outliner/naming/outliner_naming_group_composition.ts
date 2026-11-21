import type * as THREE from 'three';
import { extractHierarchyNameBase } from '@/utils/utils_hierarchy_name_allocator.js';

/** Name base used when the members tell nothing about what the group holds. */
export const OUTLINER_NAMING_GROUP_FALLBACK_BASE = 'Group';

/** Most kinds of member named one by one before the rest are counted. */
const OUTLINER_NAMING_GROUP_LISTED_KIND_LIMIT = 2;

/** How many members share one name base, in the order the base first appears. */
interface OutlinerNamingGroupKindCount {
  /** Name base without the automatic id suffix, such as Box. */
  base: string;
  /** Number of members with that base. */
  count: number;
}

/**
 * Builds the name base of a new group from what it holds: one kind of member
 * gives "Box x4", two kinds "Box x2 + Light", more kinds name the two most
 * common and count the rest, as in "Box x3 + Light + 2 more".
 */
export class OutlinerNamingGroupComposition {
  /**
   * Returns the name base for a group of the given members.
   *
   * @param members Objects that become the group's children.
   * @returns Name base without an id suffix.
   */
  static nameBaseFromMembers(members: readonly THREE.Object3D[]): string {
    const kinds = OutlinerNamingGroupComposition.kindCountsMostCommonFirst(members);
    if (kinds.length === 0) {
      return OUTLINER_NAMING_GROUP_FALLBACK_BASE;
    }
    if (kinds.length === 1 && kinds[0]?.count === 1) {
      return `${kinds[0].base} ${OUTLINER_NAMING_GROUP_FALLBACK_BASE}`;
    }
    return OutlinerNamingGroupComposition.kindsJoin(kinds);
  }

  /**
   * Joins the most common kinds with their counts and counts the remaining
   * kinds.
   *
   * @param kinds Kinds, most common first.
   * @returns Joined name base.
   */
  private static kindsJoin(kinds: readonly OutlinerNamingGroupKindCount[]): string {
    const listed = kinds.slice(0, OUTLINER_NAMING_GROUP_LISTED_KIND_LIMIT).map((kind) => this.kindLabel(kind));
    const remainingKindCount = kinds.length - listed.length;
    if (remainingKindCount === 1) {
      listed.push(this.kindLabel(kinds[kinds.length - 1] ?? { base: '', count: 0 }));
    } else if (remainingKindCount > 1) {
      listed.push(`${remainingKindCount} more`);
    }
    return listed.join(' + ');
  }

  /**
   * Returns the label of one kind: its base, with the count when above one.
   *
   * @param kind Kind and how many members have it.
   * @returns Label such as Box x3 or Light.
   */
  private static kindLabel(kind: OutlinerNamingGroupKindCount): string {
    return kind.count > 1 ? `${kind.base} x${kind.count}` : kind.base;
  }

  /**
   * Counts the members per name base, most common first and ties in member
   * order.
   *
   * @param members Objects that become the group's children.
   * @returns Kinds with their member counts.
   */
  private static kindCountsMostCommonFirst(members: readonly THREE.Object3D[]): OutlinerNamingGroupKindCount[] {
    const countsByBase = new Map<string, OutlinerNamingGroupKindCount>();
    for (const member of members) {
      const base = OutlinerNamingGroupComposition.memberNameBase(member);
      const existing = countsByBase.get(base);
      if (existing) {
        existing.count += 1;
      } else {
        countsByBase.set(base, { base, count: 1 });
      }
    }
    return [...countsByBase.values()].sort((left, right) => right.count - left.count);
  }

  /**
   * Returns the name base of one member, or the fallback base for an unnamed
   * one.
   *
   * @param member Object that becomes a child of the group.
   * @returns Name base without the automatic id suffix.
   */
  private static memberNameBase(member: THREE.Object3D): string {
    const name = member.name.trim();
    return name.length > 0 ? extractHierarchyNameBase(name) : OUTLINER_NAMING_GROUP_FALLBACK_BASE;
  }
}
