import * as THREE from 'three';
import { SprinkleBrushVolume } from '@/tools/sprinkle/brush/sprinkle_brush_volume.js';
import { SprinkleGridCellEnumerator } from '@/tools/sprinkle/grid/sprinkle_grid_cell_enumerator.js';
import type { SprinkleGridCell } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import { SprinkleEntityFactory } from '@/tools/sprinkle/placement/sprinkle_entity_factory.js';
import { sprinkleOrientationCompute } from '@/tools/sprinkle/placement/sprinkle_orientation.js';
import { SprinklePlacementModeRules } from '@/tools/sprinkle/placement/sprinkle_placement_mode_rules.js';
import { SprinklePrng } from '@/tools/sprinkle/sprinkle_prng.js';
import type { SprinkleSurfaceHit } from '@/tools/sprinkle/sprinkle_types.js';
import { SprinkleCellOccupancy } from './sprinkle_cell_occupancy.js';
import { SprinkleStrokeEdits } from './sprinkle_stroke_edits.js';
import {
  sprinkleStrokeResultChangedIs,
  sprinkleStrokeResultEmpty,
  sprinkleStrokeResultSince,
  type SprinkleStrokeDeps,
  type SprinkleStrokeResult,
  type SprinkleStrokeSettings,
} from './sprinkle_stroke_types.js';

/** Most grid cells one dab may visit; finer grids for the radius are refused. */
export const SPRINKLE_DAB_CELL_LIMIT = 16384;

/**
 * One Sprinkle stroke from press to release. Every dab works inside the brush
 * volume around a surface point: modes that clear remove sprinkled entities
 * there, modes that place visit the grid cells whose centers lie in the radius,
 * each cell at most once per stroke, and place a weighted random case of the
 * definition with the density's chance where the cell projects onto a surface.
 * Finishing records all changes of the stroke as one undo step.
 */
export class SprinkleStroke {
  private readonly edits: SprinkleStrokeEdits;
  private readonly visitedCellKeys = new Set<string>();
  private readonly reportedTopics = new Set<string>();
  private readonly random: SprinklePrng;
  private isFinished = false;

  /**
   * Starts a stroke.
   *
   * @param deps Undo stack, world, surface projector and refresh services.
   * @param settings Definition, mode, brush and grid of the stroke.
   */
  constructor(
    private readonly deps: SprinkleStrokeDeps,
    private readonly settings: SprinkleStrokeSettings,
  ) {
    this.edits = new SprinkleStrokeEdits(deps.worldObject);
    this.random = new SprinklePrng(settings.seed);
  }

  /**
   * Applies one dab around a surface point and refreshes the editor when it
   * changed the scene.
   *
   * @param centerHit Surface point and normal under the brush center.
   * @returns Entities the dab added and removed.
   */
  dabApply(centerHit: SprinkleSurfaceHit): SprinkleStrokeResult {
    if (this.isFinished) {
      return sprinkleStrokeResultEmpty();
    }
    const before = this.edits.resultRead();
    const volume = new SprinkleBrushVolume(centerHit, this.settings.radius);
    if (SprinklePlacementModeRules.brushClearIs(this.settings.mode)) {
      this.brushClear(volume);
    }
    if (SprinklePlacementModeRules.placesIs(this.settings.mode)) {
      this.cellsPlace(volume);
    }
    const dabResult = sprinkleStrokeResultSince(this.edits.resultRead(), before);
    if (sprinkleStrokeResultChangedIs(dabResult)) {
      this.deps.afterWorldMutation();
    }
    return dabResult;
  }

  /**
   * Ends the stroke and records its changes as one undo step; a stroke without
   * changes records nothing. Later dabs do nothing.
   *
   * @returns Entities the whole stroke added and removed.
   */
  finish(): SprinkleStrokeResult {
    if (!this.isFinished) {
      this.isFinished = true;
      this.edits.commit(this.deps.commandStack);
    }
    return this.edits.resultRead();
  }

  /**
   * Removes the sprinkled entities inside the volume; REPLACE keeps the ones
   * this stroke placed.
   *
   * @param volume Dab volume.
   */
  private brushClear(volume: SprinkleBrushVolume): void {
    const keepStrokeEntities = this.settings.mode === 'REPLACE';
    const worldPosition = new THREE.Vector3();
    for (const entity of this.edits.sprinkledLiveRead()) {
      if (keepStrokeEntities && this.edits.isAddedByStroke(entity)) {
        continue;
      }
      if (volume.contains(entity.getWorldPosition(worldPosition))) {
        this.edits.entityRemove(entity);
      }
    }
  }

  /**
   * Visits every grid cell of the volume, or reports that the grid is too fine
   * for the radius.
   *
   * @param volume Dab volume.
   */
  private cellsPlace(volume: SprinkleBrushVolume): void {
    const circle = volume.circleRead();
    if (SprinkleGridCellEnumerator.cellCountEstimate(this.settings.grid, circle) > SPRINKLE_DAB_CELL_LIMIT) {
      this.reportOnce('grid', 'Sprinkle grid is too fine for the radius; raise the grid size or lower the radius');
      return;
    }
    const occupancy = new SprinkleCellOccupancy(this.edits.sprinkledLiveRead(), volume, this.settings.grid);
    const cells = SprinkleGridCellEnumerator.cellsInCircle(volume.plane, this.settings.grid, circle);
    cells.forEach((cell) => this.cellVisit(volume, occupancy, cell));
  }

  /**
   * Visits one cell once per stroke: places an entity when the mode allows the
   * cell, the density roll succeeds and the cell projects onto a surface, and
   * removes what the cell held before.
   *
   * @param volume Dab volume.
   * @param occupancy Sprinkled entities by cell.
   * @param cell Grid cell.
   */
  private cellVisit(volume: SprinkleBrushVolume, occupancy: SprinkleCellOccupancy, cell: SprinkleGridCell): void {
    if (this.visitedCellKeys.has(cell.key)) {
      return;
    }
    this.visitedCellKeys.add(cell.key);
    const occupants = occupancy.occupantsRead(cell.key);
    if (!SprinklePlacementModeRules.cellPlacementAllowedIs(this.settings.mode, occupants.length > 0)) {
      return;
    }
    if (!this.random.chancePercentRoll(this.settings.densityPercent)) {
      return;
    }
    const cellRay = volume.cellRayBuild(cell);
    const hit = this.deps.projector.project(cellRay.ray, cellRay.maxDistance);
    const entity = hit ? this.entityBuild(hit) : null;
    if (entity) {
      occupants.forEach((occupant) => this.edits.entityRemove(occupant));
      this.edits.entityAdd(entity);
    }
  }

  /**
   * Builds the entity of a weighted random case at a surface hit.
   *
   * @param hit Surface point and normal of the cell.
   * @returns New entity, or null when the case names no point class.
   */
  private entityBuild(hit: SprinkleSurfaceHit): THREE.Group | null {
    const definitionCase = this.random.pickWeighted(this.settings.definition.cases);
    if (!definitionCase) {
      return null;
    }
    const pointClass = SprinkleEntityFactory.pointClassResolve(definitionCase.className);
    if (!pointClass) {
      this.reportOnce(definitionCase.className, `Sprinkle: unknown entity class ${definitionCase.className}`);
      return null;
    }
    const quaternion = sprinkleOrientationCompute(hit.normal, this.settings, this.random);
    const placement = { position: hit.point, quaternion };
    const definitionName = this.settings.definition.name;
    return SprinkleEntityFactory.entityCreate(
      pointClass,
      definitionCase,
      definitionName,
      placement,
      this.deps.worldObject,
    );
  }

  /**
   * Shows a status message the first time a topic comes up in this stroke.
   *
   * @param topic Topic the message is about.
   * @param message Message text.
   */
  private reportOnce(topic: string, message: string): void {
    if (this.reportedTopics.has(topic)) {
      return;
    }
    this.reportedTopics.add(topic);
    this.deps.statusShow(message);
  }
}
