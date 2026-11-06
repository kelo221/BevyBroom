import { ShadingMode } from '@/types/shading_mode.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';

/** One shading mode a viewport offers, with its label and icon. */
export interface ViewportShadingChoice {
  /** Shading mode applied when chosen. */
  readonly mode: ShadingMode;
  /** Human label of the mode. */
  readonly label: string;
  /** Returns the icon markup of the mode. */
  readonly iconSvgRead: () => string;
}

/** Shading modes offered by every viewport, in display order. */
export const VIEWPORT_SHADING_CHOICES: readonly ViewportShadingChoice[] = [
  { mode: ShadingMode.SOLID, label: 'Solid', iconSvgRead: () => IconHammerCatalog.toolbarSvg('view_shading_solid') },
  {
    mode: ShadingMode.WIREFRAME,
    label: 'Wireframe',
    iconSvgRead: () => IconHammerCatalog.toolbarSvg('view_shading_wireframe'),
  },
  { mode: ShadingMode.FLAT, label: 'Flat', iconSvgRead: () => IconHammerCatalog.toolbarSvg('view_shading_flat') },
];
