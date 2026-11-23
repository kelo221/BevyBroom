import * as THREE from 'three';
import { hexToCssHex } from '@/utils/utils_color.js';

/** UserData key holding the text a text plane shows. */
export const ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY = 'entityVisualTextPlaneText';

/** Pixel height of the font drawn into a text plane's canvas. */
const ENTITY_VISUAL_TEXT_PLANE_FONT_PIXELS = 48;

/** Pixels of backing plate around the text on each side. */
const ENTITY_VISUAL_TEXT_PLANE_PADDING_PIXELS = 12;

/**
 * Width of one character, as a share of the font height, when text cannot be
 * measured.
 */
const ENTITY_VISUAL_TEXT_PLANE_CHARACTER_WIDTH_SHARE = 0.6;

/** Look and room of one text plane. */
export interface EntityVisualTextPlaneOptions {
  /** Largest width, in meters, the plane may take. */
  maximumWidth: number;
  /** Largest height, in meters, the plane may take. */
  maximumHeight: number;
  textColorHex: number;
  backColorHex: number;
  /** Opacity of the backing plate, zero to one. */
  backOpacity: number;
}

/** Canvas holding drawn text and its size in pixels. */
interface EntityVisualTextPlaneCanvas {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Builds flat editor-only text: a plane in its local XY plane, reading along
 * +X, showing text on a backing plate, sized to fit a width and height while
 * keeping the text's proportions.
 */
export class EntityVisualTextPlane {
  /**
   * Creates a text plane.
   *
   * @param text Text to show.
   * @param options Room and colors.
   * @returns Unpickable mesh holding the text in its userData.
   */
  static create(text: string, options: EntityVisualTextPlaneOptions): THREE.Mesh {
    const drawn = EntityVisualTextPlane.canvasDraw(text, options);
    const size = EntityVisualTextPlane.sizeFit(drawn.width / drawn.height, options);
    const texture = new THREE.CanvasTexture(drawn.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.width, size.height), material);
    mesh.userData[ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY] = text;
    mesh.raycast = () => undefined;
    return mesh;
  }

  /**
   * Returns the size of a plane with the given proportions that fits the room.
   *
   * @param aspect Width divided by height of the drawn text.
   * @param options Room of the plane.
   * @returns Width and height in meters.
   */
  static sizeFit(aspect: number, options: EntityVisualTextPlaneOptions): { width: number; height: number } {
    const height = Math.max(0, Math.min(options.maximumHeight, options.maximumWidth / aspect));
    return { width: height * aspect, height };
  }

  /**
   * Draws the text on its backing plate into a new canvas.
   *
   * @param text Text to draw.
   * @param options Colors.
   * @returns Canvas and its pixel size; the size is estimated when the page
   *   cannot draw text.
   */
  private static canvasDraw(text: string, options: EntityVisualTextPlaneOptions): EntityVisualTextPlaneCanvas {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d') ?? null;
    const font = `bold ${ENTITY_VISUAL_TEXT_PLANE_FONT_PIXELS}px sans-serif`;
    const textWidth = EntityVisualTextPlane.textWidthMeasure(context, font, text);
    canvas.width = Math.ceil(textWidth + ENTITY_VISUAL_TEXT_PLANE_PADDING_PIXELS * 2);
    canvas.height = ENTITY_VISUAL_TEXT_PLANE_FONT_PIXELS + ENTITY_VISUAL_TEXT_PLANE_PADDING_PIXELS * 2;
    if (context !== null) {
      EntityVisualTextPlane.canvasPaint(context, canvas, font, text, options);
    }
    return { canvas, width: canvas.width, height: canvas.height };
  }

  /**
   * Returns the pixel width of text in a font.
   *
   * @param context Canvas context, or null when the page cannot draw text.
   * @param font CSS font.
   * @param text Text to measure.
   * @returns Measured width, or an estimate from the character count.
   */
  private static textWidthMeasure(context: CanvasRenderingContext2D | null, font: string, text: string): number {
    if (context === null) {
      return text.length * ENTITY_VISUAL_TEXT_PLANE_FONT_PIXELS * ENTITY_VISUAL_TEXT_PLANE_CHARACTER_WIDTH_SHARE;
    }
    context.font = font;
    return Math.max(1, context.measureText(text).width);
  }

  /**
   * Paints the backing plate and the centered text.
   *
   * @param context Canvas context.
   * @param canvas Canvas sized for the text.
   * @param font CSS font.
   * @param text Text to paint.
   * @param options Colors.
   */
  private static canvasPaint(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    font: string,
    text: string,
    options: EntityVisualTextPlaneOptions,
  ): void {
    context.globalAlpha = options.backOpacity;
    context.fillStyle = hexToCssHex(options.backColorHex);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
    context.font = font;
    context.fillStyle = hexToCssHex(options.textColorHex);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
}
