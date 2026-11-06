import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { formatToolInstructionTooltip, type ToolInstruction } from '@/tools/chrome/instruction/tool_instruction.js';

/**
 * Creates a square icon button for the vertical tool rail.
 *
 * @param svgIcon SVG markup.
 * @param instruction Browser tooltip instruction.
 * @param onClick Click handler.
 * @returns Configured button.
 */
export function createViewportToolRailButton(
  svgIcon: string,
  instruction: ToolInstruction,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = svgIcon;
  button.title = formatToolInstructionTooltip(instruction);
  button.setAttribute('aria-label', instruction.title);
  button.dataset['toolTitle'] = instruction.title;
  applyRailButtonBaseStyles(button);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/**
 * Applies active/idle chrome to a rail button.
 *
 * @param button Button element.
 * @param active Whether the tool is selected.
 */
export function styleViewportToolRailButton(button: HTMLButtonElement, active: boolean): void {
  button.style.border = `1px solid ${active ? Theme.toggleActiveBorder : Theme.inputBorderColor}`;
  button.style.background = active ? Theme.buttonPressedBackground : hexToRgb(Theme.buttonBackground);
  button.style.opacity = '1';
}

/**
 * Applies shared layout styles for rail icon buttons.
 *
 * @param button Button element.
 */
function applyRailButtonBaseStyles(button: HTMLButtonElement): void {
  button.style.width = `${Theme.toolPaletteButtonPx}px`;
  button.style.height = `${Theme.toolPaletteButtonPx}px`;
  button.style.padding = '0';
  button.style.margin = '0';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.color = Theme.buttonTextColor;
  button.style.flex = '0 0 auto';
}
