/**
 * Classic Hammer++ palette: light grey Windows chrome, black 2D views, grey 3D
 * view, red selection. Frozen so runtime code cannot mutate shared palette
 * values.
 */
export const ThemePaletteHammer = Object.freeze({
  background: 0xd4d0c8,
  viewportBackground: 0x6e6e6e,
  /** Background of the orthographic 2D views. */
  viewport2dBackground: 0x000000,
  gridColor: 0x2a2a2a,
  gridOriginColor: 0x505a64,
  /** Major (every Nth) grid lines of the 2D views. */
  gridMajorColor: 0x3c4650,
  gridXAxisColor: 0x8b0000,
  gridYAxisColor: 0x006400,
  gridZAxisColor: 0x00008b,
  selectionColor: 0xff2020,
  /** Accent of toggled-on toolbar buttons and active tool states. */
  toggleAccentColor: 0x0078d7,
  /**
   * Stable per-object wireframe palette of unselected objects in the 2D views
   * (Hammer cyans, greens, blues and purples).
   */
  objectWirePalette: Object.freeze([
    0x00e0e0, 0x20c0ff, 0x40ff80, 0x00c060, 0x6080ff, 0xa060ff, 0xe060e0, 0x80e0a0, 0x40a0ff, 0xc0a0ff, 0x00ffb0,
    0x60c0c0,
  ]),
  /** Amber warning for coincident edit vertices. */
  vertexCoincidentWarningColor: 0xf0c419,
  /** Legacy single clip marker color (point 1 fallback). */
  clipMarkerColor: 0xf0b429,
  /** Clip placement points: amber, teal and violet for contrast on black views. */
  clipPoint1Color: 0xf0b429,
  clipPoint2Color: 0x3db8c9,
  clipPoint3Color: 0xc48ad9,
  /** Keep-side half-brush preview fill. */
  clipKeepColor: 0x3a8f6e,
  /** Discard-side half-brush preview fill. */
  clipDiscardColor: 0xe45b4c,
  /** Thin construction polyline between clip points. */
  clipConstructionLineColor: 0x7a8a9a,
  /** Plane-brush cut edge silhouette. */
  clipCutEdgeColor: 0xff4040,
  /** Placed Polygon tool outline edges and points. */
  polygonOutlineColor: 0xffe040,
  /** Polygon tool rubber-band edges from the outline to the pointer. */
  polygonOutlineRubberBandColor: 0x9aa4ae,
  /** Screen size in pixels of the Polygon tool outline points. */
  polygonOutlinePointSizePx: 7,
  separatorColor: 0x808080,
  separatorGapPx: 3,
  boxColor: 0xffffff,
  boxEdgeColor: 0xaaaaaa,
  lightAmbient: 0xffffff,
  lightDirectional: 0xffffff,
  viewportLabelTextColor: '#ffffff',
  viewportLabelBackgroundColor: 'rgba(0, 0, 0, 0.55)',
  widgetXAxisColor: 0xff3333,
  widgetYAxisColor: 0x33ff33,
  widgetZAxisColor: 0x3333ff,
  widgetBackgroundColor: 0x000000,
  toolbarBackground: 0xf0f0f0,
  toolbarBackgroundEnd: 0xe4e4e4,
  outlinerBackground: 0xffffff,
  buttonBackground: 0xe1e1e1,
  buttonHoverColor: 0xe5f1fb,
  buttonTextColor: '#000000',
  /** Background of a button while pressed or toggled on. */
  buttonPressedBackground: '#cce4f7',
  /** Border of a toggled-on button. */
  toggleActiveBorder: '#005499',
  /** Light (top-left) edge of raised 3D chrome. */
  chromeBevelLight: '#ffffff',
  /** Dark (bottom-right) edge of raised 3D chrome. */
  chromeBevelDark: '#a0a0a0',
  /** Normal border of buttons, fields and group boxes. */
  chromeBorderColor: '#adadad',
  /** Background of sunken panels such as lists and text areas. */
  panelSunkenBackground: '#ffffff',
  /** Background of window and dock panels. */
  panelBackground: '#f0f0f0',
  /** Translucent overlay drawn over hovered rows and icon buttons. */
  hoverOverlay: 'rgba(0, 120, 215, 0.10)',
  /** Keyboard focus outline. */
  focusOutline: '#0078d7',
  /** Text of disabled controls. */
  disabledTextColor: '#a0a0a0',
  /** Secondary (dimmer) text such as captions and hints. */
  secondaryTextColor: '#505050',
  /** Background of the active tab. */
  tabActiveBackground: '#ffffff',
  /** Text and underline of the active tab. */
  tabActiveAccent: '#0078d7',
  /** Background of the title bar of floating windows. */
  windowTitleBackground: '#ffffff',
  /** Dim suffix for auto hex ids in the outliner (e.g. ".001" after Brush). */
  outlinerNameIdColor: '#8a8a8a',
  outlinerSelectedColor: 'rgba(0, 120, 215, 0.25)',
  gizmoXAxisColor: 0xff3333,
  gizmoYAxisColor: 0x33ff33,
  gizmoZAxisColor: 0x3333ff,
  /** Free-move center handle on the translate gizmo. */
  gizmoCenterColor: 0xd8d8d8,
  gizmoHoverColor: 0xffffff,
  boundsWireColor: 0xffff00,
  /** Fill of bounds resize grips (Hammer-style white squares in 2D). */
  boundsHandleColor: 0xffffff,
  /** Thin border drawn around the 2D bounds resize squares. */
  boundsHandleOutlineColor: 0x000000,
  /** Hover / active color for bounds resize grips. */
  boundsHandleHoverColor: 0xff2020,
  /** CAD size-dimension lines and ticks. */
  rulerSizeColor: 0x5ec8ff,
  /** CAD drag-delta total path. */
  rulerDeltaColor: 0xff6040,
  /** Ghost bounds wireframe while transforming. */
  rulerGhostColor: 0x6a7a8a,
  /** Construction rays that point at measured corners. */
  rulerExtensionColor: 0x8a9aaa,
  /** DOM label text for size dimensions. */
  rulerLabelSizeText: '#9ee0ff',
  /** DOM label text for drag deltas. */
  rulerLabelDeltaText: '#ffb070',
  /** DOM label chip background for ruler text. */
  rulerLabelBackground: 'rgba(0, 0, 0, 0.8)',
  /** DOM label chip border for ruler text. */
  rulerLabelBorder: 'rgba(120, 160, 200, 0.35)',
  propertiesPanelBackground: 0xf0f0f0,
  inputBackgroundColor: '#ffffff',
  inputTextColor: '#000000',
  inputBorderColor: '#7a7a7a',
  statusBarBackground: '#f0f0f0',
  statusBarTextColor: '#000000',
  statusBarBorderColor: '#a0a0a0',
  /** Corner radius of buttons, fields and small controls in pixels. */
  controlRadiusPx: 2,
  /** Corner radius of dialogs and floating windows in pixels. */
  windowRadiusPx: 2,
  /** Corner radius of drop-down and context menus in pixels. */
  menuRadiusPx: 0,
  /** Corner radius of the corner labels of the viewports in pixels. */
  viewportLabelRadiusPx: 0,
  /** Corner radius of the highlighted menu row in pixels. */
  menuRowRadiusPx: 0,
  /**
   * CSS backdrop filter of menus, dialogs and floating windows; none keeps them
   * opaque.
   */
  glassBackdropFilter: 'none',
  /**
   * Window background behind translucent glass chrome; unused by the classic
   * look.
   */
  glassWallpaperGradient: 'linear-gradient(180deg, #d4d0c8 0%, #d4d0c8 100%)',
  /** Frosted face of glass bars and docks. */
  glassPanelFace: 'rgba(255, 255, 255, 0.52)',
  /** Overlay of hovered glass controls. */
  glassControlHover: 'rgba(0, 0, 0, 0.06)',
  /** Face of resting glass push buttons. */
  glassControlFace: 'rgba(255, 255, 255, 0.72)',
  /** Hairline rim of glass surfaces. */
  glassRimColor: 'rgba(255, 255, 255, 0.65)',
  /** Shadow under floating glass docks. */
  glassDockShadow: '0 0 0 rgba(0, 0, 0, 0)',
  /** Shadow under resting glass push buttons. */
  glassButtonShadow: '0 0 0 rgba(0, 0, 0, 0)',
  /** Face of dialogs and floating windows. */
  windowBackground: '#f0f0f0',
  uiFontFamily: 'Tahoma, "Segoe UI", system-ui, sans-serif',
  /** Base font size of chrome text in pixels. */
  uiFontSizePx: 11,
  /** Height of the single main toolbar row. */
  toolbarHeightPx: 30,
  /** Height of the corner label of a viewport. */
  viewportLabelHeightPx: 16,
  /**
   * Reserved vertical space for the floating tool options bar under the corner
   * label of a detached viewport (used to place the floating tool rail below
   * it).
   */
  viewportToolOptionsBarHeightPx: 36,
  /** Inset of the floating tool panel below the options bar. */
  viewportToolFloatingOffsetTopPx: 10,
  /** Inset of the floating tool panel from the left of the content area. */
  viewportToolFloatingOffsetLeftPx: 10,
  /** Size of a left tool palette button. */
  toolPaletteButtonPx: 36,
  /** Size of an icon inside a left tool palette button. */
  toolPaletteIconPx: 32,
  /** Size of a toolbar button. */
  toolbarButtonPx: 24,
  /** Size of an icon inside a toolbar button. */
  toolbarIconPx: 20,
  /** Height of the collapsed Console / Issues strip. */
  infoStripHeightPx: 20,
  /** Height of the status bar. */
  statusBarHeightPx: 18,
  /** Default width of the right dock. */
  rightDockWidthPx: 220,
  /** Height of compact dock buttons and fields. */
  dockControlHeightPx: 20,
  /** Frame drawn around the viewport pane under the pointer. */
  viewportFocusBorderColor: '#ffff00',
  /**
   * Text and badge color of entity I/O connections whose target matches
   * nothing.
   */
  logicTargetBrokenColor: '#d03020',
  /** Severity colors of console lines and issue badges. */
  severityErrorColor: '#c00000',
  severityWarningColor: '#a06000',
  severityInfoColor: '#000000',
  /** Monospace font of code, URL and log text. */
  monospaceFontFamily: 'Consolas, "Courier New", ui-monospace, monospace',
  /** Text drawn on accent fills such as highlighted menu rows and badges. */
  inverseTextColor: '#ffffff',
  /** Background of drop-down and context menus. */
  menuBackground: '#f0f0f0',
  /** Border of drop-down and context menus. */
  menuBorderColor: '#a0a0a0',
  /** Background of the highlighted menu row. */
  menuHighlightBackground: '#0067c0',
  /** Text of the highlighted menu row. */
  menuHighlightTextColor: '#ffffff',
  /** Separator line between menu sections. */
  menuSeparatorColor: '#d0d0d0',
  /** Shadow under drop-down and context menus. */
  menuShadow: '2px 2px 4px rgba(0, 0, 0, 0.25)',
  /** Shadow under floating tool windows. */
  windowShadow: '0 2px 8px rgba(0, 0, 0, 0.30)',
  /** Shadow under modal dialogs. */
  dialogShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
  /** Dimming layer behind modal dialogs. */
  modalBackdropColor: 'rgba(0, 0, 0, 0.35)',
  /** Background of selected rows and tiles in lists and browsers. */
  listSelectedBackground: '#cce8ff',
  /** Border of selected rows and tiles in lists and browsers. */
  listSelectedBorder: '#0078d7',
  /** Thin grid lines between table rows and columns. */
  tableGridLineColor: '#e0e0e0',
  /** Background of group header rows in property tables. */
  tableGroupRowBackground: '#f0f0f0',
  /** Track of light scrollbars. */
  scrollbarTrackColor: '#f0f0f0',
  /** Thumb of light scrollbars. */
  scrollbarThumbColor: '#cdcdcd',
  /** Arrow glyphs of light scrollbars. */
  scrollbarArrowColor: '#606060',
  /** Backdrop behind texture and material previews before they load. */
  textureThumbnailBackground: '#202020',
  /** Overlay over a layout area that a gesture will merge into. */
  areaJoinPreviewOverlay: 'rgba(0, 120, 215, 0.18)',
  /** Overlay over a layout area that a gesture will detach. */
  areaDetachPreviewOverlay: 'rgba(0, 150, 170, 0.16)',
  /** Shadow under DOM label chips drawn over the viewports. */
  viewportChipShadow: '0 1px 4px rgba(0, 0, 0, 0.45)',
  /** Surface grid projected onto brush faces: minor, section and major lines. */
  projectedGridMinorColor: 0x3a3a3a,
  projectedGridSectionColor: 0x555555,
  projectedGridMajorColor: 0x888888,
  /** Edge overlay of content meshes in wireframe shading. */
  wireframeOverlayColor: 0xd0d0d0,
  /** 3D edge colors of solid brushes per CSG operation. */
  solidEdgeAdditiveColor: 0x58d68d,
  solidEdgeSubtractiveColor: 0xff6b5a,
  solidEdgeIntersectingColor: 0x5dade2,
  /** Selected hull fill colors of solid brushes per CSG operation. */
  solidFillAdditiveColor: 0x27ae60,
  solidFillSubtractiveColor: 0xc0392b,
  solidFillIntersectingColor: 0x2980b9,
  /** Warning tint of non-convex brush previews. */
  solidNonConvexTintColor: 0x9b59b6,
  /** Volume preview of bevel modifier volumes. */
  modifierVolumeColor: 0xe67e22,
  /** Mirror plane guide lines drawn inside a selected modifier volume. */
  modifierStackMirrorGuideColor: 0xff3fb4,
  /** Box of the cordon bounds. */
  cordonColor: 0xff5533,
  /** Sphere and normal arrow of the displacement sculpt cursor. */
  displacementCursorSphereColor: 0x33ff4d,
  displacementCursorArrowColor: 0xffd21f,
  /** Sphere of the Sprinkle scatter radius cursor. */
  sprinkleCursorSphereColor: 0x33ccff,
  /** Sphere of the Sprinkle radius cursor while painting would remove entities. */
  sprinkleCursorSubtractiveColor: 0xff7a1f,
  /** Lattice drawn over displacement surfaces. */
  displacementOverlayGridColor: 0xffffff,
  /** Edit Mode cage lines in the 3D and 2D views. */
  editCageLineColor3d: 0x000000,
  editCageLineColor2d: 0xffffff,
  /** Unselected and selected Edit Mode cage vertices. */
  editCageVertexColor: 0x00a0ff,
  editSelectedVertexColor: 0xffffff,
  /** Non-edited wires in the 2D views while Edit Mode is open. */
  editRestWireColor2d: 0x505050,
  /** Light rim and dark halo around clip placement points. */
  clipMarkerRimColor: 0xe8eef4,
  clipMarkerHaloColor: 0x0c0e12,
  /** Open and closed portal surfaces. */
  portalOpenColor: 0x66bb6a,
  portalClosedColor: 0xef5350,
  /** Guide outline of rooms. */
  roomGuideColor: 0x4fc3f7,
  /** Marker of entity kinds without their own color. */
  entityIconDefaultColor: 0xb0b0b0,
  /** Marker of game entities whose classes the editor does not know. */
  gameEntityUnknownColor: 0x808080,
  /** Default color of new user visgroups. */
  visgroupDefaultColor: 0x5c9aff,
  /**
   * Object type glyph colors of the outliner, picked to read on the white list
   * background.
   */
  outlinerIconColors: Object.freeze({
    solidAdditive: '#1e8449',
    solidSubtractive: '#c0392b',
    solidIntersecting: '#2980b9',
    folder: '#c0661a',
    modifierVolume: '#c0661a',
    solidModel: '#d35400',
    solidResult: '#b9770e',
    box: '#2e86c1',
    sphere: '#239b56',
    plane: '#8e44ad',
    cylinder: '#148f77',
    genericMesh: '#707b7c',
    directionalLight: '#ca6f1e',
    pointLight: '#9a7d0a',
    spotLight: '#cb4335',
    genericLight: '#9a7d0a',
    camera: '#cb4335',
    generic: '#5f6a6a',
  }),
  /** Ring drawn around the outliner's round operation dots. */
  outlinerIconDotShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)',
  /** Expand and collapse chevrons of tree rows. */
  treeChevronColor: '#606060',
  /** Row switch (visibility, lock, layer flags) while on. */
  rowToggleOnColor: '#202020',
  /** Row switch (visibility, lock, layer flags) while off. */
  rowToggleOffColor: '#a0a0a0',
  /** Lock switch of a tree row while the object is locked. */
  rowLockOnColor: '#c05000',
  /** Red slash drawn over a hidden or switched-off row icon. */
  iconOffSlashColor: '#d03020',
  /** Glow of a pulsing count badge on the info panel strip. */
  badgePulseGlowColor: 'rgba(192, 0, 0, 0.45)',
});

/** Widens literal number and string token types to number and string. */
type ThemePaletteTokensWiden<Tokens> = {
  readonly [TokenName in keyof Tokens]: Tokens[TokenName] extends number
    ? number
    : Tokens[TokenName] extends string
      ? string
      : Tokens[TokenName] extends readonly number[]
        ? readonly number[]
        : ThemePaletteTokensWiden<Tokens[TokenName]>;
};

/** Shape every theme palette shares, taken from the classic Hammer++ palette. */
export type ThemePalette = ThemePaletteTokensWiden<typeof ThemePaletteHammer>;
