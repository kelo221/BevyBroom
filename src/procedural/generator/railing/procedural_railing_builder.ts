import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralLayoutRepeat } from '@/procedural/layout/procedural_layout_repeat.js';
import type { ProceduralLayoutRun } from '@/procedural/layout/procedural_layout_run.js';

/** Material slot of the posts. */
export const PROCEDURAL_RAILING_SLOT_POSTS = 'posts';

/** Material slot of the rails. */
export const PROCEDURAL_RAILING_SLOT_RAILS = 'rails';

/** Measures of a railing in meters. */
export interface ProceduralRailingSpec {
  readonly run: ProceduralLayoutRun;
  readonly height: number;
  readonly postSize: number;
  readonly maxPostSpacing: number;
  readonly midRailCount: number;
  readonly railSize: number;
  readonly hasEndPosts: boolean;
}

/** Builds the posts and rails of a railing along its run. */
export class ProceduralRailingBuilder {
  /**
   * Builds every part of a railing.
   *
   * @param spec Measures of the railing.
   * @returns Posts, then the top rail and the mid rails.
   */
  static build(spec: ProceduralRailingSpec): ProceduralPart[] {
    return [...ProceduralRailingBuilder.postsBuild(spec), ...ProceduralRailingBuilder.railsBuild(spec)];
  }

  /**
   * Returns the start of every post along the run: posts keep their size and
   * only their spacing stretches.
   *
   * @param spec Measures of the railing.
   * @returns Post starts, without the two end posts when they are switched off.
   */
  static postPositionsOf(spec: ProceduralRailingSpec): number[] {
    const positions = ProceduralLayoutRepeat.positionsByMaxSpacing(spec.run.run, spec.postSize, spec.maxPostSpacing);
    return spec.hasEndPosts ? positions : positions.slice(1, -1);
  }

  /**
   * Builds the vertical posts, each standing on the line between the ends.
   *
   * @param spec Measures of the railing.
   * @returns Post parts.
   */
  private static postsBuild(spec: ProceduralRailingSpec): ProceduralPart[] {
    return ProceduralRailingBuilder.postPositionsOf(spec).map((start, index) =>
      ProceduralRailingBuilder.postBuild(spec, `Post ${index + 1}`, start),
    );
  }

  /**
   * Builds one vertical post.
   *
   * @param spec Measures of the railing.
   * @param name Part name.
   * @param start Position of the post's start along the run.
   * @returns Post part.
   */
  private static postBuild(spec: ProceduralRailingSpec, name: string, start: number): ProceduralPart {
    const base = (start + spec.postSize / 2) * spec.run.slope();
    const half = spec.postSize / 2;
    const box = {
      runFrom: start,
      runTo: start + spec.postSize,
      upFrom: base,
      upTo: base + spec.height,
      acrossFrom: -half,
      acrossTo: half,
    };
    return spec.run.frame.boxPart(name, PROCEDURAL_RAILING_SLOT_POSTS, box);
  }

  /**
   * Builds the rails along the whole run, the top rail flush with the top of
   * the posts and the mid rails evenly between it and the base.
   *
   * @param spec Measures of the railing.
   * @returns Rail parts, top rail first.
   */
  private static railsBuild(spec: ProceduralRailingSpec): ProceduralPart[] {
    const top = ProceduralRailingBuilder.railBuild(spec, 'Rail Top', spec.height - spec.railSize);
    const gap = (spec.height - spec.railSize) / (spec.midRailCount + 1);
    const mids = Array.from({ length: spec.midRailCount }, (_, index) =>
      ProceduralRailingBuilder.railBuild(spec, `Rail ${index + 1}`, ProceduralLayoutRepeat.gridSnap(gap * (index + 1))),
    );
    return [top, ...mids];
  }

  /**
   * Builds one rail from one end of the run to the other.
   *
   * @param spec Measures of the railing.
   * @param name Part name.
   * @param lowerEdge Height of the lower edge of the rail above the line.
   * @returns Rail part.
   */
  private static railBuild(spec: ProceduralRailingSpec, name: string, lowerEdge: number): ProceduralPart {
    const half = spec.railSize / 2;
    const box = {
      runFrom: 0,
      runTo: spec.run.run,
      upFrom: lowerEdge,
      upTo: lowerEdge + spec.railSize,
      acrossFrom: -half,
      acrossTo: half,
    };
    return spec.run.frame.boxPart(name, PROCEDURAL_RAILING_SLOT_RAILS, box, spec.run.slope());
  }
}
