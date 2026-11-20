import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/** Class name of the line that says which objects the collision field changes. */
export const PANEL_PROPERTIES_COLLISION_APPLIES_TO_CLASS = 'panel-properties-collision-applies-to';

/**
 * Lists the objects the collision field writes to that are not themselves
 * selected, which are the solid models whose brushes were selected.
 *
 * @param selectedObjects Objects of the inspector selection.
 * @param writtenObjects Objects the field writes to, each once.
 * @returns The written objects that are not in the selection.
 */
export function panelPropertiesCollisionAppliesToModelsList(
  selectedObjects: readonly THREE.Object3D[],
  writtenObjects: readonly THREE.Object3D[],
): THREE.Object3D[] {
  return writtenObjects.filter((written) => !selectedObjects.includes(written));
}

/**
 * Counts the brushes of solid models.
 *
 * @param modelRoots Solid model roots.
 * @returns Total number of brushes in them.
 */
function panelPropertiesCollisionAppliesToBrushCount(modelRoots: readonly THREE.Object3D[]): number {
  return modelRoots.reduce((total, root) => total + (SolidModel.fromObject(root)?.getBrushCount() ?? 0), 0);
}

/**
 * Words the brush count, with a singular for one brush.
 *
 * @param brushCount Number of brushes.
 * @returns Text such as `1 brush` or `4 brushes`.
 */
function panelPropertiesCollisionAppliesToBrushesText(brushCount: number): string {
  return brushCount === 1 ? '1 brush' : `${brushCount} brushes`;
}

/**
 * Composes the line telling which solid models a collision change reaches.
 *
 * @param modelRoots Solid model roots the field writes to; at least one.
 * @returns Text naming the model, or counting the models when there are
 *   several.
 */
export function panelPropertiesCollisionAppliesToTextCompose(modelRoots: readonly THREE.Object3D[]): string {
  const brushesText = panelPropertiesCollisionAppliesToBrushesText(
    panelPropertiesCollisionAppliesToBrushCount(modelRoots),
  );
  const [onlyRoot] = modelRoots;
  if (modelRoots.length === 1 && onlyRoot !== undefined) {
    return `Applies to the whole model ${onlyRoot.name}: ${brushesText}`;
  }
  return `Applies to ${modelRoots.length} whole models: ${brushesText} in total`;
}

/**
 * Creates the hidden line shown above the collision field.
 *
 * @returns Styled line element.
 */
export function panelPropertiesCollisionAppliesToElementCreate(): HTMLElement {
  const lineElement = document.createElement('div');
  lineElement.className = PANEL_PROPERTIES_COLLISION_APPLIES_TO_CLASS;
  lineElement.style.display = 'none';
  lineElement.style.padding = '0 8px 6px';
  lineElement.style.fontSize = '11px';
  lineElement.style.color = Theme.buttonTextColor;
  return lineElement;
}
