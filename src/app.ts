import { ManagerViewportLayout } from '@/layout/viewport/manager_viewport_layout.js';
import { showErrorEditorStartup } from '@/ui/error/error_editor_startup.js';
import { themeLookInstall } from '@/theme/theme_look_install.js';

const editorContainer = document.getElementById('editor-container') as HTMLElement;

/**
 * Starts the editor and converts renderer startup failures into visible UI.
 *
 * @param container Root editor container.
 */
function startEditor(container: HTMLElement): void {
  try {
    const layoutManager = new ManagerViewportLayout(container);
    layoutManager.start();
    console.log('BevyBroom started');
  } catch (error) {
    console.error('[BevyBroom] Editor startup failed.', error);
    showErrorEditorStartup(container, error);
  }
}

themeLookInstall(document);
startEditor(editorContainer);
