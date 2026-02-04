import { Timestamp } from 'firebase/firestore';

/**
 * Dados de uma loja Shopee conectada
 */
export interface ShopeeShop {
  shopId: number;
  shopName?: string;
  connectedAt: Timestamp;
  connectedBy: string;
  tokenExpiresAt: Timestamp;
}

/**
 * Status de conexão com Shopee
 */
export interface ShopeeConnectionStatus {
  connected: boolean;
  shop?: ShopeeShop;
  shops?: ShopeeShop[];
}

/**
 * Resposta da API de autorização
 */
export interface ShopeeAuthUrlResponse {
  success: boolean;
  data?: {
    authUrl: string;
  };
  error?: string;
}

/**
 * Resposta da API de callback
 */
export interface ShopeeCallbackResponse {
  success: boolean;
  data?: {
    shopId: number;
    message: string;
  };
  error?: string;
}

/**
 * Resposta da API de status
 */
export interface ShopeeStatusResponse {
  success: boolean;
  data?: ShopeeConnectionStatus;
  error?: string;
}

/**
 * Resposta da API de lojas
 */
export interface ShopeeShopsResponse {
  success: boolean;
  data?: {
    shops: ShopeeShop[];
  };
  error?: string;
}

/**
 * Resposta da API de desconexão
 */
export interface ShopeeDisconnectResponse {
  success: boolean;
  data?: {
    shopId: number;
    message: string;
  };
  error?: string;
}

/**
 * Parâmetros retornados pela Shopee no callback
 */
export interface ShopeeCallbackParams {
  code: string;
  shop_id?: string;
  main_account_id?: string;
}
