import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Identifier used to keep the view settings stylesheet singular. */
const VIEW_SETTINGS_STYLE_ID = 'bevybroom-view-settings-styles';

/**
 * Installs the stylesheet that turns View preferences into visible editor
 * changes.
 */
export function ensureViewSettingsStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const style = getOrCreateViewSettingsStyle();
  style.textContent = buildViewSettingsCss();
}

/**
 * Returns the dedicated stylesheet, creating it when necessary.
 *
 * @returns View settings stylesheet.
 */
function getOrCreateViewSettingsStyle(): HTMLStyleElement {
  const existing = document.getElementById(VIEW_SETTINGS_STYLE_ID);
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }
  const style = document.createElement('style');
  style.id = VIEW_SETTINGS_STYLE_ID;
  document.head.appendChild(style);
  return style;
}

/**
 * Builds the complete view-settings stylesheet text.
 *
 * @returns Complete view settings stylesheet.
 */
function buildViewSettingsCss(): string {
  return [buildFontSizeCss(), buildTextureBrowserCss(), buildLightThemeCss()].join('\n');
}

/**
 * Builds the program UI font-size override.
 *
 * @returns Font-size CSS rules.
 */
function buildFontSizeCss(): string {
  return `#editor-container, #editor-container button, #editor-container input,
#editor-container select, #editor-container textarea {
  font-size: var(--bevybroom-ui-font-size) !important;
}`;
}

/**
 * Builds texture browser visual preference rules.
 *
 * @returns Texture browser CSS rules.
 */
function buildTextureBrowserCss(): string {
  return `.tb-browser-grid {
  grid-template-columns: repeat(auto-fill, minmax(calc(96px * var(--bevybroom-material-icon-scale)), 1fr));
}
.tb-browser-thumb {
  filter: brightness(var(--bevybroom-viewport-brightness));
}`;
}

/**
 * Builds the Windows-inspired light theme palette.
 *
 * @returns Light theme CSS rules.
 */
function buildLightThemeCss(): string {
  return [
    buildLightThemeFrameCss(),
    buildLightThemePanelCss(),
    buildLightThemePanelContentCss(),
    buildLightThemeSettingsDialogCss(),
    buildLightThemeViewportLabelCss(),
    buildLightThemeSelectionCss(),
    buildLightThemeControlCss(),
    buildLightThemeSettingsContentCss(),
    buildLightThemeInteractionCss(),
    buildLightThemeChromeCss(),
    buildLightThemeDropdownCss(),
    buildLightThemeContextMenuCss(),
    buildLightThemeFocusCss(),
    buildLightThemeActiveTabCss(),
  ].join('\n');
}

/**
 * Builds light-theme CSS for dropdown menus, items, shortcuts, separators, and
 * carets.
 *
 * @returns Light theme dropdown CSS rules.
 */
function buildLightThemeDropdownCss(): string {
  return `html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-menu,
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-submenu {
  background: ${Theme.panelSunkenBackground} !important;
  border-color: ${Theme.inputBorderColor} !important;
  box-shadow: ${Theme.menuShadow} !important;
}
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-item {
  background: transparent !important;
  color: ${Theme.buttonTextColor} !important;
  border-color: transparent !important;
}
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-item:hover:not(:disabled) {
  background: ${Theme.menuHighlightBackground} !important;
  color: ${Theme.menuHighlightTextColor} !important;
  border-color: ${Theme.focusOutline} !important;
}
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-shortcut,
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-submenu-caret {
  color: ${Theme.secondaryTextColor} !important;
}
html[data-bevybroom-theme='light'] .editor-toolbar-dropdown-separator {
  background: ${Theme.menuSeparatorColor} !important;
}`;
}

/**
 * Builds the bright workspace used in light mode.
 *
 * @returns Light theme frame CSS rules.
 */
function buildLightThemeFrameCss(): string {
  return `html[data-bevybroom-theme='light'],
html[data-bevybroom-theme='light'] body,
html[data-bevybroom-theme='light'] #editor-container {
  background: ${Theme.panelSunkenBackground} !important;
  color: ${Theme.buttonTextColor} !important;
}`;
}

/**
 * Builds the neutral gray editor chrome surrounding the dark work viewports.
 *
 * @returns Editor chrome light-theme CSS rules.
 */
function buildLightThemeChromeCss(): string {
  return `html[data-bevybroom-theme='light'] .editor-toolbar,
html[data-bevybroom-theme='light'] .editor-status-bar {
  background: ${hexToRgb(Theme.toolbarBackgroundEnd)} !important;
  border-color: ${Theme.chromeBorderColor} !important;
  color: ${Theme.buttonTextColor} !important;
  box-shadow: none !important;
}

html[data-bevybroom-theme='light'] .editor-toolbar button {
  background: transparent !important;
  color: ${Theme.buttonTextColor} !important;
  border-color: transparent !important;
}
html[data-bevybroom-theme='light'] .editor-status-bar * {
  color: ${Theme.buttonTextColor} !important;
}`;
}

/**
 * Builds the light context-menu surface and its item states.
 *
 * @returns Light theme context-menu CSS rules.
 */
function buildLightThemeContextMenuCss(): string {
  return `html[data-bevybroom-theme='light'] .editor-context-menu {
  background: ${Theme.panelSunkenBackground} !important;
  border-color: ${Theme.inputBorderColor} !important;
  box-shadow: ${Theme.menuShadow} !important;
}
html[data-bevybroom-theme='light'] .editor-context-menu-item {
  color: ${Theme.buttonTextColor} !important;
}
html[data-bevybroom-theme='light'] .editor-context-menu-item:hover {
  background: ${Theme.menuHighlightBackground} !important;
  color: ${Theme.menuHighlightTextColor} !important;
}
html[data-bevybroom-theme='light'] .editor-context-menu-item-disabled {
  color: ${Theme.disabledTextColor} !important;
}`;
}

/**
 * Builds neutral grey surfaces for floating editor panels.
 *
 * @returns Light theme panel CSS rules.
 */
function buildLightThemePanelCss(): string {
  return `html[data-bevybroom-theme='light'] .settings-dialog-panel,
html[data-bevybroom-theme='light'] .editor-outliner-panel,
html[data-bevybroom-theme='light'] .editor-properties-panel,
html[data-bevybroom-theme='light'] .editor-tools-palette {
  background: ${Theme.panelBackground} !important;
  color: ${Theme.buttonTextColor} !important;
  border-color: ${Theme.chromeBevelDark} !important;
}`;
}

/**
 * Builds consistent dark text and restrained borders inside light editor
 * panels.
 *
 * @returns Editor panel content light-theme CSS rules.
 */
function buildLightThemePanelContentCss(): string {
  return `html[data-bevybroom-theme='light'] .editor-outliner-panel *,
html[data-bevybroom-theme='light'] .editor-properties-panel *,
html[data-bevybroom-theme='light'] .editor-tools-palette * {
  color: ${Theme.buttonTextColor} !important;
  border-color: ${Theme.chromeBorderColor} !important;
}
html[data-bevybroom-theme='light'] .editor-tools-palette {
  box-shadow: ${Theme.windowShadow} !important;
}`;
}

/**
 * Builds the white settings content surface with neutral gray dialog chrome.
 *
 * @returns Settings dialog light-theme CSS rules.
 */
function buildLightThemeSettingsDialogCss(): string {
  return `html[data-bevybroom-theme='light'] .settings-dialog-panel {
  background: ${Theme.panelSunkenBackground} !important;
  color: ${Theme.buttonTextColor} !important;
  box-shadow: ${Theme.dialogShadow} !important;
}
html[data-bevybroom-theme='light'] .settings-dialog-header,
html[data-bevybroom-theme='light'] .settings-dialog-tab-bar {
  background: ${hexToRgb(Theme.toolbarBackgroundEnd)} !important;
  border-color: ${Theme.chromeBorderColor} !important;
}`;
}

/**
 * Builds soft gray labels that separate the viewport tools from the work area.
 *
 * @returns Viewport label light-theme CSS rules.
 */
function buildLightThemeViewportLabelCss(): string {
  return `html[data-bevybroom-theme='light'] .editor-viewport-label {
  background: ${Theme.panelBackground} !important;
  color: ${Theme.buttonTextColor} !important;
  border: 1px solid ${Theme.chromeBorderColor};
}`;
}

/**
 * Builds light-theme CSS for selected texture-browser tiles.
 *
 * @returns Light theme selection CSS rules.
 */
function buildLightThemeSelectionCss(): string {
  return `html[data-bevybroom-theme='light'] .tb-browser-tile[aria-selected='true'] {
  background: ${Theme.listSelectedBackground} !important;
  border-color: ${Theme.focusOutline} !important;
}`;
}

/**
 * Builds white, readable interactive controls for the light theme.
 *
 * @returns Light theme control CSS rules.
 */
function buildLightThemeControlCss(): string {
  return `html[data-bevybroom-theme='light'] button,
html[data-bevybroom-theme='light'] input,
html[data-bevybroom-theme='light'] select,
html[data-bevybroom-theme='light'] textarea {
  background: ${Theme.panelSunkenBackground} !important;
  color: ${Theme.buttonTextColor} !important;
  border-color: ${Theme.inputBorderColor} !important;
}`;
}

/**
 * Builds light-theme CSS for settings dialog content, categories, titles,
 * labels, and the coordinate-space summary field.
 *
 * @returns Settings content light-theme CSS rules.
 */
function buildLightThemeSettingsContentCss(): string {
  return `html[data-bevybroom-theme='light'] .settings-dialog-content {
  background: ${Theme.panelSunkenBackground} !important;
}
html[data-bevybroom-theme='light'] .settings-dialog-category {
  border-color: ${Theme.chromeBorderColor} !important;
}
html[data-bevybroom-theme='light'] .settings-dialog-category-title,
html[data-bevybroom-theme='light'] .settings-dialog-control-label,
html[data-bevybroom-theme='light'] .settings-dialog-title {
  color: ${Theme.buttonTextColor} !important;
}
html[data-bevybroom-theme='light'] [data-settings-field='coordinate-space-summary'] {
  color: ${Theme.secondaryTextColor} !important;
}`;
}

/**
 * Builds light-theme CSS for button hover and range input accent color.
 *
 * @returns Interactive light-theme CSS rules.
 */
function buildLightThemeInteractionCss(): string {
  return `html[data-bevybroom-theme='light'] button:hover {
  background: ${hexToRgb(Theme.buttonHoverColor)} !important;
  border-color: ${Theme.focusOutline} !important;
}
html[data-bevybroom-theme='light'] input[type='range'] {
  accent-color: ${Theme.focusOutline};
}`;
}

/**
 * Builds keyboard focus feedback for light-theme form controls.
 *
 * @returns Focus light-theme CSS rules.
 */
function buildLightThemeFocusCss(): string {
  return `html[data-bevybroom-theme='light'] button:focus-visible,
html[data-bevybroom-theme='light'] input:focus-visible,
html[data-bevybroom-theme='light'] select:focus-visible,
html[data-bevybroom-theme='light'] textarea:focus-visible {
  outline: 2px solid ${Theme.focusOutline} !important;
  outline-offset: -1px;
}`;
}

/**
 * Builds the light-blue active-tab treatment for the settings dialog.
 *
 * @returns Active-tab light-theme CSS rules.
 */
function buildLightThemeActiveTabCss(): string {
  return `html[data-bevybroom-theme='light'] .settings-dialog-panel [role='tab'][aria-selected='true'] {
  background: ${Theme.listSelectedBackground} !important;
  border-color: ${Theme.focusOutline} !important;
  color: ${Theme.buttonTextColor} !important;
}`;
}
