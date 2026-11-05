import { describe, expect, it, vi } from 'vitest';
import {
  getRegistryObjectPropertiesTab,
  RegistryObjectPropertiesTab,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';

describe('RegistryObjectPropertiesTab', () => {
  it('orders registered tabs by ascending order value and supports unregistering', () => {
    const registry = new RegistryObjectPropertiesTab();
    const mountStub = vi.fn(() => ({ refresh: vi.fn(), dispose: vi.fn() }));
    registry.register({ id: 'outputs', label: 'Outputs', order: 20, mount: mountStub });
    registry.register({ id: 'class_info', label: 'Class Info', order: 10, mount: mountStub });
    registry.register({ id: 'visgroup', label: 'VisGroup', order: 50, mount: mountStub });

    expect(registry.listOrdered().map((item) => item.id)).toEqual(['class_info', 'outputs', 'visgroup']);

    registry.unregister('outputs');
    expect(registry.listOrdered().map((item) => item.id)).toEqual(['class_info', 'visgroup']);
  });

  it('starts the shared registry with Class Info, Outputs, Inputs, Properties and VisGroup in order', () => {
    const ids = getRegistryObjectPropertiesTab()
      .listOrdered()
      .map((item) => item.id);
    const expectedOrder = ['class_info', 'outputs', 'inputs', 'properties', 'visgroup'];
    expect(ids.filter((id) => expectedOrder.includes(id))).toEqual(expectedOrder);
    expect(ids[0]).toBe('class_info');
  });
});
