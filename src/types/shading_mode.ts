/**
 * The five available viewport shading modes. SOLID: Standard material rendering
 * with colors. WIREFRAME: Hides surface fill so only decorative edge outlines
 * remain. FLAT: Renders all meshes with unlit full-brightness albedo.
 * WIREFRAME_OVERLAY: Solid rendering with an orange wireframe edge overlay.
 * LIT: Content lit only by the authored point and spot lights, approximating
 * the game renderer.
 */
export enum ShadingMode {
  SOLID = 'Solid',
  WIREFRAME = 'Wireframe',
  FLAT = 'Flat',
  WIREFRAME_OVERLAY = 'Wireframe Overlay',
  LIT = 'Lit',
}
