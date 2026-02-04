import crypto from 'crypto';

// Configuracoes do Shopee Open Platform
export const SHOPEE_CONFIG = {
  // URLs de producao
  production: {
    host: 'https://partner.shopeemobile.com',
    authPath: '/api/v2/shop/auth_partner',
    tokenPath: '/api/v2/auth/token/get',
    refreshTokenPath: '/api/v2/auth/access_token/get',
    cancelAuthPath: '/api/v2/shop/cancel_auth_partner',
  },
  // URLs de sandbox (testes)
  sandbox: {
    host: 'https://partner.test-stable.shopeemobile.com',
    authPath: '/api/v2/shop/auth_partner',
    tokenPath: '/api/v2/auth/token/get',
    refreshTokenPath: '/api/v2/auth/access_token/get',
    cancelAuthPath: '/api/v2/shop/cancel_auth_partner',
  },
};

// Ambiente atual (production ou sandbox)
export function getShopeeEnv(): 'production' | 'sandbox' {
  return (process.env.SHOPEE_ENV as 'production' | 'sandbox') || 'production';
}

// Retorna as URLs baseado no ambiente
export function getShopeeUrls() {
  const env = getShopeeEnv();
  return SHOPEE_CONFIG[env];
}

// Credenciais do App
export function getShopeeCredentials() {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const redirectUrl = process.env.SHOPEE_REDIRECT_URL;

  if (!partnerId || !partnerKey) {
    throw new Error('SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY sao obrigatorios');
  }

  return {
    partnerId: parseInt(partnerId, 10),
    partnerKey,
    redirectUrl: redirectUrl || 'https://razaisystem.web.app/shopee-callback.html',
  };
}

/**
 * Gera a assinatura HMAC-SHA256 para autenticacao na API Shopee
 *
 * Para APIs Publicas: partner_id + api_path + timestamp
 * Para APIs de Shop: partner_id + api_path + timestamp + access_token + shop_id
 * Para APIs de Merchant: partner_id + api_path + timestamp + access_token + merchant_id
 */
export function generateShopeeSign(
  partnerKey: string,
  partnerId: number,
  apiPath: string,
  timestamp: number,
  accessToken?: string,
  shopId?: number,
  merchantId?: number
): string {
  let baseString = `${partnerId}${apiPath}${timestamp}`;

  if (accessToken && shopId) {
    baseString += `${accessToken}${shopId}`;
  } else if (accessToken && merchantId) {
    baseString += `${accessToken}${merchantId}`;
  }

  const sign = crypto
    .createHmac('sha256', partnerKey)
    .update(baseString)
    .digest('hex');

  return sign;
}

/**
 * Gera timestamp Unix atual (em segundos)
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Gera URL de autorizacao completa para Shopee
 */
export function generateAuthUrl(): string {
  const { partnerId, partnerKey, redirectUrl } = getShopeeCredentials();
  const { host, authPath } = getShopeeUrls();
  const timestamp = getTimestamp();

  const sign = generateShopeeSign(partnerKey, partnerId, authPath, timestamp);

  const url = `${host}${authPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;

  return url;
}

/**
 * Gera URL para cancelar autorizacao
 */
export function generateCancelAuthUrl(): string {
  const { partnerId, partnerKey, redirectUrl } = getShopeeCredentials();
  const { host, cancelAuthPath } = getShopeeUrls();
  const timestamp = getTimestamp();

  const sign = generateShopeeSign(partnerKey, partnerId, cancelAuthPath, timestamp);

  const url = `${host}${cancelAuthPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;

  return url;
}
