import { Theme } from '@/theme.js';

/** Root selector that scopes every rule to the macOS glass look. */
export const THEME_MAC_GLASS_ROOT_SELECTOR = "html[data-theme-look='mac_glass']";

/** Soft wallpaper drawn behind the translucent chrome. */
const THEME_MAC_GLASS_WALLPAPER =
  'radial-gradient(1200px 600px at 8% -10%, rgba(122, 170, 255, 0.45), transparent 60%), ' +
  'radial-gradient(900px 500px at 105% 0%, rgba(255, 170, 210, 0.35), transparent 60%), ' +
  'radial-gradient(900px 700px at 50% 120%, rgba(150, 230, 210, 0.30), transparent 60%), ' +
  'linear-gradient(180deg, #eef1f6 0%, #e2e6ee 100%)';

/** Frosted face of the bars and docks. */
const THEME_MAC_GLASS_PANEL_FACE = 'rgba(255, 255, 255, 0.52)';

/** Brighter frosted face of hovered controls. */
const THEME_MAC_GLASS_CONTROL_HOVER = 'rgba(0, 0, 0, 0.06)';

/** Face of resting push buttons inside docks. */
const THEME_MAC_GLASS_CONTROL_FACE = 'rgba(255, 255, 255, 0.72)';

/** Hairline that rims glass surfaces. */
const THEME_MAC_GLASS_RIM = 'rgba(255, 255, 255, 0.65)';

/** Soft drop shadow under the floating docks. */
const THEME_MAC_GLASS_DOCK_SHADOW = '0 8px 30px rgba(30, 40, 60, 0.12), 0 1px 2px rgba(30, 40, 60, 0.08)';

/** Shadow under resting push buttons. */
const THEME_MAC_GLASS_BUTTON_SHADOW = '0 0.5px 1.5px rgba(0, 0, 0, 0.16), inset 0 0.5px 0 rgba(255, 255, 255, 0.9)';

/** Gap between the floating docks in pixels. */
const THEME_MAC_GLASS_GAP_PX = 6;

/** Corner radius of the floating docks and viewports in pixels. */
const THEME_MAC_GLASS_DOCK_RADIUS_PX = 12;

/**
 * Prefixes every selector of a rule body with the glass root selector.
 *
 * @param selectors Comma separated selectors.
 * @param declarations CSS declarations of the rule.
 * @returns Scoped CSS rule.
 */
function themeMacGlassRule(selectors: string, declarations: string): string {
  const scopedSelectors = selectors
    .split(',')
    .map((selector) => `${THEME_MAC_GLASS_ROOT_SELECTOR} ${selector.trim()}`)
    .join(', ');
  return `${scopedSelectors} { ${declarations} }`;
}

/**
 * Builds the frosted glass declarations of a surface.
 *
 * @param face Translucent background of the surface.
 * @returns CSS declarations.
 */
function themeMacGlassSurface(face: string): string {
  return `background: ${face} !important; backdrop-filter: ${Theme.glassBackdropFilter}; -webkit-backdrop-filter: ${Theme.glassBackdropFilter};`;
}

/**
 * Builds the rules of the window wallpaper, the bars and the status bar.
 *
 * @returns CSS rules.
 */
function themeMacGlassFrameRules(): string[] {
  return [
    themeMacGlassRule('body, .shell-frame', `background: ${THEME_MAC_GLASS_WALLPAPER} !important;`),
    themeMacGlassRule(
      '.editor-menubar, .editor-toolbar',
      `${themeMacGlassSurface('transparent')} border: none !important; box-shadow: none !important;`,
    ),
    themeMacGlassRule('.shell-toolbar-host', `padding: 0 ${THEME_MAC_GLASS_GAP_PX}px;`),
    themeMacGlassRule(
      '.editor-status-bar',
      `background: transparent !important; border: none !important; padding: 0 ${THEME_MAC_GLASS_GAP_PX}px !important;`,
    ),
    themeMacGlassRule(
      '.editor-status-bar .status-bar-field',
      `border: none !important; box-shadow: none !important; background: transparent !important; color: ${Theme.secondaryTextColor} !important;`,
    ),
  ];
}

/**
 * Builds the rules that float the tools palette, the views and the docks as
 * rounded glass cards.
 *
 * @returns CSS rules.
 */
function themeMacGlassDockRules(): string[] {
  const card = `border-radius: ${THEME_MAC_GLASS_DOCK_RADIUS_PX}px !important; box-shadow: ${THEME_MAC_GLASS_DOCK_SHADOW}, inset 0 0 0 0.5px ${THEME_MAC_GLASS_RIM} !important; border: none !important; overflow: hidden;`;
  return [
    themeMacGlassRule(
      '.shell-frame-body',
      `padding: 0 ${THEME_MAC_GLASS_GAP_PX}px ${THEME_MAC_GLASS_GAP_PX}px; box-sizing: border-box;`,
    ),
    themeMacGlassRule('.editor-viewport-corner-label', 'padding: 0 7px !important;'),
    themeMacGlassRule(
      '.shell-tools-palette-host',
      `${themeMacGlassSurface(THEME_MAC_GLASS_PANEL_FACE)} ${card} margin-right: ${THEME_MAC_GLASS_GAP_PX}px;`,
    ),
    themeMacGlassRule('.editor-viewport-area', `${card} background: ${Theme.viewportBackground} !important;`),
    themeMacGlassRule('.shell-inspector', `${themeMacGlassSurface(THEME_MAC_GLASS_PANEL_FACE)} ${card}`),
    themeMacGlassRule('.shell-info-panel', `${themeMacGlassSurface(THEME_MAC_GLASS_PANEL_FACE)} ${card}`),
    themeMacGlassRule(
      '.shell-frame-body > .splitter-box-divider, .shell-frame-body > .splitter-box-pane-first > .splitter-box > .splitter-box-divider',
      `background: transparent !important; flex-basis: ${THEME_MAC_GLASS_GAP_PX}px !important;`,
    ),
  ];
}

/**
 * Builds the rules that make the docked panels inside the cards transparent so
 * the card glass shows through.
 *
 * @returns CSS rules.
 */
function themeMacGlassDockContentRules(): string[] {
  return [
    themeMacGlassRule(
      '.shell-inspector *:not(button):not(input):not(select):not(textarea):not(canvas), .shell-info-panel *:not(button):not(input):not(select):not(textarea):not(canvas)',
      'background-color: transparent;',
    ),
    themeMacGlassRule(
      '.shell-inspector-object-bar, .panel-prefab-dock, .editor-outliner-panel, .tab-book-strip, .shell-inspector div[class*="panel"]',
      'background: transparent !important; border-color: rgba(0, 0, 0, 0.06) !important;',
    ),
    themeMacGlassRule(
      '.shell-inspector-slot, .shell-inspector-map-section',
      'border-color: rgba(0, 0, 0, 0.06) !important;',
    ),
    themeMacGlassRule('.editor-area-pane', `border-radius: 0 !important;`),
  ];
}

/**
 * Builds the rules of push buttons, toolbar buttons and the tools palette.
 *
 * @returns CSS rules.
 */
function themeMacGlassButtonRules(): string[] {
  return [
    themeMacGlassRule(
      '.editor-toolbar button, .editor-menubar button, .editor-viewport-tool-rail button',
      `border-color: transparent !important; border-radius: ${Theme.controlRadiusPx + 1}px !important; box-shadow: none !important;`,
    ),
    themeMacGlassRule(
      '.editor-toolbar button:not([data-active="true"]), .editor-viewport-tool-rail button:not([data-active="true"])',
      'background: transparent !important;',
    ),
    themeMacGlassRule(
      '.editor-toolbar button:not([data-active="true"]):hover, .editor-menubar button:hover, .editor-viewport-tool-rail button:not([data-active="true"]):hover',
      `background: ${THEME_MAC_GLASS_CONTROL_HOVER} !important;`,
    ),
    themeMacGlassRule(
      '.editor-toolbar button[data-active="true"], .editor-viewport-tool-rail button[data-active="true"]',
      `background: ${Theme.buttonPressedBackground} !important; box-shadow: inset 0 0 0 0.5px ${Theme.toggleActiveBorder} !important;`,
    ),
    themeMacGlassRule(
      '.shell-dock-compact-control, .shell-inspector button, .shell-info-panel button:not(.tab-book-tab)',
      `border-radius: ${Theme.controlRadiusPx}px !important; border: none !important; box-shadow: ${THEME_MAC_GLASS_BUTTON_SHADOW} !important;`,
    ),
    themeMacGlassRule(
      'button.shell-dock-compact-control:not([data-active="true"])',
      `background: ${THEME_MAC_GLASS_CONTROL_FACE} !important;`,
    ),
  ];
}

/**
 * Builds the rules of text fields, drop-down fields and tabs.
 *
 * @returns CSS rules.
 */
function themeMacGlassFieldRules(): string[] {
  return [
    themeMacGlassRule(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea',
      `border-radius: ${Theme.controlRadiusPx}px !important; border: none !important; box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 0.5px 0 rgba(255, 255, 255, 0.8) !important; outline: none;`,
    ),
    themeMacGlassRule(
      'input:focus, select:focus, textarea:focus',
      `box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.35), inset 0 0 0 0.5px ${Theme.focusOutline} !important;`,
    ),
    themeMacGlassRule(
      'input[type="checkbox"], input[type="radio"], input[type="range"]',
      `accent-color: ${Theme.focusOutline};`,
    ),
    themeMacGlassRule(
      '.tab-book-tab',
      `border-radius: ${Theme.controlRadiusPx}px !important; border-color: transparent !important;`,
    ),
  ];
}

/**
 * Builds the rules of thin overlay style scrollbars.
 *
 * @returns CSS rules.
 */
function themeMacGlassScrollbarRules(): string[] {
  return [
    themeMacGlassRule('*::-webkit-scrollbar', 'width: 10px; height: 10px; background: transparent;'),
    themeMacGlassRule(
      '*::-webkit-scrollbar-thumb',
      `background: ${Theme.scrollbarThumbColor}; border-radius: 10px; border: 3px solid transparent; background-clip: content-box;`,
    ),
    themeMacGlassRule('*::-webkit-scrollbar-button', 'display: none;'),
  ];
}

/**
 * Builds the complete stylesheet of the macOS glass look.
 *
 * @returns CSS text scoped to the glass root selector.
 */
export function themeMacGlassStylesheetBuild(): string {
  return [
    ...themeMacGlassFrameRules(),
    ...themeMacGlassDockRules(),
    ...themeMacGlassDockContentRules(),
    ...themeMacGlassButtonRules(),
    ...themeMacGlassFieldRules(),
    ...themeMacGlassScrollbarRules(),
  ].join('\n');
}
