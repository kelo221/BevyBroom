import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IconHammerCatalog, type IconHammerName } from '@/ui/icons/hammer/icon_hammer_catalog.js';

/** Icon sizes shown side by side for every icon on the sheet. */
const CONTACT_SHEET_SIZES_PX = [24, 32, 64];

/**
 * Builds one labelled sheet cell showing an icon at every sheet size.
 *
 * @param iconName Icon name.
 * @returns Cell markup.
 */
function contactSheetCellBuild(iconName: IconHammerName): string {
  const renders = CONTACT_SHEET_SIZES_PX.map((sizePx) => IconHammerCatalog.svg(iconName, sizePx)).join('');
  return `<div class="cell"><div class="icons">${renders}</div><div class="label">${iconName}</div></div>`;
}

/**
 * Builds the whole contact sheet page on the classic grey chrome background.
 *
 * @returns HTML document text.
 */
function contactSheetPageBuild(): string {
  const style =
    'body{background:#f0f0f0;font:11px Tahoma,sans-serif;margin:8px}.grid{display:flex;flex-wrap:wrap;gap:6px}' +
    '.cell{width:150px;border:1px solid #a0a0a0;padding:4px;background:#f0f0f0}.icons{display:flex;gap:6px;align-items:end}';
  const cells = IconHammerCatalog.namesRead().map(contactSheetCellBuild).join('');
  return `<!doctype html><html><head><style>${style}</style></head><body><div class="grid">${cells}</div></body></html>`;
}

/**
 * Writes the contact sheet to the temporary directory, or to the path given as
 * the first argument, and prints the written path.
 */
function contactSheetWrite(): void {
  const outputPath = process.argv[2] ?? join(tmpdir(), 'tmp_icon_sheet.html');
  writeFileSync(outputPath, contactSheetPageBuild());
  console.log(outputPath);
}

contactSheetWrite();
