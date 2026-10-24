import { createDefaultCoordinateSpace } from '@/settings/coordinate/coordinate_space_presets.js';
import type {
  GameProfile,
  KeyboardShortcutSettings,
  MouseSettings,
  UpdateSettings,
  ViewSettings,
} from './settings_types.js';

/** Default game profile display name. */
export const DEFAULT_GAME_PROFILE_NAME = 'Default';

/**
 * Creates a fresh default game profile with metric meters and Godot axes.
 *
 * @param id Stable unique identifier for the profile.
 * @param name Optional display name.
 * @returns New game profile object.
 */
export function createDefaultGameProfile(id: string, name: string = DEFAULT_GAME_PROFILE_NAME): GameProfile {
  return {
    id,
    name,
    unitSystem: 'metric',
    metricUnit: 'meter',
    imperialUnit: 'foot',
    coordinateSpace: createDefaultCoordinateSpace(),
  };
}

/**
 * Returns default View tab settings.
 *
 * @returns Fresh view settings snapshot.
 */
export function createDefaultViewSettings(): ViewSettings {
  return {
    theme: 'dark',
    brightness: 100,
    materialBrowserIconSizePercent: 100,
    rendererFontSize: 13,
    viewportPaneCount: 4,
    textureFilterMode: 'trilinear',
    anisotropyPreference: 'max',
    toolbarButtonLabels: true,
    faceInspectorAutoReveal: true,
  };
}

/**
 * Returns default Mouse tab navigation settings.
 *
 * @returns Fresh mouse settings snapshot.
 */
export function createDefaultMouseSettings(): MouseSettings {
  return {
    lookSensitivity: 50,
    lookInvertXAxis: false,
    lookInvertYAxis: false,
    panSensitivity: 50,
    panInvertXAxis: false,
    panInvertYAxis: false,
    moveSpeed: 5,
    moveSensitivity: 30,
    invertMouseWheel: false,
    altMiddleMouseDragMovesCamera: false,
    invertAltMiddleMouseDragZAxis: false,
    moveCameraTowardsCursor: false,
  };
}

/** Returns default standalone updater preferences. */
export function createDefaultUpdateSettings(): UpdateSettings {
  return { automaticChecks: false };
}

/**
 * Returns default Keyboard tab bindings.
 *
 * @returns Fresh keyboard shortcut settings snapshot.
 */
export function createDefaultKeyboardShortcutSettings(): KeyboardShortcutSettings {
  return {
    ...createDefaultTransformShortcuts(),
    ...createDefaultEditFileShortcuts(),
    ...createDefaultNavigationShortcuts(),
    ...createDefaultShadingSnapClipShortcuts(),
    ...createDefaultWindowShortcuts(),
    ...createDefaultFaceUvShortcuts(),
  };
}

/**
 * Default face-mode UV editing shortcuts: arrows nudge the texture relative to
 * the camera, PageUp/PageDown rotate by the grid angle, Ctrl+F and Ctrl+Alt+F
 * mirror, and Shift+R / Alt+Shift+R reset alignment. They only act while face
 * mode has selected faces.
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultFaceUvShortcuts(): Pick<
  KeyboardShortcutSettings,
  | 'face_uv_nudge_left'
  | 'face_uv_nudge_right'
  | 'face_uv_nudge_up'
  | 'face_uv_nudge_down'
  | 'face_uv_rotate_ccw'
  | 'face_uv_rotate_cw'
  | 'face_uv_flip_h'
  | 'face_uv_flip_v'
  | 'face_uv_reset_face'
  | 'face_uv_reset_world'
> {
  return {
    face_uv_nudge_left: createShortcut('ArrowLeft'),
    face_uv_nudge_right: createShortcut('ArrowRight'),
    face_uv_nudge_up: createShortcut('ArrowUp'),
    face_uv_nudge_down: createShortcut('ArrowDown'),
    face_uv_rotate_ccw: createShortcut('PageUp'),
    face_uv_rotate_cw: createShortcut('PageDown'),
    face_uv_flip_h: createShortcut('KeyF', true),
    face_uv_flip_v: createShortcut('KeyF', true, false, true),
    face_uv_reset_face: createShortcut('KeyR', false, true),
    face_uv_reset_world: createShortcut('KeyR', false, true, true),
  };
}

/**
 * Default view, play, panel and selection shortcuts that follow map editor
 * conventions: Space cycles the hovered view, Ctrl+Space maximizes it, Ctrl+1
 * to Ctrl+3 show the Map, Entity and Face inspector tabs, Ctrl+4 and Ctrl+5
 * toggle the info panel and inspector.
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultWindowShortcuts(): Pick<
  KeyboardShortcutSettings,
  | 'view_cycle'
  | 'view_maximize'
  | 'play_start'
  | 'inspector_map'
  | 'inspector_entity'
  | 'inspector_face'
  | 'info_panel_toggle'
  | 'inspector_toggle'
  | 'toolbar_toggle'
  | 'select_all'
  | 'select_none'
  | 'visibility_hide'
  | 'visibility_isolate'
  | 'visibility_show_all'
> {
  return {
    view_cycle: createShortcut('Space'),
    view_maximize: createShortcut('Space', true),
    play_start: createShortcut('F5'),
    inspector_map: createShortcut('Digit1', true),
    inspector_entity: createShortcut('Digit2', true),
    inspector_face: createShortcut('Digit3', true),
    info_panel_toggle: createShortcut('Digit4', true),
    inspector_toggle: createShortcut('Digit5', true),
    toolbar_toggle: createShortcut('KeyT', true, false, true),
    select_all: createShortcut('KeyA', true),
    select_none: createShortcut('KeyA', true, true),
    visibility_hide: createShortcut('KeyH', true),
    visibility_isolate: createShortcut('KeyI', true),
    visibility_show_all: createShortcut('KeyH', true, true),
  };
}

/**
 * Default transform-mode, selection-tool, interaction-mode, and Edit Mode
 * component-mode shortcuts. Digit 1–3 select vertex / edge / face while Edit
 * Mode is active (object-mode shading keeps the same digits).
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultTransformShortcuts(): Pick<
  KeyboardShortcutSettings,
  | 'move'
  | 'rotate'
  | 'scale'
  | 'bounds'
  | 'face'
  | 'selection_object'
  | 'interaction_mode'
  | 'component_vertex'
  | 'component_edge'
  | 'component_face'
> {
  return {
    move: createShortcut('KeyW'),
    rotate: createShortcut('KeyE'),
    scale: createShortcut('KeyR'),
    bounds: createShortcut('KeyT'),
    face: createShortcut('Tab', false, true),
    selection_object: createShortcut('KeyO'),
    interaction_mode: createShortcut('Tab'),
    component_vertex: createShortcut('Digit1'),
    component_edge: createShortcut('Digit2'),
    component_face: createShortcut('Digit3'),
  };
}

/**
 * Default edit and file operation shortcuts. Ctrl+Alt+V pastes at the copied
 * position; Cut, Copy and Paste use the fixed system clipboard keys.
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultEditFileShortcuts(): Pick<
  KeyboardShortcutSettings,
  | 'delete_selected'
  | 'escape'
  | 'save'
  | 'save_as'
  | 'load'
  | 'export_glb'
  | 'undo'
  | 'redo'
  | 'redo_alternate'
  | 'duplicate'
  | 'group'
  | 'ungroup'
  | 'paste_original'
> {
  return {
    delete_selected: createShortcut('Delete'),
    escape: createShortcut('Escape'),
    save: createShortcut('KeyS', true),
    save_as: createShortcut('KeyS', true, true),
    load: createShortcut('KeyO', true),
    export_glb: createShortcut('KeyE', true, true),
    undo: createShortcut('KeyZ', true),
    redo: createShortcut('KeyY', true),
    redo_alternate: createShortcut('KeyZ', true, true),
    duplicate: createShortcut('KeyD', true),
    group: createShortcut('KeyG', false, true),
    ungroup: createShortcut('KeyU', false, true),
    paste_original: createShortcut('KeyV', true, false, true),
  };
}

/**
 * Default camera fit and alignment shortcuts.
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultNavigationShortcuts(): Pick<
  KeyboardShortcutSettings,
  'align_origin' | 'solid_operation_toggle' | 'fit_selection' | 'fit_all'
> {
  return {
    align_origin: createShortcut('KeyG', false, false, true),
    solid_operation_toggle: createShortcut('KeyA'),
    fit_selection: createShortcut('KeyF'),
    fit_all: createShortcut('KeyF', false, true),
  };
}

/**
 * Default shading, snap, extrude, and clip shortcuts.
 *
 * @returns Partial keyboard shortcut settings.
 */
function createDefaultShadingSnapClipShortcuts(): Pick<
  KeyboardShortcutSettings,
  | 'shading_solid'
  | 'shading_wireframe'
  | 'shading_flat'
  | 'shading_wireframe_overlay'
  | 'snap_forward'
  | 'snap_backward'
  | 'snap_forward_large'
  | 'snap_backward_large'
  | 'extrude'
  | 'clip_flip'
  | 'clip_commit'
  | 'clip_split'
> {
  return {
    shading_solid: createShortcut('Digit1'),
    shading_wireframe: createShortcut('Digit2'),
    shading_flat: createShortcut('Digit3'),
    shading_wireframe_overlay: createShortcut('Digit4'),
    snap_forward: createShortcut('Period'),
    snap_backward: createShortcut('Comma'),
    snap_forward_large: createShortcut('Period', false, true),
    snap_backward_large: createShortcut('Comma', false, true),
    extrude: createShortcut('KeyE', false, true),
    clip_flip: createShortcut('KeyF'),
    clip_commit: createShortcut('Enter'),
    clip_split: createShortcut('KeyX'),
  };
}

/**
 * Builds a keyboard shortcut binding.
 *
 * @param code KeyboardEvent.code value.
 * @param ctrl Whether Control is required.
 * @param shift Whether Shift is required.
 * @param alt Whether Alt is required.
 * @param meta Whether Meta is required.
 * @returns Shortcut binding.
 */
function createShortcut(
  code: string,
  ctrl: boolean = false,
  shift: boolean = false,
  alt: boolean = false,
  meta: boolean = false,
): KeyboardShortcutSettings[keyof KeyboardShortcutSettings] {
  return { code, ctrl, shift, alt, meta };
}
