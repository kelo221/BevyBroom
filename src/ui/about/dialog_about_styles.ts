/**
 * Style injection and visual helpers for the About dialog: classic Windows
 * dialog chrome around a decorative animated header band.
 */
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import {
  buttonClassicHoverBind,
  buttonClassicPrimaryApply,
  buttonClassicStyleApply,
} from '@/ui/button/button_classic_style.js';
import { AboutArtPalette } from './about_art_palette.js';

const STYLE_ELEMENT_ID = 'bevybroom-about-dialog-styles';

/** Ensures About dialog keyframe animations exist in the document once. */
export function ensureAboutDialogStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = buildKeyframeCss();
  document.head.appendChild(styleElement);
}

/**
 * Builds CSS keyframe and class rules for the About dialog.
 *
 * @returns CSS text for injection.
 */
function buildKeyframeCss(): string {
  return [
    buildBackdropKeyframes(),
    buildPanelKeyframes(),
    buildTitleKeyframes(),
    buildGlowKeyframes(),
    buildShimmerKeyframes(),
    buildSphereRollKeyframes(),
    buildClassRules(),
  ].join('\n');
}

/**
 * Backdrop fade animation.
 *
 * @returns CSS keyframes string.
 */
function buildBackdropKeyframes(): string {
  return `@keyframes aboutBackdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }`;
}

/**
 * Panel entrance animation with scale and rise.
 *
 * @returns CSS keyframes string.
 */
function buildPanelKeyframes(): string {
  return `@keyframes aboutPanelIn {
    from { opacity: 0; transform: translateY(18px) scale(0.94); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }`;
}

/**
 * Builds CSS keyframes that animate background-position left to right and back.
 *
 * @returns CSS keyframes string.
 */
function buildTitleKeyframes(): string {
  return `@keyframes aboutTitleShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }`;
}

/**
 * Soft border glow pulse.
 *
 * @returns CSS keyframes string.
 */
function buildGlowKeyframes(): string {
  return `@keyframes aboutGlowPulse {
    0%, 100% { box-shadow: ${Theme.dialogShadow}, ${AboutArtPalette.glowRest}; }
    50% { box-shadow: ${Theme.dialogShadow}, ${AboutArtPalette.glowPeak}; }
  }`;
}

/**
 * Horizontal shimmer sweep over the header band.
 *
 * @returns CSS keyframes string.
 */
function buildShimmerKeyframes(): string {
  return `@keyframes aboutShimmer {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
  }`;
}

/**
 * Contributor sphere roll-in animation from right to left with a bounce.
 *
 * @returns CSS keyframes string.
 */
function buildSphereRollKeyframes(): string {
  return `@keyframes contributorSphereRollIn {
    0% { opacity: 0; transform: translateX(80px) scale(0.3) rotate(0deg); }
    60% { opacity: 1; transform: translateX(-8px) scale(1.08) rotate(-8deg); }
    80% { transform: translateX(3px) scale(0.97) rotate(3deg); }
    100% { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
  }`;
}

/**
 * Class rules that apply the keyframe animations.
 *
 * @returns CSS class rules string.
 */
function buildClassRules(): string {
  return `
.about-dialog-backdrop {
  animation: aboutBackdropIn 280ms ease-out forwards;
}
.about-dialog-panel {
  animation: aboutPanelIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards,
             aboutGlowPulse 3.2s ease-in-out infinite 360ms;
}
.about-dialog-title {
  background: ${AboutArtPalette.titleGradient};
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: aboutTitleShift 6s ease-in-out infinite;
}
.about-dialog-shimmer {
  animation: aboutShimmer 2.8s ease-in-out infinite;
}
`.trim();
}

/**
 * Applies chrome styles to the dialog panel card.
 *
 * @param panel Panel element.
 */
export function styleAboutPanel(panel: HTMLElement): void {
  panel.classList.add('about-dialog-panel');
  panel.style.position = 'relative';
  panel.style.width = 'min(520px, 100%)';
  panel.style.maxHeight = 'min(86vh, 720px)';
  panel.style.overflow = 'hidden';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.borderRadius = `${Theme.controlRadiusPx}px`;
  panel.style.border = `1px solid ${Theme.chromeBorderColor}`;
  panel.style.background = hexToRgb(Theme.propertiesPanelBackground);
  panel.style.fontFamily = Theme.uiFontFamily;
  panel.style.color = Theme.buttonTextColor;
  panel.style.overflowY = 'auto';
  panel.style.boxSizing = 'border-box';
}

/**
 * Applies styles to the animated header band.
 *
 * @param header Header container.
 */
export function styleAboutHeader(header: HTMLElement): void {
  header.style.position = 'relative';
  header.style.overflow = 'hidden';
  header.style.padding = '22px 22px 16px';
  header.style.background = AboutArtPalette.headerBand;
  header.style.borderBottom = `1px solid ${Theme.chromeBorderColor}`;
}

/**
 * Applies styles to the scrolling body content area.
 *
 * @param body Body container.
 */
export function styleAboutBody(body: HTMLElement): void {
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '12px';
  body.style.padding = '16px 22px 20px';
}

/**
 * Applies animated gradient text styles to the project title.
 *
 * @param title Title element.
 */
export function styleAboutTitle(title: HTMLElement): void {
  title.classList.add('about-dialog-title');
  title.style.margin = '0';
  title.style.fontSize = '28px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.04em';
  title.style.lineHeight = '1.15';
}

/**
 * Applies muted subtitle styles.
 *
 * @param subtitle Subtitle element.
 */
export function styleAboutSubtitle(subtitle: HTMLElement): void {
  subtitle.style.margin = '8px 0 0';
  subtitle.style.fontSize = '12px';
  subtitle.style.letterSpacing = '0.12em';
  subtitle.style.textTransform = 'uppercase';
  subtitle.style.color = AboutArtPalette.headerSubtitle;
}

/**
 * Applies styles to credit paragraphs.
 *
 * @param paragraph Credit text element.
 */
export function styleAboutCreditLine(paragraph: HTMLElement): void {
  paragraph.style.margin = '0';
  paragraph.style.fontSize = `${Theme.uiFontSizePx + 1}px`;
  paragraph.style.lineHeight = '1.55';
  paragraph.style.color = Theme.buttonTextColor;
}

/**
 * Applies styles to the AI supremacy proclamation.
 *
 * @param proclamation Proclamation element.
 */
export function styleAboutProclamation(proclamation: HTMLElement): void {
  proclamation.style.margin = '0';
  proclamation.style.padding = '8px 10px';
  proclamation.style.borderRadius = `${Theme.controlRadiusPx}px`;
  proclamation.style.fontSize = `${Theme.uiFontSizePx}px`;
  proclamation.style.lineHeight = '1.5';
  proclamation.style.fontStyle = 'italic';
  proclamation.style.color = Theme.secondaryTextColor;
  proclamation.style.background = Theme.hoverOverlay;
  proclamation.style.border = `1px solid ${Theme.chromeBorderColor}`;
}

/**
 * Applies styles to the license textarea.
 *
 * @param textArea License text area.
 */
export function styleAboutLicenseBox(textArea: HTMLTextAreaElement): void {
  textArea.style.width = '100%';
  textArea.style.minHeight = '140px';
  textArea.style.resize = 'vertical';
  textArea.style.boxSizing = 'border-box';
  textArea.style.padding = '6px';
  textArea.style.borderRadius = '0';
  textArea.style.border = `1px solid ${Theme.inputBorderColor}`;
  textArea.style.background = Theme.panelSunkenBackground;
  textArea.style.color = Theme.inputTextColor;
  textArea.style.fontFamily = Theme.monospaceFontFamily;
  textArea.style.fontSize = `${Theme.uiFontSizePx}px`;
  textArea.style.lineHeight = '1.4';
  textArea.style.outline = 'none';
}

/**
 * Applies classic push-button chrome and hover feedback to an action button.
 *
 * @param button Button element.
 * @param primary Whether this is the default action.
 */
export function styleAboutActionButton(button: HTMLButtonElement, primary: boolean): void {
  button.type = 'button';
  buttonClassicStyleApply(button);
  button.style.padding = '4px 12px';
  button.style.minWidth = '75px';
  if (primary) {
    buttonClassicPrimaryApply(button);
  }
  buttonClassicHoverBind(button, () => false);
}

/**
 * Applies styles to the footer action row.
 *
 * @param row Footer row element.
 */
export function styleAboutFooter(row: HTMLElement): void {
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '8px';
  row.style.justifyContent = 'flex-end';
  row.style.marginTop = '4px';
}

/**
 * Applies styles to the close icon in the header.
 *
 * @param closeButton Close button element.
 */
export function styleAboutCloseButton(closeButton: HTMLButtonElement): void {
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.title = 'Close';
  closeButton.setAttribute('aria-label', 'Close');
  buttonClassicStyleApply(closeButton);
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '12px';
  closeButton.style.width = '24px';
  closeButton.style.height = '24px';
  closeButton.style.padding = '0';
  closeButton.style.fontSize = '16px';
  closeButton.style.lineHeight = '1';
  buttonClassicHoverBind(closeButton, () => false);
}

/**
 * Creates the shimmer sweep overlay element for the header.
 *
 * @returns Shimmer div element.
 */
export function createAboutShimmer(): HTMLElement {
  const shimmer = document.createElement('div');
  shimmer.classList.add('about-dialog-shimmer');
  shimmer.style.position = 'absolute';
  shimmer.style.top = '0';
  shimmer.style.left = '0';
  shimmer.style.width = '45%';
  shimmer.style.height = '100%';
  shimmer.style.pointerEvents = 'none';
  shimmer.style.background = AboutArtPalette.headerShimmer;
  return shimmer;
}
