import type { ManagerInput } from '@/input/manager_input.js';
import {
  isAltPressedOnDomFlags,
  isAltPressedOnInputManagers,
  isAnyModifierPressedOnDomFlags,
  isAnyModifierPressedOnInputManagers,
  isCtrlOrMetaPressedOnDomFlags,
  isCtrlOrMetaPressedOnInputManagers,
  isShiftPressedOnDomFlags,
  isShiftPressedOnInputManagers,
  type DomModifierKeyFlags,
} from '@/input/modifier_keys_query.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_setup.js';

/** Input managers the tool modifier key queries read. */
export type LayoutToolEditorModifierKeySources = Pick<
  LayoutToolEditorSetupDeps,
  'inputManager' | 'getDetachedInputManagers'
>;

/**
 * Collects main and detached input managers for multi-window modifier queries.
 *
 * @param sources Main and detached input managers.
 * @returns Input managers in query order.
 */
function layoutToolEditorInputManagersCollect(sources: LayoutToolEditorModifierKeySources): ManagerInput[] {
  const managers: ManagerInput[] = [sources.inputManager];
  const detached = sources.getDetachedInputManagers?.() ?? [];
  for (const manager of detached) {
    managers.push(manager);
  }
  return managers;
}

/**
 * Resolves Shift for tools and widgets (bridge latch, then all input managers).
 *
 * @param sources Main and detached input managers.
 * @param getLatchedModifierFlags Bridge-latched DOM modifiers.
 * @returns True when Shift is active.
 */
export function layoutToolEditorShiftPressedResolve(
  sources: LayoutToolEditorModifierKeySources,
  getLatchedModifierFlags: () => DomModifierKeyFlags | null,
): boolean {
  const latch = getLatchedModifierFlags();
  if (latch && isShiftPressedOnDomFlags(latch)) {
    return true;
  }
  return isShiftPressedOnInputManagers(layoutToolEditorInputManagersCollect(sources));
}

/**
 * Resolves Ctrl/Meta for tools and widgets.
 *
 * @param sources Main and detached input managers.
 * @param getLatchedModifierFlags Bridge-latched DOM modifiers.
 * @returns True when Ctrl or Meta is active.
 */
export function layoutToolEditorCtrlPressedResolve(
  sources: LayoutToolEditorModifierKeySources,
  getLatchedModifierFlags: () => DomModifierKeyFlags | null,
): boolean {
  const latch = getLatchedModifierFlags();
  if (latch && isCtrlOrMetaPressedOnDomFlags(latch)) {
    return true;
  }
  return isCtrlOrMetaPressedOnInputManagers(layoutToolEditorInputManagersCollect(sources));
}

/**
 * Resolves Alt for tools and widgets.
 *
 * @param sources Main and detached input managers.
 * @param getLatchedModifierFlags Bridge-latched DOM modifiers.
 * @returns True when Alt is active.
 */
export function layoutToolEditorAltPressedResolve(
  sources: LayoutToolEditorModifierKeySources,
  getLatchedModifierFlags: () => DomModifierKeyFlags | null,
): boolean {
  const latch = getLatchedModifierFlags();
  if (latch && isAltPressedOnDomFlags(latch)) {
    return true;
  }
  return isAltPressedOnInputManagers(layoutToolEditorInputManagersCollect(sources));
}

/**
 * Resolves any modifier for tools and widgets.
 *
 * @param sources Main and detached input managers.
 * @param getLatchedModifierFlags Bridge-latched DOM modifiers.
 * @returns True when any modifier is active.
 */
export function layoutToolEditorAnyModifierPressedResolve(
  sources: LayoutToolEditorModifierKeySources,
  getLatchedModifierFlags: () => DomModifierKeyFlags | null,
): boolean {
  const latch = getLatchedModifierFlags();
  if (latch && isAnyModifierPressedOnDomFlags(latch)) {
    return true;
  }
  return isAnyModifierPressedOnInputManagers(layoutToolEditorInputManagersCollect(sources));
}
