/**
 * Decorative artwork colors of the About dialog: the animated title gradient,
 * the header band, the border glow and the contributor avatar rings. They are
 * artwork, not editor chrome, so they stay fixed whatever the chrome palette.
 */
export const AboutArtPalette = Object.freeze({
  /** Animated gradient of the project title text. */
  titleGradient: 'linear-gradient(90deg, #ff9a3c, #e86a17, #6eb6ff, #e86a17, #ff9a3c)',
  /** Background band behind the title. */
  headerBand: 'linear-gradient(135deg, #1c2c58 0%, #14182a 55%, #3a2418 100%)',
  /** Subtitle text on the header band. */
  headerSubtitle: '#b4c8ff',
  /** Light sweep moving over the header band. */
  headerShimmer: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.10), transparent)',
  /** Border glow pulse of the panel at rest and at its peak. */
  glowRest: '0 0 10px rgba(232, 106, 23, 0.20), 0 0 24px rgba(40, 80, 180, 0.15)',
  glowPeak: '0 0 16px rgba(232, 106, 23, 0.35), 0 0 36px rgba(60, 120, 255, 0.25)',
  /** Ring around contributor avatars at rest and while hovered. */
  avatarRingRest: 'rgba(232, 106, 23, 0.5)',
  avatarRingHover: 'rgba(232, 106, 23, 0.9)',
  /** Shadow under contributor avatars at rest and while hovered. */
  avatarShadowRest: '0 2px 8px rgba(0, 0, 0, 0.4)',
  avatarShadowHover: '0 0 14px rgba(232, 106, 23, 0.45), 0 2px 12px rgba(0, 0, 0, 0.5)',
});
