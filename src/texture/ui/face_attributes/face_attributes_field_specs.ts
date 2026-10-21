import type { FaceTextureMappingTrs } from '@/texture/uv/face_texture_mapping.js';
import { UV_OFFSET_NUDGE, type UvRelativeTrsOp } from '@/texture/uv/uv_trs_ops.js';

/** One nudge button next to a face attribute field. */
export interface FaceAttributesNudgeSpec {
  /** Short button label. */
  text: string;
  /** Tooltip and accessible name. */
  title: string;
  /** Relative operation applied to every selected face. */
  op: UvRelativeTrsOp;
}

/** One numeric face attribute field and its two nudge buttons. */
export interface FaceAttributesFieldSpec {
  /** Mapping value edited by the field. */
  key: keyof FaceTextureMappingTrs;
  /** Accessible name of the field. */
  ariaLabel: string;
  /** Arrow step stored on the field. */
  step: number;
  /** Minimum fractional digits shown. */
  decimals: number;
  /** Decrease and increase nudge buttons. */
  nudges: readonly [FaceAttributesNudgeSpec, FaceAttributesNudgeSpec];
}

/** One labeled row of the face attribute grid (X column, optional Y column). */
export interface FaceAttributesRowSpec {
  /** Row caption. */
  label: string;
  /** Fields in X then Y order. */
  fields: readonly FaceAttributesFieldSpec[];
}

/** Offset row: phase shift along X (U) and Y (V) in quarter tiles. */
const FACE_ATTRIBUTES_ROW_OFFSET: FaceAttributesRowSpec = {
  label: 'Offset',
  fields: [
    {
      key: 'offsetU',
      ariaLabel: 'X Offset',
      step: UV_OFFSET_NUDGE,
      decimals: 2,
      nudges: [
        { text: '−¼', title: 'Shift X by −¼ tile', op: { kind: 'addOffset', axis: 'u', delta: -UV_OFFSET_NUDGE } },
        { text: '+¼', title: 'Shift X by +¼ tile', op: { kind: 'addOffset', axis: 'u', delta: UV_OFFSET_NUDGE } },
      ],
    },
    {
      key: 'offsetV',
      ariaLabel: 'Y Offset',
      step: UV_OFFSET_NUDGE,
      decimals: 2,
      nudges: [
        { text: '−¼', title: 'Shift Y by −¼ tile', op: { kind: 'addOffset', axis: 'v', delta: -UV_OFFSET_NUDGE } },
        { text: '+¼', title: 'Shift Y by +¼ tile', op: { kind: 'addOffset', axis: 'v', delta: UV_OFFSET_NUDGE } },
      ],
    },
  ],
};

/** Scale row: meters per tile along X (U) and Y (V), halved or doubled. */
const FACE_ATTRIBUTES_ROW_SCALE: FaceAttributesRowSpec = {
  label: 'Scale',
  fields: [
    {
      key: 'scaleU',
      ariaLabel: 'X Scale',
      step: 0.25,
      decimals: 2,
      nudges: [
        { text: '½', title: 'Halve X scale (smaller tiles)', op: { kind: 'multiplyScale', axis: 'u', factor: 0.5 } },
        { text: '×2', title: 'Double X scale (larger tiles)', op: { kind: 'multiplyScale', axis: 'u', factor: 2 } },
      ],
    },
    {
      key: 'scaleV',
      ariaLabel: 'Y Scale',
      step: 0.25,
      decimals: 2,
      nudges: [
        { text: '½', title: 'Halve Y scale (smaller tiles)', op: { kind: 'multiplyScale', axis: 'v', factor: 0.5 } },
        { text: '×2', title: 'Double Y scale (larger tiles)', op: { kind: 'multiplyScale', axis: 'v', factor: 2 } },
      ],
    },
  ],
};

/** Rotation row: degrees around the face normal, in quarter turns. */
const FACE_ATTRIBUTES_ROW_ROTATION: FaceAttributesRowSpec = {
  label: 'Rotation',
  fields: [
    {
      key: 'rotationDeg',
      ariaLabel: 'Rotation',
      step: 1,
      decimals: 1,
      nudges: [
        { text: '−90', title: 'Rotate −90°', op: { kind: 'addRotation', degrees: -90 } },
        { text: '+90', title: 'Rotate +90°', op: { kind: 'addRotation', degrees: 90 } },
      ],
    },
  ],
};

/** Rows of the face attribute grid, top to bottom. */
export const FACE_ATTRIBUTES_ROWS: readonly FaceAttributesRowSpec[] = Object.freeze([
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_SCALE,
  FACE_ATTRIBUTES_ROW_ROTATION,
]);
