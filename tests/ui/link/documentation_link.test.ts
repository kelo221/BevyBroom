import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentationLink } from '@/ui/link/documentation_link.js';

describe('DocumentationLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the user guide in a protected separate tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    new DocumentationLink().open();

    expect(open).toHaveBeenCalledWith(
      'https://github.com/kelo221/BevyBroom/blob/master/documentation/README.md',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
