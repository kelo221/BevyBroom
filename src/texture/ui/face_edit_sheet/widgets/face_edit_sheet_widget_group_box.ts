import { Theme } from '@/theme.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';

/**
 * Creates a titled group box (a bordered frame with its title on the top
 * border) holding the given content.
 *
 * @param title Group title.
 * @param className Class name of the group box.
 * @param content Elements shown inside the frame.
 * @returns Group box element.
 */
export function faceEditSheetGroupBoxCreate(title: string, className: string, ...content: HTMLElement[]): HTMLElement {
  const groupBox = document.createElement('fieldset');
  groupBox.classList.add('face-edit-sheet-group-box', className);
  groupBox.style.margin = '0';
  groupBox.style.padding = `2px ${FACE_INSPECTOR_METRICS.gap + 2}px ${FACE_INSPECTOR_METRICS.gap + 2}px`;
  groupBox.style.border = `1px solid ${Theme.inputBorderColor}`;
  groupBox.style.borderRadius = '3px';
  groupBox.style.minWidth = '0';
  groupBox.append(faceEditSheetGroupBoxLegendCreate(title), ...content);
  return groupBox;
}

/**
 * Creates the title shown on the top border of a group box.
 *
 * @param title Group title.
 * @returns Legend element.
 */
function faceEditSheetGroupBoxLegendCreate(title: string): HTMLLegendElement {
  const legend = document.createElement('legend');
  legend.textContent = title;
  legend.style.padding = '0 3px';
  legend.style.color = Theme.statusBarTextColor;
  legend.style.fontFamily = Theme.uiFontFamily;
  legend.style.fontSize = FACE_INSPECTOR_METRICS.captionFontSize;
  return legend;
}
