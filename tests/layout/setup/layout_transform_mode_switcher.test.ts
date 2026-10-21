import { describe, expect, it, vi } from 'vitest';
import { TransformMode } from '@/types/transform_mode.js';
import type { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import type { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { LayoutToolEditorSystem } from '@/layout/setup/layout_tool_editor_setup.js';
import {
  LayoutTransformModeSwitcher,
  type LayoutTransformModeSwitcherHost,
} from '@/layout/setup/layout_transform_mode_switcher.js';

/** Switcher rig with a gizmo that remembers its mode and spies on the chrome. */
interface TransformModeSwitcherRig {
  switcher: LayoutTransformModeSwitcher;
  host: LayoutTransformModeSwitcherHost;
  gizmoModeRead(): TransformMode;
  setActiveTransformMode: ReturnType<typeof vi.fn>;
}

/**
 * Builds a switcher over a remembering gizmo stub.
 *
 * @param editModeActive Whether Edit Mode reports active.
 * @param toolEditorSystem Tool system to hand out, or null for none.
 * @returns Switcher rig.
 */
function transformModeSwitcherRigCreate(
  editModeActive: boolean,
  toolEditorSystem: LayoutToolEditorSystem | null,
): TransformModeSwitcherRig {
  let gizmoMode = TransformMode.TRANSLATE;
  const setActiveTransformMode = vi.fn();
  const host: LayoutTransformModeSwitcherHost = {
    transformGizmo: {
      getMode: () => gizmoMode,
      setMode: (mode: TransformMode) => (gizmoMode = mode),
    } as unknown as GizmoTransform,
    isEditModeActive: () => editModeActive,
    toolEditorSystemRead: () => toolEditorSystem,
    toolsPaletteControllerRead: () => ({ setActiveTransformMode }) as unknown as ControllerViewportToolChrome,
    statusBarRead: () => null,
    gizmoPivotUpdate: vi.fn(),
    gizmoVisibilityUpdate: vi.fn(),
    showStatusMessage: vi.fn(),
  };
  return {
    switcher: new LayoutTransformModeSwitcher(host),
    host,
    gizmoModeRead: () => gizmoMode,
    setActiveTransformMode,
  };
}

describe('LayoutTransformModeSwitcher', () => {
  it('switches the object transform tool and highlights the mode it switched to', () => {
    const switchToTransformMode = vi.fn(() => true);
    const rig = transformModeSwitcherRigCreate(false, { switchToTransformMode } as unknown as LayoutToolEditorSystem);
    rig.switcher.transformModeApply(TransformMode.ROTATE);
    expect(switchToTransformMode).toHaveBeenCalledWith(TransformMode.ROTATE);
    expect(rig.setActiveTransformMode).toHaveBeenLastCalledWith(rig.gizmoModeRead());
  });

  it('leaves the highlight alone when the tool system refuses the switch', () => {
    const rig = transformModeSwitcherRigCreate(false, {
      switchToTransformMode: () => false,
    } as unknown as LayoutToolEditorSystem);
    rig.switcher.transformModeApply(TransformMode.SCALE);
    expect(rig.setActiveTransformMode).not.toHaveBeenCalled();
  });

  it('sets the gizmo directly when no tool system exists yet', () => {
    const rig = transformModeSwitcherRigCreate(false, null);
    rig.switcher.transformModeApply(TransformMode.SCALE);
    expect(rig.gizmoModeRead()).toBe(TransformMode.SCALE);
    expect(rig.host.gizmoPivotUpdate).toHaveBeenCalled();
  });

  it('turns Edit Mode transform widgets off when the active mode is chosen again', () => {
    const rig = transformModeSwitcherRigCreate(true, null);
    rig.switcher.transformModeApply(TransformMode.ROTATE);
    expect(rig.gizmoModeRead()).toBe(TransformMode.ROTATE);
    rig.switcher.transformModeApply(TransformMode.ROTATE);
    expect(rig.gizmoModeRead()).toBe(TransformMode.BOUNDS);
    expect(rig.setActiveTransformMode).toHaveBeenLastCalledWith(TransformMode.BOUNDS);
    expect(rig.host.showStatusMessage).toHaveBeenCalledWith('Transform widgets off');
  });

  it('ignores Bounds in Edit Mode', () => {
    const rig = transformModeSwitcherRigCreate(true, null);
    const modeBefore = rig.gizmoModeRead();
    rig.switcher.transformModeApply(TransformMode.BOUNDS);
    expect(rig.gizmoModeRead()).toBe(modeBefore);
  });
});
