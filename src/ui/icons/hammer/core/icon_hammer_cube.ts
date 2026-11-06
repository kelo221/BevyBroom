import { IconHammerCubeGeometry, type IconHammerCubeLayout } from './icon_hammer_cube_geometry.js';
import { IconHammerGradient } from './icon_hammer_gradient.js';
import type { IconHammerIdScope } from './icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_OUTLINE, type IconHammerRamp } from './icon_hammer_palette.js';
import { IconHammerShape } from './icon_hammer_shape.js';

/** Paint of each visible face of an oblique cube. */
export interface IconHammerCubeFacePaints {
  readonly top: string;
  readonly front: string;
  readonly side: string;
}

/** Draws outlined oblique cubes shaded from the top left. */
export class IconHammerCube {
  /**
   * Draws a cube shaded with one colour family: light top, graded front and
   * dark side, with a bright bevel along the lit front edges.
   *
   * @param scope Id scope of the icon being rendered.
   * @param localName Name prefix unique within the icon.
   * @param layout Pixel placement of the cube.
   * @param ramp Colour family.
   * @returns Cube markup.
   */
  static shaded(
    scope: IconHammerIdScope,
    localName: string,
    layout: IconHammerCubeLayout,
    ramp: IconHammerRamp,
  ): string {
    const geometry = new IconHammerCubeGeometry(layout);
    const front = IconHammerGradient.linear(scope, `${localName}-front`, ramp.base, ramp.dark, 'diagonal');
    const top = IconHammerGradient.linear(scope, `${localName}-top`, ramp.light, ramp.base, 'horizontal');
    const faces = IconHammerCube.faces(geometry, { top: top.paint, front: front.paint, side: ramp.dark });
    return front.defs + top.defs + faces + IconHammerCube.bevel(geometry);
  }

  /**
   * Draws a cube whose three faces use one flat paint each.
   *
   * @param layout Pixel placement of the cube.
   * @param paints Paint of each face.
   * @param stroke Outline colour.
   * @returns Cube markup.
   */
  static flat(
    layout: IconHammerCubeLayout,
    paints: IconHammerCubeFacePaints,
    stroke: string = ICON_HAMMER_OUTLINE,
  ): string {
    return IconHammerCube.faces(new IconHammerCubeGeometry(layout), paints, stroke);
  }

  /**
   * Draws the three outlined faces of a cube.
   *
   * @param geometry Cube corners.
   * @param paints Paint of each face.
   * @param stroke Outline colour.
   * @returns Face markup.
   */
  static faces(
    geometry: IconHammerCubeGeometry,
    paints: IconHammerCubeFacePaints,
    stroke: string = ICON_HAMMER_OUTLINE,
  ): string {
    return (
      IconHammerShape.polygon(geometry.frontPoints(), paints.front, stroke) +
      IconHammerShape.polygon(geometry.topPoints(), paints.top, stroke) +
      IconHammerShape.polygon(geometry.sidePoints(), paints.side, stroke)
    );
  }

  /**
   * Draws the bright one pixel bevel inside the top and left edges of the front
   * face.
   *
   * @param geometry Cube corners.
   * @returns Bevel markup.
   */
  static bevel(geometry: IconHammerCubeGeometry): string {
    const box = geometry.frontBox();
    const inset = box.left + 1.5;
    const insetTop = box.top + 1.5;
    const far = box.left + box.size - 2;
    const pathData = `M${inset} ${box.top + box.size - 2}V${insetTop}H${far}`;
    return `<path d="${pathData}" fill="none" stroke="${ICON_HAMMER_HIGHLIGHT}" stroke-opacity="0.55" stroke-width="1"/>`;
  }

  /**
   * Draws the visible and hidden edges of a cube without fills.
   *
   * @param layout Pixel placement of the cube.
   * @param edgeColor Colour of the visible edges.
   * @param hiddenColor Colour of the dashed hidden edges.
   * @returns Wireframe markup.
   */
  static wireframe(layout: IconHammerCubeLayout, edgeColor: string, hiddenColor: string): string {
    const geometry = new IconHammerCubeGeometry(layout);
    const hidden = IconHammerShape.strokeDashed(geometry.hiddenEdgesPathData(), hiddenColor, '2 1');
    return hidden + IconHammerCube.faces(geometry, { top: 'none', front: 'none', side: 'none' }, edgeColor);
  }
}
