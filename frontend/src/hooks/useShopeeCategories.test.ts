import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShopeeCategories } from './useShopeeCategories';

vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useShopeeCategories', () => {
  it('envia language na consulta de categorias', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    const { result } = renderHook(() => useShopeeCategories());

    await act(async () => {
      await result.current.loadCategories(123, false, true, 'en-US');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/shopee/categories?shop_id=123&language=en-US'),
      expect.any(Object)
    );
  });

  it('envia language no refresh de cache', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    const { result } = renderHook(() => useShopeeCategories());

    await act(async () => {
      await result.current.refreshCategories(123, 'pt-BR');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/shopee/categories/refresh'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ shop_id: 123, language: 'pt-BR' }),
      })
    );
  });
});
