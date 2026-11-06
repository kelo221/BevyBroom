import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { InputTextSuggest } from '@/ui/input/input_text_suggest.js';
import {
  AnglesPitchYawRollConversion,
  type AnglesPitchYawRoll,
  type AnglesPitchYawRollPartial,
} from './angles/angles_pitch_yaw_roll.js';

/** SVG namespace used for the dial elements. */
const WIDGET_ANGLES_COMPASS_SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Side length of the dial view box. */
const WIDGET_ANGLES_COMPASS_VIEW_SIZE = 40;

/** Radius of the dial ring inside the view box. */
const WIDGET_ANGLES_COMPASS_RADIUS = 17;

/** Pitch that points the forward direction straight up, in degrees. */
const WIDGET_ANGLES_COMPASS_PITCH_UP = 90;

/** Choice text of the angles combo that points straight up. */
const WIDGET_ANGLES_COMPASS_CHOICE_UP = 'Up';

/** Choice text of the angles combo that points straight down. */
const WIDGET_ANGLES_COMPASS_CHOICE_DOWN = 'Down';

/** Angles the Up and Down choices set, by lowercase choice text. */
const WIDGET_ANGLES_COMPASS_PRESETS: Readonly<Record<string, AnglesPitchYawRollPartial>> = {
  up: { pitch: WIDGET_ANGLES_COMPASS_PITCH_UP, yaw: null, roll: 0 },
  down: { pitch: -WIDGET_ANGLES_COMPASS_PITCH_UP, yaw: null, roll: 0 },
};

/** Yaw choices of the angles combo, in degrees. */
const WIDGET_ANGLES_COMPASS_YAW_CHOICES: readonly string[] = ['0', '90', '180', '270'];

/** Callbacks of the angles compass. */
export interface WidgetAnglesCompassOptions {
  /**
   * Called when the user commits new angles; null components keep each object's
   * own value.
   */
  readonly onAnglesCommit: (edit: AnglesPitchYawRollPartial) => void;
}

/**
 * Hammer-style angles editor: a compact combo that sets the yaw from typed or
 * picked degrees or points the object Up or Down, beside a small top-down yaw
 * dial that sets the yaw where it is clicked.
 */
export class WidgetAnglesCompass {
  private readonly options: WidgetAnglesCompassOptions;
  private readonly root: HTMLElement;
  private readonly dial: SVGSVGElement;
  private readonly needle: SVGLineElement;
  private readonly combo: InputTextSuggest;

  /**
   * Creates the compass with an empty combo.
   *
   * @param options Commit callback.
   */
  constructor(options: WidgetAnglesCompassOptions) {
    this.options = options;
    this.combo = this.comboCreate();
    this.needle = this.svgElementCreate('line');
    this.dial = this.dialCreate();
    this.root = this.rootCreate();
  }

  /**
   * Returns the widget root element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the yaw dial element.
   *
   * @returns Dial SVG element.
   */
  dialRead(): SVGSVGElement {
    return this.dial;
  }

  /**
   * Shows the angles of the edited objects: Up or Down for objects pointing
   * straight up or down, else the yaw; differing values show as mixed and the
   * dial follows the first object.
   *
   * @param anglesList Angles of every edited object.
   */
  anglesWrite(anglesList: readonly AnglesPitchYawRoll[]): void {
    this.combo.setSharedValues(anglesList.map((angles) => WidgetAnglesCompass.comboTextOf(angles)));
    const dialYaw = anglesList[0]?.yaw ?? 0;
    this.needleWrite(dialYaw);
    this.dial.setAttribute('aria-valuenow', String(dialYaw));
  }

  /**
   * Creates the angles combo with its yaw, Up and Down choices.
   *
   * @returns Combo field.
   */
  private comboCreate(): InputTextSuggest {
    const combo = new InputTextSuggest('Angles');
    const choices = [
      ...WIDGET_ANGLES_COMPASS_YAW_CHOICES,
      WIDGET_ANGLES_COMPASS_CHOICE_UP,
      WIDGET_ANGLES_COMPASS_CHOICE_DOWN,
    ];
    combo.suggestionsWrite(choices.map((choice) => ({ value: choice, label: choice })));
    combo.inputElementRead().style.width = '64px';
    combo.bindCommit(() => this.comboCommit());
    return combo;
  }

  /** Commits the typed or picked combo text; unreadable text commits nothing. */
  private comboCommit(): void {
    const text = this.combo.getValue().trim();
    const preset = WIDGET_ANGLES_COMPASS_PRESETS[text.toLowerCase()];
    const yaw = Number(text);
    if (preset) {
      this.options.onAnglesCommit(preset);
    } else if (text !== '' && Number.isFinite(yaw)) {
      this.options.onAnglesCommit({ pitch: null, yaw, roll: null });
    }
  }

  /**
   * Creates the dial with its ring, north mark and needle.
   *
   * @returns Dial SVG element.
   */
  private dialCreate(): SVGSVGElement {
    const dial = this.svgElementCreate('svg');
    const size = String(WIDGET_ANGLES_COMPASS_VIEW_SIZE);
    dial.setAttribute('viewBox', `0 0 ${size} ${size}`);
    dial.setAttribute('width', size);
    dial.setAttribute('height', size);
    dial.setAttribute('role', 'slider');
    dial.setAttribute('aria-label', 'Yaw dial');
    dial.style.cursor = 'crosshair';
    dial.style.flexShrink = '0';
    dial.append(this.dialRingCreate(), this.dialNorthMarkCreate(), this.needleStyle());
    dial.addEventListener('click', (event) => this.dialClickHandle(event));
    return dial;
  }

  /**
   * Creates the dial ring.
   *
   * @returns Circle element.
   */
  private dialRingCreate(): SVGCircleElement {
    const ring = this.svgElementCreate('circle');
    const center = String(WIDGET_ANGLES_COMPASS_VIEW_SIZE / 2);
    ring.setAttribute('cx', center);
    ring.setAttribute('cy', center);
    ring.setAttribute('r', String(WIDGET_ANGLES_COMPASS_RADIUS));
    ring.setAttribute('fill', Theme.inputBackgroundColor);
    ring.setAttribute('stroke', Theme.inputBorderColor);
    ring.setAttribute('stroke-width', '2');
    return ring;
  }

  /**
   * Creates the small mark at the unrotated forward direction.
   *
   * @returns Circle element.
   */
  private dialNorthMarkCreate(): SVGCircleElement {
    const mark = this.svgElementCreate('circle');
    const center = WIDGET_ANGLES_COMPASS_VIEW_SIZE / 2;
    mark.setAttribute('cx', String(center));
    mark.setAttribute('cy', String(center - WIDGET_ANGLES_COMPASS_RADIUS));
    mark.setAttribute('r', '1.5');
    mark.setAttribute('fill', Theme.buttonTextColor);
    return mark;
  }

  /**
   * Styles the needle from the dial center.
   *
   * @returns Needle element.
   */
  private needleStyle(): SVGLineElement {
    const center = String(WIDGET_ANGLES_COMPASS_VIEW_SIZE / 2);
    this.needle.setAttribute('x1', center);
    this.needle.setAttribute('y1', center);
    this.needle.setAttribute('stroke', hexToRgb(Theme.selectionColor));
    this.needle.setAttribute('stroke-width', '2.5');
    this.needle.setAttribute('stroke-linecap', 'round');
    this.needleWrite(0);
    return this.needle;
  }

  /**
   * Points the needle at a yaw.
   *
   * @param yaw Yaw in degrees.
   */
  private needleWrite(yaw: number): void {
    const center = WIDGET_ANGLES_COMPASS_VIEW_SIZE / 2;
    const offset = AnglesPitchYawRollConversion.dialOffsetFromYaw(yaw, WIDGET_ANGLES_COMPASS_RADIUS - 3);
    this.needle.setAttribute('x2', String(center + offset.right));
    this.needle.setAttribute('y2', String(center + offset.down));
  }

  /**
   * Commits the yaw of the clicked dial point, keeping pitch and roll.
   *
   * @param event Click on the dial.
   */
  private dialClickHandle(event: MouseEvent): void {
    const rect = this.dial.getBoundingClientRect();
    const scale = rect.width > 0 ? WIDGET_ANGLES_COMPASS_VIEW_SIZE / rect.width : 1;
    const center = WIDGET_ANGLES_COMPASS_VIEW_SIZE / 2;
    const offsetRight = (event.clientX - rect.left) * scale - center;
    const offsetDown = (event.clientY - rect.top) * scale - center;
    if (offsetRight === 0 && offsetDown === 0) {
      return;
    }
    const yaw = Math.round(AnglesPitchYawRollConversion.yawFromDialOffset(offsetRight, offsetDown));
    this.options.onAnglesCommit({ pitch: null, yaw, roll: null });
  }

  /**
   * Creates the root with the combo beside the dial.
   *
   * @returns Root element.
   */
  private rootCreate(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'widget-angles-compass';
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.gap = '8px';
    root.append(this.combo.getElement(), this.dial);
    return root;
  }

  /**
   * Returns the combo text of one object's angles.
   *
   * @param angles Angles of the object.
   * @returns Up, Down or the yaw in degrees.
   */
  private static comboTextOf(angles: AnglesPitchYawRoll): string {
    if (angles.pitch === WIDGET_ANGLES_COMPASS_PITCH_UP) {
      return WIDGET_ANGLES_COMPASS_CHOICE_UP;
    }
    if (angles.pitch === -WIDGET_ANGLES_COMPASS_PITCH_UP) {
      return WIDGET_ANGLES_COMPASS_CHOICE_DOWN;
    }
    return String(angles.yaw);
  }

  /**
   * Creates an SVG element.
   *
   * @param tagName SVG tag name.
   * @returns New SVG element.
   */
  private svgElementCreate<TTag extends keyof SVGElementTagNameMap>(tagName: TTag): SVGElementTagNameMap[TTag] {
    return document.createElementNS(WIDGET_ANGLES_COMPASS_SVG_NAMESPACE, tagName);
  }
}
