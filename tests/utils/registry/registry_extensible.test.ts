import { describe, expect, it } from 'vitest';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * A plug-in registry lists built-in items first, then runtime items in
 * registration order, ignores duplicates and only removes runtime items.
 */
describe('RegistryExtensible', () => {
  it('lists built-in items before registered items in registration order', () => {
    const registry = new RegistryExtensible<string>(() => ['builtin-a', 'builtin-b']);
    registry.register('runtime-a');
    registry.register('runtime-b');
    expect(registry.list()).toEqual(['builtin-a', 'builtin-b', 'runtime-a', 'runtime-b']);
  });

  it('ignores an item that is already listed', () => {
    const registry = new RegistryExtensible<string>(() => ['builtin']);
    registry.register('builtin');
    registry.register('runtime');
    registry.register('runtime');
    expect(registry.list()).toEqual(['builtin', 'runtime']);
  });

  it('removes registered items but keeps built-in items', () => {
    const registry = new RegistryExtensible<string>(() => ['builtin']);
    registry.register('runtime');
    registry.unregister('runtime');
    registry.unregister('builtin');
    expect(registry.list()).toEqual(['builtin']);
  });

  it('resolves the built-in items only once, on first use', () => {
    let resolveCount = 0;
    const registry = new RegistryExtensible<number>(() => {
      resolveCount += 1;
      return [1];
    });
    expect(resolveCount).toBe(0);
    registry.list();
    registry.register(2);
    registry.list();
    expect(resolveCount).toBe(1);
  });
});
