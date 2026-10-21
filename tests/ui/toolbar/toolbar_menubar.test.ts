import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOLBAR_MENUBAR_HEIGHT_PX, Toolbar, type ToolbarVariant } from '@/ui/toolbar/toolbar.js';

/** Toolbars built by the running test. */
const toolbarMenubarTestToolbars: Toolbar[] = [];

/**
 * Builds a toolbar of one variant in a mounted container.
 *
 * @param variant Toolbar variant, or undefined for the default.
 * @returns Toolbar remembered for cleanup.
 */
function toolbarMenubarTestCreate(variant?: ToolbarVariant): Toolbar {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const toolbar = variant === undefined ? new Toolbar(container) : new Toolbar(container, variant);
  toolbarMenubarTestToolbars.push(toolbar);
  return toolbar;
}

/**
 * Returns the leading text of a dropdown header, without any caret.
 *
 * @param header Dropdown header button.
 * @returns Text of the first child when it is a text node, otherwise an empty
 *   string.
 */
function toolbarMenubarTestHeaderTextRead(header: HTMLButtonElement): string {
  const first = header.firstChild;
  return first && first.nodeType === Node.TEXT_NODE ? (first.textContent ?? '') : '';
}

/**
 * Finds the open root dropdown panel mounted on the document body.
 *
 * @returns Open menu panel, or null.
 */
function toolbarMenubarTestOpenPanelRead(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.editor-toolbar-dropdown-menu[style*="display: block"]');
}

afterEach(() => {
  toolbarMenubarTestToolbars.splice(0).forEach((toolbar) => toolbar.dispose());
  document.body.replaceChildren();
});

describe('Toolbar menubar variant', () => {
  it('uses the menu bar class and has no resize handle', () => {
    const menuBar = toolbarMenubarTestCreate('menubar');
    const element = menuBar.getElement();
    expect(element.classList.contains('editor-menubar')).toBe(true);
    expect(element.classList.contains('editor-toolbar')).toBe(false);
    expect(element.querySelector('.editor-toolbar-resize-handle')).toBeNull();
    expect(element.style.minHeight).toBe(`${TOOLBAR_MENUBAR_HEIGHT_PX}px`);
    expect(element.style.flexWrap).toBe('nowrap');
  });

  it('keeps the resize handle and the toolbar class for the default variant', () => {
    const toolbar = toolbarMenubarTestCreate();
    expect(toolbar.getElement().classList.contains('editor-toolbar')).toBe(true);
    expect(toolbar.getElement().querySelector('.editor-toolbar-resize-handle')).not.toBeNull();
  });

  it('draws menu headers as plain text without a dropdown caret', () => {
    const menuBar = toolbarMenubarTestCreate('menubar');
    const header = menuBar.addDropdown('File', [{ label: 'Save', onClick: () => undefined }]);
    expect(header.textContent).toBe('File');
    expect(header.childNodes.length).toBe(1);
    expect(header.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens a menu on click and switches menus on hover like an application menu bar', () => {
    const menuBar = toolbarMenubarTestCreate('menubar');
    const onSave = vi.fn();
    const fileHeader = menuBar.addDropdown('File', [{ label: 'Save', onClick: onSave }]);
    const editHeader = menuBar.addDropdown('Edit', [{ label: 'Undo', onClick: () => undefined }]);
    fileHeader.click();
    expect(toolbarMenubarTestOpenPanelRead()?.textContent).toContain('Save');
    editHeader.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(toolbarMenubarTestOpenPanelRead()?.textContent).toContain('Undo');
    expect(fileHeader.getAttribute('aria-expanded')).toBe('false');
    expect(editHeader.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the slim menu bar presentation when a size is applied', () => {
    const menuBar = toolbarMenubarTestCreate('menubar');
    const slimPadding = menuBar.getElement().style.padding;
    menuBar.setSize('large');
    expect(menuBar.getElement().style.minHeight).toBe(`${TOOLBAR_MENUBAR_HEIGHT_PX}px`);
    expect(menuBar.getElement().style.padding).toBe(slimPadding);
  });

  it('stops closing menus on document presses after it is disposed', () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const menuBar = toolbarMenubarTestCreate('menubar');
    menuBar.dispose();
    const removedTypes = removeEventListener.mock.calls.map((call) => call[0]);
    expect(removedTypes).toContain('pointerdown');
    removeEventListener.mockRestore();
  });
});

describe('Toolbar addSlot', () => {
  it('appends an empty slot with the given class after the controls added before it', () => {
    const toolbar = toolbarMenubarTestCreate();
    const before = toolbar.addButton('Before', () => undefined);
    const slot = toolbar.addSlot('test-tool-slot');
    const after = toolbar.addButton('After', () => undefined);
    const children = [...toolbar.getElement().children];
    expect(slot.classList.contains('test-tool-slot')).toBe(true);
    expect(slot.childElementCount).toBe(0);
    expect(children.indexOf(slot)).toBe(children.indexOf(before) + 1);
    expect(children.indexOf(after)).toBe(children.indexOf(slot) + 1);
  });

  it('does not count the slot or its contents as toolbar buttons', () => {
    const toolbar = toolbarMenubarTestCreate();
    const slot = toolbar.addSlot('test-tool-slot');
    slot.appendChild(document.createElement('button'));
    expect(toolbar.getButtonCount()).toBe(0);
  });
});

describe('Toolbar dropdownLabelSet', () => {
  it('replaces the header text and title while keeping the caret', () => {
    const toolbar = toolbarMenubarTestCreate();
    const header = toolbar.addDropdown('Grid 1.0', [{ label: 'Grid 2.0', onClick: () => undefined }]);
    const nodesBefore = [...header.childNodes];
    const caret = nodesBefore[nodesBefore.length - 1];
    toolbar.dropdownLabelSet(header, 'Grid 2.0');
    expect(toolbarMenubarTestHeaderTextRead(header)).toBe('Grid 2.0');
    expect(header.title).toBe('Grid 2.0');
    expect(header.childNodes.length).toBe(nodesBefore.length);
    expect(header.lastChild).toBe(caret);
  });

  it('replaces the header text of a menu bar header that has no caret', () => {
    const menuBar = toolbarMenubarTestCreate('menubar');
    const header = menuBar.addDropdown('View', []);
    menuBar.dropdownLabelSet(header, 'Window');
    expect(header.textContent).toBe('Window');
  });

  it('inserts a leading text node when the header starts with an element', () => {
    const toolbar = toolbarMenubarTestCreate();
    const header = toolbar.addDropdown('Grid 1.0', []);
    header.firstChild?.remove();
    const childCount = header.childNodes.length;
    toolbar.dropdownLabelSet(header, 'Grid 4.0');
    expect(toolbarMenubarTestHeaderTextRead(header)).toBe('Grid 4.0');
    expect(header.childNodes.length).toBe(childCount + 1);
  });
});
