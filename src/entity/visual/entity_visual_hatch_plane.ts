import * as THREE from 'three';

/** Pixel size of the square repeating stripe tile. */
const ENTITY_VISUAL_HATCH_TILE_PIXELS = 32;

/** Pixel width of the stripe in one tile, measured along a tile edge. */
const ENTITY_VISUAL_HATCH_STRIPE_PIXELS = 12;

/** UserData flag on hatch planes. */
export const ENTITY_VISUAL_HATCH_PLANE_KEY = 'isEntityVisualHatchPlane';

/**
 * Builds flat editor-only diagonal stripes, such as the hatching of a blocked
 * area: a plane in its local XY plane repeating one stripe tile every
 * `stripeSpacing` meters.
 */
export class EntityVisualHatchPlane {
  private static stripeTexture: THREE.DataTexture | null = null;

  /**
   * Creates a hatch plane.
   *
   * @param width Width in meters along local X.
   * @param height Height in meters along local Y.
   * @param stripeSpacing Meters from one stripe to the next.
   * @param colorHex Stripe color as an sRGB hex number.
   * @returns Unpickable hatch mesh.
   */
  static create(width: number, height: number, stripeSpacing: number, colorHex: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height);
    EntityVisualHatchPlane.uvRepeatApply(geometry, width / stripeSpacing, height / stripeSpacing);
    const material = new THREE.MeshBasicMaterial({
      map: EntityVisualHatchPlane.stripeTextureShared(),
      color: new THREE.Color().setHex(colorHex, THREE.SRGBColorSpace),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData[ENTITY_VISUAL_HATCH_PLANE_KEY] = true;
    mesh.raycast = () => undefined;
    return mesh;
  }

  /**
   * Scales the plane's texture coordinates so the tile repeats.
   *
   * @param geometry Plane geometry with coordinates from zero to one.
   * @param repeatX Tile repeats along X.
   * @param repeatY Tile repeats along Y.
   */
  private static uvRepeatApply(geometry: THREE.BufferGeometry, repeatX: number, repeatY: number): void {
    const uv = geometry.getAttribute('uv');
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, uv.getX(index) * repeatX, uv.getY(index) * repeatY);
    }
    uv.needsUpdate = true;
  }

  /**
   * Returns the shared white diagonal stripe tile, creating it once.
   *
   * @returns Repeating stripe texture with transparent gaps.
   */
  static stripeTextureShared(): THREE.DataTexture {
    if (EntityVisualHatchPlane.stripeTexture === null) {
      EntityVisualHatchPlane.stripeTexture = EntityVisualHatchPlane.stripeTextureCreate();
    }
    return EntityVisualHatchPlane.stripeTexture;
  }

  /**
   * Creates the stripe tile: opaque white where a pixel lies on the stripe,
   * clear elsewhere.
   *
   * @returns Repeating stripe texture.
   */
  private static stripeTextureCreate(): THREE.DataTexture {
    const size = ENTITY_VISUAL_HATCH_TILE_PIXELS;
    const pixels = new Uint8Array(size * size * 4);
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const isStripe = (row + column) % size < ENTITY_VISUAL_HATCH_STRIPE_PIXELS;
        pixels.set(isStripe ? [255, 255, 255, 255] : [255, 255, 255, 0], (row * size + column) * 4);
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
}
