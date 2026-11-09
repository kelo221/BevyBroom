import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleRadiusClamp } from '@/tools/sprinkle/radius/sprinkle_radius_scale.js';
import { applyViewportToolOptionsTextButtonMetrics } from './viewport_tool_options_control_style.js';

/**
 * Provides context controls for the Hammer++ Polygon and Sprinkle tools inside
 * `ViewportToolOptionsBar`. The Sprinkle strip holds only the brush radius; the
 * Entity Sprinkle window owns the other Sprinkle settings.
 */
export class ViewportToolPolygonSprinkleControls {
  private readonly polygonRow: HTMLElement;
  private readonly polygonVertexBadge: HTMLElement;
  private readonly polygonDepthInput: HTMLInputElement;
  private readonly sprinkleRow: HTMLElement;
  private readonly sprinkleRadiusInput: HTMLInputElement;
  private readonly unsubscribePolygon: () => void;
  private readonly unsubscribeSprinkle: () => void;

  /**
   * Creates the Polygon and Sprinkle option bar control strips.
   *
   * @param ownerDocument Document used to build DOM elements.
   */
  constructor(ownerDocument: Document) {
    this.polygonRow = ownerDocument.createElement('div');
    this.polygonVertexBadge = ownerDocument.createElement('span');
    this.polygonDepthInput = ownerDocument.createElement('input');
    this.sprinkleRow = ownerDocument.createElement('div');
    this.sprinkleRadiusInput = ownerDocument.createElement('input');
    this.buildPolygonRow(ownerDocument);
    this.buildSprinkleRow(ownerDocument);
    this.unsubscribePolygon = getStatePolygonTool().changeListenerAdd(() => this.syncPolygonRow());
    this.unsubscribeSprinkle = getStateSprinkleTool().changeListenerAdd(() => this.syncSprinkleRow());
    this.syncPolygonRow();
    this.syncSprinkleRow();
  }

  /**
   * Returns the Polygon tool options row element.
   *
   * @returns Polygon controls element.
   */
  polygonElementRead(): HTMLElement {
    return this.polygonRow;
  }

  /**
   * Returns the Sprinkle tool options row element.
   *
   * @returns Sprinkle controls element.
   */
  sprinkleElementRead(): HTMLElement {
    return this.sprinkleRow;
  }

  /** Removes state subscriptions and DOM nodes. */
  dispose(): void {
    this.unsubscribePolygon();
    this.unsubscribeSprinkle();
    this.polygonRow.remove();
    this.sprinkleRow.remove();
  }

  /**
   * Builds the Polygon options row (`Vertices`, `Depth`, `Extrude`, `Clear`).
   *
   * @param doc Owner document.
   */
  private buildPolygonRow(doc: Document): void {
    this.styleRow(this.polygonRow, 'viewport-tool-polygon-controls');
    this.polygonVertexBadge.style.fontSize = '11px';
    this.polygonVertexBadge.style.color = Theme.statusBarTextColor;
    const depthLabel = this.createLabel(doc, 'Depth:');
    this.styleNumberInput(this.polygonDepthInput, '52px', () => {
      const val = Number.parseFloat(this.polygonDepthInput.value);
      if (Number.isFinite(val) && val > 0) {
        getStatePolygonTool().extrusionDepthWrite(val);
      }
    });
    const commitBtn = this.createActionButton(doc, 'Extrude', () => getStatePolygonTool().commit());
    const clearBtn = this.createActionButton(doc, 'Clear', () => getStatePolygonTool().clear());
    this.polygonRow.append(this.polygonVertexBadge, depthLabel, this.polygonDepthInput, commitBtn, clearBtn);
  }

  /**
   * Builds the Sprinkle options row (`Radius`).
   *
   * @param doc Owner document.
   */
  private buildSprinkleRow(doc: Document): void {
    this.styleRow(this.sprinkleRow, 'viewport-tool-sprinkle-controls');
    const radiusLabel = this.createLabel(doc, 'Radius:');
    this.styleNumberInput(this.sprinkleRadiusInput, '48px', () => this.sprinkleRadiusCommit());
    this.sprinkleRadiusInput.min = String(SPRINKLE_RADIUS_MIN);
    this.sprinkleRadiusInput.max = String(SPRINKLE_RADIUS_MAX);
    this.sprinkleRadiusInput.setAttribute('aria-label', 'Sprinkle radius');
    this.sprinkleRow.append(radiusLabel, this.sprinkleRadiusInput);
  }

  /**
   * Stores the typed radius clamped to the Sprinkle radius range, then shows
   * the stored radius.
   */
  private sprinkleRadiusCommit(): void {
    const typedRadius = Number.parseFloat(this.sprinkleRadiusInput.value);
    if (Number.isFinite(typedRadius)) {
      getStateSprinkleTool().configPatch({ radius: sprinkleRadiusClamp(typedRadius) });
    }
    this.syncSprinkleRow();
  }

  /**
   * Applies inline flex layout to a tool options row.
   *
   * @param row Row element.
   * @param className CSS class name.
   */
  private styleRow(row: HTMLElement, className: string): void {
    row.className = className;
    row.style.display = 'inline-flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
  }

  /**
   * Creates a compact text label span.
   *
   * @param doc Owner document.
   * @param text Label text.
   * @returns Span element.
   */
  private createLabel(doc: Document, text: string): HTMLSpanElement {
    const span = doc.createElement('span');
    span.textContent = text;
    span.style.fontSize = '11px';
    span.style.color = Theme.statusBarTextColor;
    return span;
  }

  /**
   * Styles a compact numeric input and binds its change listener.
   *
   * @param input Input element.
   * @param width CSS width.
   * @param onCommit Commit callback.
   */
  private styleNumberInput(input: HTMLInputElement, width: string, onCommit: () => void): void {
    input.type = 'number';
    input.step = '0.25';
    input.style.width = width;
    input.style.background = Theme.inputBackgroundColor;
    input.style.color = Theme.buttonTextColor;
    input.style.border = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    input.style.borderRadius = '4px';
    input.style.fontSize = '11px';
    input.style.padding = '2px 4px';
    input.addEventListener('change', onCommit);
  }

  /**
   * Creates a compact options bar action button.
   *
   * @param doc Owner document.
   * @param label Button label.
   * @param onClick Click callback.
   * @returns Button element.
   */
  private createActionButton(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    applyViewportToolOptionsTextButtonMetrics(btn);
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return btn;
  }

  /** Syncs Polygon controls from `StatePolygonTool`. */
  private syncPolygonRow(): void {
    const state = getStatePolygonTool();
    this.polygonVertexBadge.textContent = `Pts: ${state.verticesRead().length}`;
    this.polygonDepthInput.value = String(state.extrusionDepthRead());
  }

  /**
   * Syncs Sprinkle controls from `StateSprinkleTool`, showing the radius with
   * at most three decimals.
   */
  private syncSprinkleRow(): void {
    const cfg = getStateSprinkleTool().configRead();
    this.sprinkleRadiusInput.value = String(Number(cfg.radius.toFixed(3)));
  }
}
