import * as THREE from 'three';

/** One cluster of items whose positions lie within the tolerance of its anchor. */
interface DisplacementSewPointCluster<Item> {
  anchor: THREE.Vector3;
  items: Item[];
}

/**
 * Groups items by world position with a distance tolerance. Positions are
 * hashed into cells as wide as the tolerance; a new position joins the nearest
 * cluster anchor within the tolerance found in its own or any neighboring cell,
 * so matching survives the rounding noise of rotated or scaled transforms.
 */
export class DisplacementSewPointClusters<Item> {
  private readonly cells = new Map<string, DisplacementSewPointCluster<Item>[]>();
  private readonly clusters: DisplacementSewPointCluster<Item>[] = [];

  /**
   * Creates an empty clustering.
   *
   * @param tolerance Largest distance, in meters, between matching positions.
   */
  constructor(private readonly tolerance: number) {}

  /**
   * Adds an item at a position to the nearest cluster within the tolerance, or
   * starts a new cluster there.
   *
   * @param position World position of the item.
   * @param item Item to store.
   */
  add(position: THREE.Vector3, item: Item): void {
    const nearest = this.nearestClusterFind(position);
    if (nearest) {
      nearest.items.push(item);
      return;
    }
    const cluster = { anchor: position.clone(), items: [item] };
    this.clusters.push(cluster);
    const key = this.cellKeyBuild(position, 0, 0, 0);
    this.cells.set(key, [...(this.cells.get(key) ?? []), cluster]);
  }

  /**
   * Returns the items of every cluster.
   *
   * @returns Item groups in creation order.
   */
  groupsRead(): Item[][] {
    return this.clusters.map((cluster) => cluster.items);
  }

  /**
   * Finds the cluster whose anchor is nearest to a position within the
   * tolerance, searching the position's cell and its 26 neighbors.
   *
   * @param position World position.
   * @returns Nearest cluster, or null when none is within the tolerance.
   */
  private nearestClusterFind(position: THREE.Vector3): DisplacementSewPointCluster<Item> | null {
    let nearest: DisplacementSewPointCluster<Item> | null = null;
    let nearestDistance = this.tolerance;
    for (const cluster of this.neighborClustersRead(position)) {
      const distance = cluster.anchor.distanceTo(position);
      if (distance <= nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  /**
   * Lists the clusters anchored in a position's cell and its 26 neighbors.
   *
   * @param position World position.
   * @returns Candidate clusters.
   */
  private neighborClustersRead(position: THREE.Vector3): DisplacementSewPointCluster<Item>[] {
    const candidates: DisplacementSewPointCluster<Item>[] = [];
    for (let stepX = -1; stepX <= 1; stepX += 1) {
      for (let stepY = -1; stepY <= 1; stepY += 1) {
        for (let stepZ = -1; stepZ <= 1; stepZ += 1) {
          candidates.push(...(this.cells.get(this.cellKeyBuild(position, stepX, stepY, stepZ)) ?? []));
        }
      }
    }
    return candidates;
  }

  /**
   * Builds the key of the cell a position falls in, shifted by whole cells.
   *
   * @param position World position.
   * @param stepX Cell shift along X.
   * @param stepY Cell shift along Y.
   * @param stepZ Cell shift along Z.
   * @returns Cell key.
   */
  private cellKeyBuild(position: THREE.Vector3, stepX: number, stepY: number, stepZ: number): string {
    const cellOf = (value: number): number => Math.floor(value / this.tolerance);
    return `${cellOf(position.x) + stepX},${cellOf(position.y) + stepY},${cellOf(position.z) + stepZ}`;
  }
}
