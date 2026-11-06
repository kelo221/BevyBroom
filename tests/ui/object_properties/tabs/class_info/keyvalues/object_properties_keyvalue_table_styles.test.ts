import { afterEach, describe, expect, it } from 'vitest';
import {
  KEYVALUE_TABLE_FRAME_CLASS,
  KEYVALUE_TABLE_ROW_CLASS,
  objectPropertiesKeyvalueTableStylesEnsure,
} from '@/ui/object_properties/tabs/class_info/keyvalues/object_properties_keyvalue_table_styles.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputSelect } from '@/ui/input/input_select.js';

/**
 * Builds a table frame with one row holding a control and returns the control
 * mounted in the document.
 *
 * @param control Control element placed in the row.
 * @returns The same control, now inside the table.
 */
function keyvalueTableStylesTestMount<TElement extends HTMLElement>(control: TElement): TElement {
  objectPropertiesKeyvalueTableStylesEnsure(document);
  const frame = document.createElement('div');
  frame.className = KEYVALUE_TABLE_FRAME_CLASS;
  const row = document.createElement('div');
  row.className = KEYVALUE_TABLE_ROW_CLASS;
  row.append(document.createElement('span'), control);
  frame.appendChild(row);
  document.body.appendChild(frame);
  return control;
}

/**
 * The keyvalue table stylesheet fits selects into the compact rows without
 * clipping and aligns every value the same way.
 */
describe('objectPropertiesKeyvalueTableStylesEnsure', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('drops the vertical padding of selects in table rows so their text is not clipped', () => {
    const select = keyvalueTableStylesTestMount(
      new InputSelect([{ value: 'point', label: 'Point' }], 'Type').getElement(),
    );
    const computed = getComputedStyle(select);
    expect(computed.paddingTop).toBe('0px');
    expect(computed.paddingBottom).toBe('0px');
  });

  it('aligns numeric values left in the UI font like text values', () => {
    const numeric = keyvalueTableStylesTestMount(new InputNumeric({ textAlign: 'right' }).getElement());
    const computed = getComputedStyle(numeric);
    expect(computed.textAlign).toBe('left');
    expect(computed.fontFamily).not.toContain('monospace');
  });
});
