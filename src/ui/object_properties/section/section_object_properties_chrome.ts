import { Theme } from '@/theme.js';

/** Hint shown while nothing is selected. */
const SECTION_OBJECT_PROPERTIES_EMPTY_TEXT = 'Select an object to see and edit its properties.';

/**
 * Frame of the Properties section of the right dock: a title row, a hint while
 * nothing is selected, the tabs, and a place for editors opened from a field
 * (such as the data asset editor) below them.
 */
export class SectionObjectPropertiesChrome {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly emptyHint: HTMLElement;
  private readonly content: HTMLElement;
  private readonly fieldEditorHost: HTMLElement;

  /**
   * Builds the frame around the tab element.
   *
   * @param tabsElement Element holding the tabs.
   */
  constructor(tabsElement: HTMLElement) {
    this.root = document.createElement('section');
    this.title = document.createElement('div');
    this.emptyHint = document.createElement('div');
    this.content = tabsElement;
    this.fieldEditorHost = document.createElement('div');
    this.fieldEditorHost.classList.add('section-object-properties-field-editors');
    this.rootStyle();
    this.titleStyle();
    this.emptyHintStyle();
    this.root.append(this.title, this.emptyHint, this.content, this.fieldEditorHost);
  }

  /**
   * Returns the section element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the element editors opened from a field are shown in.
   *
   * @returns Field editor host element.
   */
  fieldEditorHostRead(): HTMLElement {
    return this.fieldEditorHost;
  }

  /**
   * Writes the title row.
   *
   * @param text Title text.
   */
  titleWrite(text: string): void {
    this.title.textContent = text;
  }

  /**
   * Shows the hint and hides the tabs while nothing is selected, or the
   * reverse.
   *
   * @param isEmpty True while nothing is selected.
   */
  emptyShownSet(isEmpty: boolean): void {
    this.emptyHint.style.display = isEmpty ? '' : 'none';
    this.content.style.display = isEmpty ? 'none' : '';
  }

  /** Scrolls the section into view and focuses it. */
  reveal(): void {
    this.root.scrollIntoView?.({ block: 'start' });
    this.root.focus({ preventScroll: true });
  }

  /** Removes the section element. */
  dispose(): void {
    this.root.remove();
  }

  /** Styles the section root. */
  private rootStyle(): void {
    this.root.classList.add('section-object-properties');
    this.root.setAttribute('aria-label', 'Properties');
    this.root.tabIndex = -1;
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.borderTop = `1px solid ${Theme.separatorColor}`;
    this.root.style.fontFamily = Theme.uiFontFamily;
    this.root.style.fontSize = `${Theme.uiFontSizePx}px`;
    this.root.style.outline = 'none';
  }

  /** Styles the title row. */
  private titleStyle(): void {
    this.title.classList.add('section-object-properties-title');
    this.title.style.padding = '4px 6px';
    this.title.style.fontWeight = 'bold';
    this.title.style.color = Theme.buttonTextColor;
    this.title.style.whiteSpace = 'nowrap';
    this.title.style.overflow = 'hidden';
    this.title.style.textOverflow = 'ellipsis';
  }

  /** Styles the hint shown while nothing is selected. */
  private emptyHintStyle(): void {
    this.emptyHint.classList.add('section-object-properties-empty');
    this.emptyHint.textContent = SECTION_OBJECT_PROPERTIES_EMPTY_TEXT;
    this.emptyHint.style.padding = '2px 6px 8px';
    this.emptyHint.style.color = Theme.statusBarTextColor;
  }
}
