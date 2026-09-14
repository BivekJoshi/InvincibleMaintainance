import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useListParams } from '@/hooks/useListParams';

const at = (url) => function Wrapper({ children }) {
  return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
};

describe('useListParams', () => {
  it('reads filters from the URL on top of the defaults', () => {
    const { result } = renderHook(() => useListParams({ limit: 20 }), {
      wrapper: at('/admin/leads?status=NEW&page=3&limit=50&from=2026-09-01'),
    });
    expect(result.current[0]).toEqual({ limit: 50, status: 'NEW', page: 3, from: '2026-09-01' });
  });

  it('writes filters to the URL and reads the same values back', () => {
    const { result } = renderHook(
      () => ({ list: useListParams({ limit: 20 }), location: useLocation() }),
      { wrapper: at('/admin/leads') },
    );

    act(() => result.current.list[1]({
      ...result.current.list[0],
      page: 1,
      status: 'CONTACTED',
      slaRisk: 'breached',
      from: '2026-09-01',
      to: '2026-09-14',
      isActive: true,
      deleted: 'true',
      q: '',
      assignedToId: undefined,
    }));

    const search = new URLSearchParams(result.current.location.search);
    expect(Object.fromEntries(search)).toEqual({
      limit: '20', status: 'CONTACTED', slaRisk: 'breached', from: '2026-09-01', to: '2026-09-14', isActive: 'true', deleted: 'true',
    });
    expect(result.current.list[0]).toEqual({
      limit: 20, status: 'CONTACTED', slaRisk: 'breached', from: '2026-09-01', to: '2026-09-14', isActive: 'true', deleted: 'true',
    });
  });

  it('keeps page 2 and beyond in the URL, but not page 1', () => {
    const { result } = renderHook(
      () => ({ list: useListParams(), location: useLocation() }),
      { wrapper: at('/admin/leads?page=4') },
    );
    act(() => result.current.list[1]({ page: 2, sort: '-createdAt' }));
    expect(result.current.location.search).toBe('?page=2&sort=-createdAt');
    act(() => result.current.list[1]({ page: 1, sort: '-createdAt' }));
    expect(result.current.location.search).toBe('?sort=-createdAt');
  });

  it('returns the same params object across renders when defaults are an inline object', () => {
    const { result, rerender } = renderHook(() => useListParams({ limit: 20 }), { wrapper: at('/admin/leads?status=NEW') });
    const first = result.current[0];
    rerender();
    expect(result.current[0]).toBe(first);
  });
});
