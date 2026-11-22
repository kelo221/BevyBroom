/** Profile name of an I-beam: two flanges joined by a centered web. */
export const PROCEDURAL_GIRDER_PROFILE_I_BEAM = 'i_beam';

/** Profile name of a C-channel: two flanges joined by a web on one side. */
export const PROCEDURAL_GIRDER_PROFILE_C_CHANNEL = 'c_channel';

/** Profile name of a box tube: two flanges and two walls around a hollow. */
export const PROCEDURAL_GIRDER_PROFILE_TUBE = 'tube';

/** Profile name of an angle: one upright leg and one flat leg. */
export const PROCEDURAL_GIRDER_PROFILE_ANGLE = 'angle';

/** Every profile name a girder offers, in menu order. */
export const PROCEDURAL_GIRDER_PROFILES: readonly string[] = [
  PROCEDURAL_GIRDER_PROFILE_I_BEAM,
  PROCEDURAL_GIRDER_PROFILE_C_CHANNEL,
  PROCEDURAL_GIRDER_PROFILE_TUBE,
  PROCEDURAL_GIRDER_PROFILE_ANGLE,
];

/** Measures of a girder profile in meters. */
export interface ProceduralGirderSize {
  readonly height: number;
  readonly flangeWidth: number;
  readonly webThickness: number;
  readonly flangeThickness: number;
}

/** One rectangle of a profile cross section, centered across the girder. */
export interface ProceduralGirderSection {
  readonly name: string;
  readonly upFrom: number;
  readonly upTo: number;
  readonly acrossFrom: number;
  readonly acrossTo: number;
}

/** Cuts the cross section of a girder profile into convex rectangles. */
export class ProceduralGirderProfile {
  /**
   * Returns the rectangles of a profile; the girder is as long as it is run, so
   * only these rectangles depend on the profile.
   *
   * @param profile Profile name; unknown names give an I-beam.
   * @param size Measures of the profile.
   * @returns Rectangles in a stable order.
   */
  static sectionsOf(profile: string, size: ProceduralGirderSize): ProceduralGirderSection[] {
    if (profile === PROCEDURAL_GIRDER_PROFILE_C_CHANNEL) {
      return ProceduralGirderProfile.channelSections(size);
    }
    if (profile === PROCEDURAL_GIRDER_PROFILE_TUBE) {
      return ProceduralGirderProfile.tubeSections(size);
    }
    if (profile === PROCEDURAL_GIRDER_PROFILE_ANGLE) {
      return ProceduralGirderProfile.angleSections(size);
    }
    return ProceduralGirderProfile.beamSections(size);
  }

  /**
   * Describes why a profile cannot be built.
   *
   * @param profile Profile name.
   * @param size Measures of the profile.
   * @returns Problem descriptions, empty when the profile fits its measures.
   */
  static issuesOf(profile: string, size: ProceduralGirderSize): string[] {
    const issues: string[] = [];
    const flangeCount = profile === PROCEDURAL_GIRDER_PROFILE_ANGLE ? 1 : 2;
    if (flangeCount * size.flangeThickness >= size.height) {
      issues.push('Girder flanges are as thick as the girder is high');
    }
    const wallCount = profile === PROCEDURAL_GIRDER_PROFILE_TUBE ? 2 : 1;
    if (wallCount * size.webThickness >= size.flangeWidth) {
      issues.push('Girder web is as thick as the girder is wide');
    }
    return issues;
  }

  /**
   * Returns the rectangles of an I-beam.
   *
   * @param size Measures of the profile.
   * @returns Bottom flange, web and top flange.
   */
  private static beamSections(size: ProceduralGirderSize): ProceduralGirderSection[] {
    const half = size.flangeWidth / 2;
    const web = size.webThickness / 2;
    const [bottom, top] = ProceduralGirderProfile.flangePair(size, -half, half);
    return [
      bottom,
      {
        name: 'Web',
        upFrom: size.flangeThickness,
        upTo: size.height - size.flangeThickness,
        acrossFrom: -web,
        acrossTo: web,
      },
      top,
    ];
  }

  /**
   * Returns the rectangles of a C-channel, whose web is on the low across side.
   *
   * @param size Measures of the profile.
   * @returns Bottom flange, web and top flange.
   */
  private static channelSections(size: ProceduralGirderSize): ProceduralGirderSection[] {
    const half = size.flangeWidth / 2;
    const [bottom, top] = ProceduralGirderProfile.flangePair(size, -half, half);
    return [bottom, ProceduralGirderProfile.wallSection('Web', size, -half, -half + size.webThickness), top];
  }

  /**
   * Returns the rectangles of a box tube.
   *
   * @param size Measures of the profile.
   * @returns Bottom plate, both walls and top plate.
   */
  private static tubeSections(size: ProceduralGirderSize): ProceduralGirderSection[] {
    const half = size.flangeWidth / 2;
    const [bottom, top] = ProceduralGirderProfile.flangePair(size, -half, half);
    return [
      bottom,
      ProceduralGirderProfile.wallSection('Wall Low', size, -half, -half + size.webThickness),
      ProceduralGirderProfile.wallSection('Wall High', size, half - size.webThickness, half),
      top,
    ];
  }

  /**
   * Returns the rectangles of an angle: an upright leg on the low across side
   * and a flat leg beside it.
   *
   * @param size Measures of the profile.
   * @returns Upright leg and flat leg.
   */
  private static angleSections(size: ProceduralGirderSize): ProceduralGirderSection[] {
    const half = size.flangeWidth / 2;
    const upright = {
      name: 'Leg Upright',
      upFrom: 0,
      upTo: size.height,
      acrossFrom: -half,
      acrossTo: -half + size.webThickness,
    };
    const flat = {
      name: 'Leg Flat',
      upFrom: 0,
      upTo: size.flangeThickness,
      acrossFrom: -half + size.webThickness,
      acrossTo: half,
    };
    return [upright, flat];
  }

  /**
   * Returns the bottom and the top flange over an across range.
   *
   * @param size Measures of the profile.
   * @param acrossFrom Low across edge of the flanges.
   * @param acrossTo High across edge of the flanges.
   * @returns Bottom flange and top flange.
   */
  private static flangePair(
    size: ProceduralGirderSize,
    acrossFrom: number,
    acrossTo: number,
  ): [ProceduralGirderSection, ProceduralGirderSection] {
    return [
      { name: 'Flange Bottom', upFrom: 0, upTo: size.flangeThickness, acrossFrom, acrossTo },
      { name: 'Flange Top', upFrom: size.height - size.flangeThickness, upTo: size.height, acrossFrom, acrossTo },
    ];
  }

  /**
   * Returns an upright rectangle between the two flanges.
   *
   * @param name Rectangle name.
   * @param size Measures of the profile.
   * @param acrossFrom Low across edge of the wall.
   * @param acrossTo High across edge of the wall.
   * @returns The wall rectangle.
   */
  private static wallSection(
    name: string,
    size: ProceduralGirderSize,
    acrossFrom: number,
    acrossTo: number,
  ): ProceduralGirderSection {
    return { name, upFrom: size.flangeThickness, upTo: size.height - size.flangeThickness, acrossFrom, acrossTo };
  }
}
