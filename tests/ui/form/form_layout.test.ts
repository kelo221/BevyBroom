import { describe, expect, it } from 'vitest';
import {
  formLayoutFieldLabelCreate,
  formLayoutGridCreate,
  formLayoutGridEqualColumnsCreate,
  formLayoutRowCreate,
} from '@/ui/form/form_layout.js';

/**
 * Creates distinct span cells.
 *
 * @param count Number of cells.
 * @returns Cells named by their index.
 */
function formLayoutTestCellsCreate(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_unused, index) => {
    const cell = document.createElement('span');
    cell.textContent = `cell ${index}`;
    return cell;
  });
}

/** Shared row, grid and caption layout helpers of forms. */
describe('form layout', () => {
  it('keeps row children in order inside a wrapping flex row', () => {
    const cells = formLayoutTestCellsCreate(3);
    const row = formLayoutRowCreate(cells);
    expect([...row.children]).toEqual(cells);
    expect(row.style.display).toBe('flex');
    expect(row.style.flexWrap).toBe('wrap');
  });

  it('fills a grid with the given columns and keeps null cells as empty placeholders', () => {
    const cells = formLayoutTestCellsCreate(2);
    const columns = 'auto minmax(0, 1fr) auto';
    const grid = formLayoutGridCreate(columns, [cells[0] ?? null, null, cells[1] ?? null]);
    expect(grid.style.gridTemplateColumns).toBe(columns);
    expect(grid.children).toHaveLength(3);
    expect(grid.children[0]).toBe(cells[0]);
    expect(grid.children[1]?.childNodes).toHaveLength(0);
    expect(grid.children[2]).toBe(cells[1]);
  });

  it('builds equal columns for the requested column count', () => {
    const columnCount = 4;
    const grid = formLayoutGridEqualColumnsCreate(columnCount, formLayoutTestCellsCreate(columnCount * 2));
    expect(grid.style.gridTemplateColumns).toContain(`repeat(${columnCount},`);
    expect(grid.children).toHaveLength(columnCount * 2);
  });

  it('creates a caption in monospace by default or in the requested font', () => {
    expect(formLayoutFieldLabelCreate('Min').style.fontFamily).toBe('monospace');
    const caption = formLayoutFieldLabelCreate('Type:', 'Tahoma');
    expect(caption.textContent).toBe('Type:');
    expect(caption.style.fontFamily).toBe('Tahoma');
  });
});
