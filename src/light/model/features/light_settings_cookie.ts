/** Longest cookie texture path the editor keeps. */
const LIGHT_COOKIE_PATH_MAX_LENGTH = 1024;

/** Largest spot outer angle in degrees at which the game projects a cookie. */
export const LIGHT_COOKIE_MAX_OUTER_DEGREES = 90;

/** Type path of the game asset type cookie textures are, Bevy's image. */
export const LIGHT_COOKIE_ASSET_TYPE_PATH = 'bevy_image::image::Image';

/** Texture a spot light projects, like a gobo in front of a stage light. */
export interface LightSettingsCookie {
  /** Path of the image inside the game's assets folder; empty for none. */
  cookieTexture: string;
}

/**
 * Returns cookie settings without a texture.
 *
 * @returns Fresh cookie settings.
 */
export function lightSettingsCookieCreateDefault(): LightSettingsCookie {
  return { cookieTexture: '' };
}

/**
 * Returns cookie settings with a trimmed path of reasonable length, or none.
 *
 * @param settings Possibly invalid cookie settings.
 * @returns Valid cookie settings.
 */
export function lightSettingsCookieSanitize(settings: LightSettingsCookie): LightSettingsCookie {
  const path: unknown = settings.cookieTexture;
  if (typeof path !== 'string') {
    return lightSettingsCookieCreateDefault();
  }
  return { cookieTexture: path.trim().slice(0, LIGHT_COOKIE_PATH_MAX_LENGTH) };
}
