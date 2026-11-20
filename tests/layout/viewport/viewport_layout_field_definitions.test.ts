import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source files of the classes below ViewportLayoutCore. The core constructor
 * wires the editor, so these classes run code before their own field
 * initializers do.
 */
const VIEWPORT_LAYOUT_SUBCLASS_FILES = [
  'src/layout/viewport/viewport_layout_coordinators.ts',
  'src/layout/viewport/viewport_layout_shell_wiring.ts',
  'src/layout/viewport/manager_viewport_layout.ts',
];

/** Matches a class field that the compiled class defines at construction. */
const VIEWPORT_LAYOUT_DEFINED_FIELD_PATTERN =
  /^ {2}(?:(?:private|protected|public|readonly|override) )*(?!declare )(\w+)[?!]?(?::[^=;]+)?(?: = [^;]+)?;$/gm;

/**
 * Returns the names of the fields a source file defines at construction.
 *
 * @param sourceText Class source text.
 * @returns Field names.
 */
function definedFieldNamesRead(sourceText: string): string[] {
  return [...sourceText.matchAll(VIEWPORT_LAYOUT_DEFINED_FIELD_PATTERN)].map((match) => match[1] ?? '');
}

/**
 * Returns whether a source file assigns a field after construction.
 *
 * @param sourceText Class source text.
 * @param fieldName Field name.
 * @returns True when the file writes the field with `=` or `??=`.
 */
function fieldAssignedIs(sourceText: string, fieldName: string): boolean {
  return new RegExp(`this\\.${fieldName} (?:\\?\\?)?= `).test(sourceText);
}

/**
 * The editor builds its panels from inside the ViewportLayoutCore constructor.
 * A subclass field that is defined (for example `x: T | null = null`) is set
 * only after that constructor returns, so it wipes what the wiring stored: the
 * Properties section was created twice and showed twice in the right dock.
 * Fields the wiring writes must be `declare` fields.
 */
describe('ViewportLayoutCore subclass fields', () => {
  it('defines no field that the wiring assigns, so construction keeps what the wiring stored', () => {
    const offendingFields = VIEWPORT_LAYOUT_SUBCLASS_FILES.flatMap((relativePath) => {
      const sourceText = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      return definedFieldNamesRead(sourceText)
        .filter((fieldName) => fieldAssignedIs(sourceText, fieldName))
        .map((fieldName) => `${relativePath}: ${fieldName}`);
    });
    expect(offendingFields).toEqual([]);
  });

  it('finds the fields it guards, so a changed source layout cannot silence it', () => {
    const sampleSource = 'class Sample {\n  private section: Section | null = null;\n  private declare kept?: Kept;\n}';
    expect(definedFieldNamesRead(sampleSource)).toEqual(['section']);
    expect(fieldAssignedIs('this.section ??= create();', 'section')).toBe(true);
  });
});
