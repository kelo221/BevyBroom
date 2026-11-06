import type { EditorApiHost } from './editor_api_host.js';
import { okResult } from './editor_api_result.js';
import { editorApiDisplacementFaceDescribe } from './editor_api_displacement.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';

/** One selected brush face of a get_face_edit_state reply. */
interface EditorApiFaceEditStateFace {
  brushId: string;
  faceIndex: number;
  displaced: boolean;
}

/** Reply data of get_face_edit_state. */
interface EditorApiFaceEditState {
  activeTool: string | null;
  faceEditSheetOpen: boolean;
  faceEditSheetTab: string;
  faces: EditorApiFaceEditStateFace[];
}

/** Reads the active editor tool, the Face Edit Sheet and the face selection. */
export class EditorApiFaceEdit {
  /**
   * Creates the face edit state tool.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a face edit tool.
   *
   * @param name Tool name.
   * @returns Tool result, or null when the name is no face edit tool.
   */
  faceEditToolDispatch(name: string): McpToolResult | null {
    return name === 'get_face_edit_state' ? okResult('Face edit state', this.faceEditStateRead()) : null;
  }

  /**
   * Collects the active tool, the Face Edit Sheet state and the selected faces.
   *
   * @returns Face edit state.
   */
  private faceEditStateRead(): EditorApiFaceEditState {
    const session = getStateFaceEditSession();
    return {
      activeTool: this.host.activeToolRead?.() ?? null,
      faceEditSheetOpen: session.sheetOpenRead(),
      faceEditSheetTab: session.activeTabIdRead(),
      faces: this.selectedFacesRead(),
    };
  }

  /**
   * Describes the brush faces of the face selection.
   *
   * @returns Selected faces, empty when face tools are not available.
   */
  private selectedFacesRead(): EditorApiFaceEditStateFace[] {
    const targets = displacementActionsSharedRead()?.selectedTargetsRead() ?? [];
    return targets.map((target) => editorApiDisplacementFaceDescribe(target));
  }
}
