import { brushResizeRadiusCompute, type BrushResizeRadiusLimits } from './brush_resize_radius.js';

/**
 * One drag that resizes a paint brush: horizontal pointer travel since the
 * press changes the radius the brush stores. Subclasses name where the radius
 * is read from and written to.
 */
export abstract class BrushResizeSession {
  private readonly startClientX: number;
  private readonly startRadius: number;
  private readonly limits: BrushResizeRadiusLimits;

  /**
   * Starts resizing at a press.
   *
   * @param startClientX Press client X.
   * @param startRadius Brush radius in meters at the press.
   * @param limits Smallest and largest radius the brush may take.
   */
  protected constructor(startClientX: number, startRadius: number, limits: BrushResizeRadiusLimits) {
    this.startClientX = startClientX;
    this.startRadius = startRadius;
    this.limits = limits;
  }

  /**
   * Sets the brush radius for the pointer's horizontal travel since the press
   * when it differs from the stored radius.
   *
   * @param clientX Current pointer client X.
   */
  pointerUpdate(clientX: number): void {
    const radius = brushResizeRadiusCompute(this.startRadius, clientX - this.startClientX, this.limits);
    if (radius !== this.radiusRead()) {
      this.radiusWrite(radius);
    }
  }

  /**
   * Returns the radius the brush stores now.
   *
   * @returns Radius in meters.
   */
  protected abstract radiusRead(): number;

  /**
   * Stores a new brush radius.
   *
   * @param radius Radius in meters.
   */
  protected abstract radiusWrite(radius: number): void;
}
