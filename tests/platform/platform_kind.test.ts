import { describe, expect, it } from 'vitest';
import { platformKindFromUserAgent } from '@/platform/platform_kind.js';

/** Real browser user agents of each platform family. */
const PLATFORM_KIND_USER_AGENTS = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};

describe('platformKindFromUserAgent', () => {
  it('reads macOS, Windows and Linux from real browser user agents', () => {
    expect(platformKindFromUserAgent(PLATFORM_KIND_USER_AGENTS.mac)).toBe('mac');
    expect(platformKindFromUserAgent(PLATFORM_KIND_USER_AGENTS.windows)).toBe('windows');
    expect(platformKindFromUserAgent(PLATFORM_KIND_USER_AGENTS.linux)).toBe('linux');
  });

  it('reads test DOMs as other so tests behave the same on every host', () => {
    expect(platformKindFromUserAgent('Mozilla/5.0 (Macintosh; darwin) AppleWebKit/537.36 jsdom/30.0.1')).toBe('other');
    expect(platformKindFromUserAgent('')).toBe('other');
  });
});
