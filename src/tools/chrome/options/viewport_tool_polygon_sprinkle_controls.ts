import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { SprinklePlacementMode } from '@/tools/sprinkle/sprinkle_types.js';
import { applyViewportToolOptionsTextButtonMetrics } from './viewport_tool_options_control_style.js';

/**
 * Provides context controls for the Hammer++ Polygon and Sprinkle tools inside
 * `ViewportToolOptionsBar`.
 */
export class ViewportToolPolygonSprinkleControls {
  private readonly polygonRow: HTMLElement;
  private readonly polygonVertexBadge: HTMLElement;
  private readonly polygonDepthInput: HTMLInputElement;
  private readonly sprinkleRow: HTMLElement;
  private readonly sprinkleRadiusInput: HTMLInputElement;
  private readonly sprinkleDensityInput: HTMLInputElement;
  private readonly sprinkleModeSelect: HTMLSelectElement;
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
    this.sprinkleDensityInput = ownerDocument.createElement('input');
    this.sprinkleModeSelect = ownerDocument.createElement('select');
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
   * Builds the Sprinkle options row (`Radius`, `Density`, `Mode`).
   *
   * @param doc Owner document.
   */
  private buildSprinkleRow(doc: Document): void {
    this.styleRow(this.sprinkleRow, 'viewport-tool-sprinkle-controls');
    const radiusLabel = this.createLabel(doc, 'Radius:');
    this.styleNumberInput(this.sprinkleRadiusInput, '48px', () => {
      const val = Number.parseFloat(this.sprinkleRadiusInput.value);
      if (Number.isFinite(val) && val > 0) getStateSprinkleTool().configPatch({ radius: val });
    });
    const densityLabel = this.createLabel(doc, 'Density:');
    this.styleNumberInput(this.sprinkleDensityInput, '44px', () => {
      const val = Number.parseFloat(this.sprinkleDensityInput.value);
      if (Number.isFinite(val) && val > 0) getStateSprinkleTool().configPatch({ density: val });
    });
    this.buildSprinkleModeSelect(doc);
    this.sprinkleRow.append(
      radiusLabel,
      this.sprinkleRadiusInput,
      densityLabel,
      this.sprinkleDensityInput,
      this.sprinkleModeSelect,
    );
  }

  /**
   * Populates the Sprinkle placement mode select element.
   *
   * @param doc Owner document.
   */
  private buildSprinkleModeSelect(doc: Document): void {
    this.sprinkleModeSelect.style.background = Theme.inputBackgroundColor;
    this.sprinkleModeSelect.style.color = Theme.buttonTextColor;
    this.sprinkleModeSelect.style.border = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.sprinkleModeSelect.style.borderRadius = '4px';
    this.sprinkleModeSelect.style.fontSize = '11px';
    for (const mode of ['ADDITIVE', 'REPLACE', 'SUBTRACTIVE'] as const) {
      const opt = doc.createElement('option');
      opt.value = mode;
      opt.textContent = mode;
      this.sprinkleModeSelect.appendChild(opt);
    }
    this.sprinkleModeSelect.addEventListener('change', () => {
      getStateSprinkleTool().configPatch({ mode: this.sprinkleModeSelect.value as SprinklePlacementMode });
    });
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

  /** Syncs Sprinkle controls from `StateSprinkleTool`. */
  private syncSprinkleRow(): void {
    const cfg = getStateSprinkleTool().configRead();
    this.sprinkleRadiusInput.value = String(cfg.radius);
    this.sprinkleDensityInput.value = String(cfg.density);
    this.sprinkleModeSelect.value = cfg.mode;
  }
}
