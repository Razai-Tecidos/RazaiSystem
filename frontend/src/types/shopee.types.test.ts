import { describe, it, expect } from 'vitest';
import type {
  ShopeeShop,
  ShopeeConnectionStatus,
  ShopeeAuthUrlResponse,
  ShopeeCallbackResponse,
  ShopeeCallbackParams,
} from './shopee.types';

describe('Shopee Types', () => {
  describe('ShopeeShop', () => {
    it('deve aceitar objeto com campos obrigatórios', () => {
      const shop: ShopeeShop = {
        shopId: 12345,
        connectedAt: { toDate: () => new Date() } as any,
        connectedBy: 'user-123',
        tokenExpiresAt: { toDate: () => new Date() } as any,
      };

      expect(shop.shopId).toBe(12345);
      expect(shop.connectedBy).toBe('user-123');
    });

    it('deve aceitar shopName opcional', () => {
      const shop: ShopeeShop = {
        shopId: 12345,
        shopName: 'Minha Loja',
        connectedAt: { toDate: () => new Date() } as any,
        connectedBy: 'user-123',
        tokenExpiresAt: { toDate: () => new Date() } as any,
      };

      expect(shop.shopName).toBe('Minha Loja');
    });
  });

  describe('ShopeeConnectionStatus', () => {
    it('deve representar estado não conectado', () => {
      const status: ShopeeConnectionStatus = {
        connected: false,
      };

      expect(status.connected).toBe(false);
      expect(status.shop).toBeUndefined();
      expect(status.shops).toBeUndefined();
    });

    it('deve representar estado conectado com uma loja', () => {
      const status: ShopeeConnectionStatus = {
        connected: true,
        shop: {
          shopId: 12345,
          shopName: 'Loja Teste',
          connectedAt: { toDate: () => new Date() } as any,
          connectedBy: 'user-123',
          tokenExpiresAt: { toDate: () => new Date() } as any,
        },
      };

      expect(status.connected).toBe(true);
      expect(status.shop?.shopId).toBe(12345);
    });

    it('deve representar estado conectado com múltiplas lojas', () => {
      const status: ShopeeConnectionStatus = {
        connected: true,
        shops: [
          {
            shopId: 12345,
            connectedAt: { toDate: () => new Date() } as any,
            connectedBy: 'user-123',
            tokenExpiresAt: { toDate: () => new Date() } as any,
          },
          {
            shopId: 67890,
            connectedAt: { toDate: () => new Date() } as any,
            connectedBy: 'user-123',
            tokenExpiresAt: { toDate: () => new Date() } as any,
          },
        ],
      };

      expect(status.shops?.length).toBe(2);
    });
  });

  describe('ShopeeAuthUrlResponse', () => {
    it('deve representar resposta de sucesso', () => {
      const response: ShopeeAuthUrlResponse = {
        success: true,
        data: {
          authUrl: 'https://partner.shopeemobile.com/...',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data?.authUrl).toContain('shopeemobile.com');
    });

    it('deve representar resposta de erro', () => {
      const response: ShopeeAuthUrlResponse = {
        success: false,
        error: 'Credenciais inválidas',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Credenciais inválidas');
    });
  });

  describe('ShopeeCallbackParams', () => {
    it('deve aceitar parâmetros de callback', () => {
      const params: ShopeeCallbackParams = {
        code: 'abc123xyz',
        shop_id: '12345',
      };

      expect(params.code).toBe('abc123xyz');
      expect(params.shop_id).toBe('12345');
    });

    it('deve aceitar main_account_id opcional', () => {
      const params: ShopeeCallbackParams = {
        code: 'abc123xyz',
        main_account_id: 'main-123',
      };

      expect(params.main_account_id).toBe('main-123');
      expect(params.shop_id).toBeUndefined();
    });
  });

  describe('ShopeeCallbackResponse', () => {
    it('deve representar resposta de sucesso', () => {
      const response: ShopeeCallbackResponse = {
        success: true,
        data: {
          shopId: 12345,
          message: 'Loja conectada com sucesso!',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data?.shopId).toBe(12345);
    });
  });
});
