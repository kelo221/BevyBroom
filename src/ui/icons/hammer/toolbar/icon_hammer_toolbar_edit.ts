import { IconHammerArrow } from '../core/icon_hammer_arrow.js';
import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the history and clipboard toolbar icons. */
export type IconHammerToolbarEditName =
  'edit_undo' | 'edit_redo' | 'edit_copy' | 'edit_paste' | 'edit_delete' | 'edit_duplicate';

/** Toolbar icons for undo, redo, clipboard, delete and duplicate. */
export class IconHammerToolbarEdit extends IconHammerGroup<IconHammerToolbarEditName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarEditName, IconHammerDrawer>> {
    return {
      edit_undo: () => this.undoArrow(),
      edit_redo: () => IconHammerShape.group(this.undoArrow(), 'matrix(-1 0 0 1 32 0)'),
      edit_copy: (scope) => this.copy(scope),
      edit_paste: (scope) => this.paste(scope),
      edit_delete: () => this.deleteCross(),
      edit_duplicate: (scope) => this.duplicate(scope),
    };
  }

  /**
   * Draws the blue arrow curving up and back to the left.
   *
   * @returns Icon markup.
   */
  private undoArrow(): string {
    const shaft = 'M26 27C26 18 21 12 12 12';
    return IconHammerArrow.curved(shaft, { x: 12, y: 12 }, { x: -1, y: 0 }, ICON_HAMMER_RAMPS.blue.base, 4);
  }

  /**
   * Draws a white page with blue text lines.
   *
   * @param paint Page fill paint.
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @returns Page markup.
   */
  private page(paint: string, left: number, top: number): string {
    const lines = `M${left + 3} ${top + 4.5}h8M${left + 3} ${top + 7.5}h10M${left + 3} ${top + 10.5}h7M${left + 3} ${top + 13.5}h9`;
    return (
      IconHammerShape.rect(left, top, 16, 19, paint) +
      IconHammerShape.stroke(lines, ICON_HAMMER_RAMPS.blue.base, 1, 'butt')
    );
  }

  /**
   * Draws two overlapping pages.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private copy(scope: IconHammerIdScope): string {
    const paper = IconHammerGradient.rampLit(scope, 'paper', ICON_HAMMER_RAMPS.white);
    return paper.defs + this.page(paper.paint, 3, 2) + this.page(paper.paint, 13, 11);
  }

  /**
   * Draws a wooden clipboard with a steel clip and a page on it.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private paste(scope: IconHammerIdScope): string {
    const board = IconHammerGradient.rampLit(scope, 'board', ICON_HAMMER_RAMPS.wood);
    const paper = IconHammerGradient.rampLit(scope, 'paper', ICON_HAMMER_RAMPS.white);
    const clipboard = IconHammerShape.rect(3, 4, 20, 26, board.paint);
    const clip = IconHammerShape.rect(8, 2, 10, 5, ICON_HAMMER_RAMPS.steel.light);
    return board.defs + paper.defs + clipboard + clip + this.page(paper.paint, 13, 11);
  }

  /**
   * Draws the red delete cross.
   *
   * @returns Icon markup.
   */
  private deleteCross(): string {
    return IconHammerShape.band('M8 8L24 24M24 8L8 24', ICON_HAMMER_RAMPS.red.base, 5, 'round');
  }

  /**
   * Draws a blue cube with an orange copy of it in front.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private duplicate(scope: IconHammerIdScope): string {
    const back = IconHammerCube.shaded(
      scope,
      'original',
      { left: 2, top: 2, size: 14, depth: 6 },
      ICON_HAMMER_RAMPS.blue,
    );
    const front = IconHammerCube.shaded(
      scope,
      'copy',
      { left: 10, top: 10, size: 14, depth: 6 },
      ICON_HAMMER_RAMPS.orange,
    );
    return back + front;
  }
}
