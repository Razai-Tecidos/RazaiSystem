import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useShopee } from './useShopee';

// Mock do módulo de toast
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useShopee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    
    // Reset window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
    });
  });

  describe('estado inicial', () => {
    it('deve inicializar com loading true', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { shops: [] } }),
      });

      const { result } = renderHook(() => useShopee());

      expect(result.current.loading).toBe(true);
      expect(result.current.shops).toEqual([]);
      expect(result.current.connected).toBe(false);
    });
  });

  describe('checkForCallback', () => {
    it('deve detectar parâmetros de callback na URL', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000/shopee?code=abc123&shop_id=12345',
          pathname: '/shopee',
          search: '?code=abc123&shop_id=12345',
        },
        writable: true,
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { shops: [] } }),
      });

      const { result } = renderHook(() => useShopee());

      const callbackParams = result.current.checkForCallback();

      expect(callbackParams).toEqual({
        code: 'abc123',
        shop_id: '12345',
      });
    });

    it('deve retornar null quando não há parâmetros de callback', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { shops: [] } }),
      });

      const { result } = renderHook(() => useShopee());

      const callbackParams = result.current.checkForCallback();

      expect(callbackParams).toBeNull();
    });
  });

  describe('connect', () => {
    it('deve obter URL de autorização e redirecionar', async () => {
      const mockAuthUrl = 'https://partner.shopeemobile.com/api/v2/shop/auth_partner?...';

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { shops: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { authUrl: mockAuthUrl } }),
        });

      const { result } = renderHook(() => useShopee());

      await act(async () => {
        await result.current.connect();
      });

      // Verifica que fetch foi chamado para auth-url
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/shopee/auth-url'),
        expect.any(Object)
      );
    });

    it('deve definir connecting como true durante conexão', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { shops: [] } }),
        })
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { authUrl: 'https://...' } }),
          }), 100))
        );

      const { result } = renderHook(() => useShopee());

      act(() => {
        result.current.connect();
      });

      expect(result.current.connecting).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('deve chamar API de desconexão', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              shops: [{ shopId: 12345, shopName: 'Test Shop' }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { shopId: 12345, message: 'Desconectado' },
          }),
        });

      const { result } = renderHook(() => useShopee());

      // Aguarda carregamento inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.disconnect(12345);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/shopee/disconnect'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ shop_id: 12345 }),
        })
      );
    });
  });

  describe('handleCallback', () => {
    it('deve processar callback com sucesso', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { shops: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { shopId: 12345, message: 'Conectado!' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { shops: [{ shopId: 12345 }] },
          }),
        });

      const { result } = renderHook(() => useShopee());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.handleCallback({
          code: 'abc123',
          shop_id: '12345',
        });
      });

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/shopee/callback'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('deve retornar false em caso de erro', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { shops: [] } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ success: false, error: 'Invalid code' }),
        });

      const { result } = renderHook(() => useShopee());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.handleCallback({
          code: 'invalid',
          shop_id: '12345',
        });
      });

      expect(success).toBe(false);
    });
  });
});
