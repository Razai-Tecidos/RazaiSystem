import {
  generateShopeeSign,
  getTimestamp,
  getShopeeCredentials,
  getShopeeUrls,
  getShopeeEnv,
  generateAuthUrl,
} from '../src/config/shopee';

describe('Shopee Config', () => {
  describe('getShopeeEnv', () => {
    it('deve retornar sandbox quando SHOPEE_ENV=sandbox', () => {
      process.env.SHOPEE_ENV = 'sandbox';
      expect(getShopeeEnv()).toBe('sandbox');
    });

    it('deve retornar production quando SHOPEE_ENV=production', () => {
      process.env.SHOPEE_ENV = 'production';
      expect(getShopeeEnv()).toBe('production');
    });

    it('deve retornar production como padrão', () => {
      delete process.env.SHOPEE_ENV;
      expect(getShopeeEnv()).toBe('production');
      // Restaura para sandbox para outros testes
      process.env.SHOPEE_ENV = 'sandbox';
    });
  });

  describe('getShopeeUrls', () => {
    it('deve retornar URLs de sandbox quando env=sandbox', () => {
      process.env.SHOPEE_ENV = 'sandbox';
      const urls = getShopeeUrls();
      expect(urls.host).toContain('test-stable');
    });

    it('deve retornar URLs de produção quando env=production', () => {
      process.env.SHOPEE_ENV = 'production';
      const urls = getShopeeUrls();
      expect(urls.host).toBe('https://partner.shopeemobile.com');
      process.env.SHOPEE_ENV = 'sandbox';
    });
  });

  describe('getShopeeCredentials', () => {
    it('deve retornar credenciais configuradas', () => {
      const credentials = getShopeeCredentials();
      expect(credentials.partnerId).toBe(12345);
      expect(credentials.partnerKey).toBe('test_partner_key_123');
      expect(credentials.redirectUrl).toBe('https://test.example.com/shopee');
    });

    it('deve lançar erro se PARTNER_ID não estiver configurado', () => {
      const originalId = process.env.SHOPEE_PARTNER_ID;
      delete process.env.SHOPEE_PARTNER_ID;
      
      expect(() => getShopeeCredentials()).toThrow('SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY são obrigatórios');
      
      process.env.SHOPEE_PARTNER_ID = originalId;
    });

    it('deve lançar erro se PARTNER_KEY não estiver configurado', () => {
      const originalKey = process.env.SHOPEE_PARTNER_KEY;
      delete process.env.SHOPEE_PARTNER_KEY;
      
      expect(() => getShopeeCredentials()).toThrow('SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY são obrigatórios');
      
      process.env.SHOPEE_PARTNER_KEY = originalKey;
    });
  });

  describe('getTimestamp', () => {
    it('deve retornar timestamp Unix em segundos', () => {
      const timestamp = getTimestamp();
      const now = Math.floor(Date.now() / 1000);
      
      // Deve estar dentro de 1 segundo de diferença
      expect(Math.abs(timestamp - now)).toBeLessThanOrEqual(1);
    });

    it('deve ser um número inteiro', () => {
      const timestamp = getTimestamp();
      expect(Number.isInteger(timestamp)).toBe(true);
    });
  });

  describe('generateShopeeSign', () => {
    it('deve gerar assinatura HMAC-SHA256 válida', () => {
      const partnerKey = 'test_key';
      const partnerId = 12345;
      const apiPath = '/api/v2/shop/auth_partner';
      const timestamp = 1700000000;

      const sign = generateShopeeSign(partnerKey, partnerId, apiPath, timestamp);

      // Assinatura deve ser uma string hexadecimal de 64 caracteres (SHA256)
      expect(sign).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve gerar assinatura diferente para timestamps diferentes', () => {
      const partnerKey = 'test_key';
      const partnerId = 12345;
      const apiPath = '/api/v2/shop/auth_partner';

      const sign1 = generateShopeeSign(partnerKey, partnerId, apiPath, 1700000000);
      const sign2 = generateShopeeSign(partnerKey, partnerId, apiPath, 1700000001);

      expect(sign1).not.toBe(sign2);
    });

    it('deve incluir accessToken e shopId na assinatura quando fornecidos', () => {
      const partnerKey = 'test_key';
      const partnerId = 12345;
      const apiPath = '/api/v2/product/get_item_list';
      const timestamp = 1700000000;
      const accessToken = 'access_token_123';
      const shopId = 67890;

      const signWithoutToken = generateShopeeSign(partnerKey, partnerId, apiPath, timestamp);
      const signWithToken = generateShopeeSign(partnerKey, partnerId, apiPath, timestamp, accessToken, shopId);

      expect(signWithToken).not.toBe(signWithoutToken);
    });

    it('deve ser determinística (mesmos inputs = mesmo output)', () => {
      const partnerKey = 'test_key';
      const partnerId = 12345;
      const apiPath = '/api/v2/shop/auth_partner';
      const timestamp = 1700000000;

      const sign1 = generateShopeeSign(partnerKey, partnerId, apiPath, timestamp);
      const sign2 = generateShopeeSign(partnerKey, partnerId, apiPath, timestamp);

      expect(sign1).toBe(sign2);
    });
  });

  describe('generateAuthUrl', () => {
    it('deve gerar URL de autorização válida', () => {
      const url = generateAuthUrl();

      expect(url).toContain('partner_id=12345');
      expect(url).toContain('timestamp=');
      expect(url).toContain('sign=');
      expect(url).toContain('redirect=');
    });

    it('deve usar URL de sandbox quando configurado', () => {
      process.env.SHOPEE_ENV = 'sandbox';
      const url = generateAuthUrl();

      expect(url).toContain('test-stable');
    });

    it('deve codificar redirect URL corretamente', () => {
      const url = generateAuthUrl();
      
      // A redirect URL deve estar URL-encoded
      expect(url).toContain(encodeURIComponent('https://test.example.com/shopee'));
    });
  });
});
