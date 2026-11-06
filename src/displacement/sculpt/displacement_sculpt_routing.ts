import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';

/**
 * Returns whether viewport pointer input should paint displacements instead of
 * selecting faces.
 *
 * @returns True while the Face Edit Sheet shows its Displacement tab and a
 *   paint tool is active.
 */
export function displacementSculptRoutingActiveIs(): boolean {
  const session = getStateFaceEditSession();
  const painting = getStateDisplacementSculpt().settingsRead().activeTool !== 'select';
  return painting && session.sheetOpenRead() && session.activeTabIdRead() === 'displacement';
}
