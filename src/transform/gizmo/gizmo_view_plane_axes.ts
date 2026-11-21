import { getHiddenBoundsAxesForViewPlane, type CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import { GizmoAxis } from '@/types/transform_mode.js';

/** The view plane each plane handle moves in. */
const GIZMO_VIEW_PLANE_AXES_HANDLE_PLANES: ReadonlyMap<GizmoAxis, CadViewPlane> = new Map<GizmoAxis, CadViewPlane>([
  [GizmoAxis.XY_PLANE, 'xy'],
  [GizmoAxis.YZ_PLANE, 'yz'],
  [GizmoAxis.XZ_PLANE, 'xz'],
]);

/**
 * Returns whether a translate/scale axis or plane handle should be hidden for a
 * view plane. In Global mode, orthographic panes hide the depth axis (TOP: Y,
 * FRONT: Z, SIDE: X) and every plane handle except the one in the view plane.
 * Local mode keeps every axis so object-local directions remain usable.
 *
 * @param axis Handle axis.
 * @param viewPlane Pane view plane (`xyz` = perspective).
 * @param hideDepthAxes True in Global transform space; false in Local.
 * @returns True when the handle must not be shown or picked.
 */
export function isGizmoAxisHiddenInViewPlane(
  axis: GizmoAxis,
  viewPlane: CadViewPlane,
  hideDepthAxes: boolean,
): boolean {
  if (!hideDepthAxes) return false;
  if (viewPlane === 'xyz') return false;
  const handlePlane = GIZMO_VIEW_PLANE_AXES_HANDLE_PLANES.get(axis);
  if (handlePlane !== undefined) return handlePlane !== viewPlane;
  if (axis !== GizmoAxis.X && axis !== GizmoAxis.Y && axis !== GizmoAxis.Z) return false;
  const hidden = getHiddenBoundsAxesForViewPlane(viewPlane);
  return hidden.includes(axis);
}
