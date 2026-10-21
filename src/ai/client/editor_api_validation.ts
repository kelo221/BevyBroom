import type { EditorApiHost } from './editor_api_host.js';
import { findBrush, findSolidModel } from './editor_api_lookup.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { solidModelWarningsCollect } from '@/solid/validation/solid_model_warnings.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/** Validation helpers wrapping SolidBrushValidator and simple CSG warnings. */
export class EditorApiValidation {
  private readonly host: EditorApiHost;

  /**
   * Creates validation helpers.
   *
   * @param host Injected editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Validates one brush topology and convexity assumptions.
   *
   * @param brushId Brush id.
   * @returns Tool result with validation payload.
   */
  validateBrush(brushId: string): McpToolResult {
    const found = findBrush(this.host.worldObject, brushId);
    if (!found) return { ok: false, message: `Brush not found: ${brushId}` };
    const result = SolidBrushValidator.validate(found.brush.brush);
    return {
      ok: result.valid,
      message: result.valid ? 'Brush is valid' : 'Brush has validation errors',
      data: { brushId, valid: result.valid, errors: result.errors },
      warnings: result.errors,
    };
  }

  /**
   * Validates all brushes in a solid model and reports simple CSG warnings.
   *
   * @param modelId Solid model root uuid.
   * @returns Tool result with per-brush results and warnings.
   */
  validateSolidModel(modelId: string): McpToolResult {
    const model = findSolidModel(this.host.worldObject, modelId);
    if (!model) return { ok: false, message: `Solid model not found: ${modelId}` };
    const brushes = model.getBrushes();
    const brushResults = brushes.map((brush) => this.validateOneBrush(brush));
    const warnings = solidModelWarningsCollect(model, brushes).map((warning) => warning.text);
    const allValid = brushResults.every((entry) => entry.valid);
    return {
      ok: allValid,
      message: allValid ? 'Solid model brushes are valid' : 'Solid model has validation issues',
      data: { modelId, brushes: brushResults, warnings },
      warnings,
    };
  }

  /**
   * Validates a single brush instance topology.
   *
   * @param brush Brush instance.
   * @returns Per-brush validation row.
   */
  private validateOneBrush(brush: SolidBrushInstance): { brushId: string; valid: boolean; errors: string[] } {
    const result = SolidBrushValidator.validate(brush.brush);
    return { brushId: brush.id, valid: result.valid, errors: result.errors };
  }
}
