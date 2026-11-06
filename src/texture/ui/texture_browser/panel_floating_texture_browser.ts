import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import type { FaceInspector } from '@/texture/ui/face_inspector/face_inspector.js';

/**
 * Floating texture browser window hosting the face inspector: the current
 * material row and align presets above the material browser. The UV fields and
 * tools stay in the Face Edit Sheet, so this window hides them.
 */
export class PanelFloatingTextureBrowser extends PanelFloatingContentHost {
  private readonly faceInspector: FaceInspector;

  /**
   * Creates the texture browser window around the face inspector.
   *
   * @param host Parent element of floating windows.
   * @param faceInspector Face inspector shown in the window.
   */
  constructor(host: HTMLElement, faceInspector: FaceInspector) {
    super(
      host,
      {
        titleText: 'Texture Browser',
        className: 'panel-floating-texture-browser',
        width: '360px',
        height: '600px',
        corner: 'bottom-right',
        centered: true,
      },
      faceInspector.getElement(),
    );
    this.faceInspector = faceInspector;
    this.faceInspector.getFaceAttributesEditor().trsControlsVisibleSet(false);
  }

  /**
   * Returns the face inspector shown in the window.
   *
   * @returns Face inspector.
   */
  faceInspectorRead(): FaceInspector {
    return this.faceInspector;
  }
}
