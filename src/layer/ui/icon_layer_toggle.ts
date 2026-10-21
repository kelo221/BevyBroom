import type { LayerFlagName } from '@/layer/model/layer_definition.js';
import { IconOutlinerVisibility } from '@/outliner/ui/icon_outliner_visibility.js';

/** Stroke attributes shared by the layer switch icons. */
const ICON_LAYER_STROKE_ATTRIBUTES =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Attributes of the red slash drawn over switched-off icons. */
const ICON_LAYER_SLASH_ATTRIBUTES = 'fill="none" stroke="#e74c3c" stroke-width="2.25" stroke-linecap="round"';

/** Inline SVG icons for the three switches of a layer row. */
export class IconLayerToggle {
  /**
   * Returns the icon showing a layer switch state.
   *
   * @param flag Switch the icon represents.
   * @param isFlagOn True when the switch is on.
   * @returns Inline SVG markup.
   */
  static markup(flag: LayerFlagName, isFlagOn: boolean): string {
    if (flag === 'hidden') {
      return isFlagOn ? IconOutlinerVisibility.hiddenEye() : IconOutlinerVisibility.openEye();
    }
    if (flag === 'locked') {
      return IconLayerToggle.lockMarkup(isFlagOn);
    }
    return IconLayerToggle.exportMarkup(isFlagOn);
  }

  /**
   * Returns a padlock, closed when locked and open otherwise.
   *
   * @param isLocked True for the closed padlock.
   * @returns Inline SVG markup.
   */
  private static lockMarkup(isLocked: boolean): string {
    const shackle = isLocked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2';
    const body = `<rect x="5" y="11" width="14" height="10" rx="2" ${ICON_LAYER_STROKE_ATTRIBUTES}/>`;
    return IconLayerToggle.svgWrap(`${body}<path d="${shackle}" ${ICON_LAYER_STROKE_ATTRIBUTES}/>`);
  }

  /**
   * Returns a box with an outgoing arrow, slashed in red when the layer is left
   * out of exports.
   *
   * @param isOmitted True when the layer is left out of exports.
   * @returns Inline SVG markup.
   */
  private static exportMarkup(isOmitted: boolean): string {
    const tray = `<path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" ${ICON_LAYER_STROKE_ATTRIBUTES}/>`;
    const arrow = `<path d="M12 15V4M7 9l5-5 5 5" ${ICON_LAYER_STROKE_ATTRIBUTES}/>`;
    const slash = isOmitted ? `<path d="M4 4l16 16" ${ICON_LAYER_SLASH_ATTRIBUTES}/>` : '';
    return IconLayerToggle.svgWrap(`${tray}${arrow}${slash}`);
  }

  /**
   * Wraps path markup in a 14 pixel SVG element.
   *
   * @param content Inner SVG markup.
   * @returns Complete SVG markup.
   */
  private static svgWrap(content: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;
  }
}
