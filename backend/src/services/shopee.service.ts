import axios from 'axios';
import admin from '../config/firebase';
import {
  getShopeeCredentials,
  getShopeeUrls,
  generateShopeeSign,
  getTimestamp,
  generateAuthUrl,
} from '../config/shopee';

const db = admin.firestore();
const SHOPEE_SHOPS_COLLECTION = 'shopee_shops';

// Tipos
export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  request_id: string;
  error: string;
  message: string;
  shop_id_list?: number[];
  merchant_id_list?: number[];
}

export interface ShopeeShopData {
  shopId: number;
  shopName?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: admin.firestore.Timestamp;
  connectedAt: admin.firestore.Timestamp;
  connectedBy: string; // UID do usuário que conectou
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Gera URL de autorização
 */
export function getAuthUrl(): string {
  return generateAuthUrl();
}

/**
 * Troca o código de autorização por tokens de acesso
 */
export async function getAccessToken(
  code: string,
  shopId: number
): Promise<ShopeeTokenResponse> {
  const { partnerId, partnerKey } = getShopeeCredentials();
  const { host, tokenPath } = getShopeeUrls();
  const timestamp = getTimestamp();

  const sign = generateShopeeSign(partnerKey, partnerId, tokenPath, timestamp);

  const url = `${host}${tokenPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    code,
    shop_id: shopId,
    partner_id: partnerId,
  };

  try {
    const response = await axios.post<ShopeeTokenResponse>(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.error) {
      throw new Error(`Shopee API Error: ${response.data.error} - ${response.data.message}`);
    }

    return response.data;
  } catch (error: any) {
    console.error('Erro ao obter access token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Renova o access token usando o refresh token
 */
export async function refreshAccessToken(
  shopId: number,
  refreshToken: string
): Promise<ShopeeTokenResponse> {
  const { partnerId, partnerKey } = getShopeeCredentials();
  const { host, refreshTokenPath } = getShopeeUrls();
  const timestamp = getTimestamp();

  const sign = generateShopeeSign(partnerKey, partnerId, refreshTokenPath, timestamp);

  const url = `${host}${refreshTokenPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    shop_id: shopId,
    refresh_token: refreshToken,
    partner_id: partnerId,
  };

  try {
    const response = await axios.post<ShopeeTokenResponse>(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.error) {
      throw new Error(`Shopee API Error: ${response.data.error} - ${response.data.message}`);
    }

    return response.data;
  } catch (error: any) {
    console.error('Erro ao renovar access token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Salva os tokens da loja no Firestore
 */
export async function saveShopTokens(
  shopId: number,
  accessToken: string,
  refreshToken: string,
  expireIn: number,
  connectedBy: string,
  shopName?: string
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + (expireIn * 1000) - (5 * 60 * 1000) // 5 min de margem
  );

  const docRef = db.collection(SHOPEE_SHOPS_COLLECTION).doc(shopId.toString());
  const docSnap = await docRef.get();

  const data: Partial<ShopeeShopData> = {
    shopId,
    accessToken,
    refreshToken,
    tokenExpiresAt: expiresAt,
    updatedAt: now,
  };

  if (!docSnap.exists) {
    // Primeira conexão
    data.connectedAt = now;
    data.connectedBy = connectedBy;
    if (shopName) data.shopName = shopName;
  }

  await docRef.set(data, { merge: true });
}

/**
 * Obtém os tokens da loja do Firestore
 */
export async function getShopTokens(shopId: number): Promise<ShopeeShopData | null> {
  const docRef = db.collection(SHOPEE_SHOPS_COLLECTION).doc(shopId.toString());
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return null;
  }

  return docSnap.data() as ShopeeShopData;
}

/**
 * Lista todas as lojas conectadas
 */
export async function getConnectedShops(): Promise<ShopeeShopData[]> {
  const snapshot = await db.collection(SHOPEE_SHOPS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.data() as ShopeeShopData);
}

/**
 * Verifica se o token precisa ser renovado e renova se necessário
 */
export async function ensureValidToken(shopId: number): Promise<string> {
  const shopData = await getShopTokens(shopId);

  if (!shopData) {
    throw new Error(`Loja ${shopId} não está conectada`);
  }

  const now = Date.now();
  const expiresAt = shopData.tokenExpiresAt.toMillis();

  // Se o token ainda é válido, retorna ele
  if (now < expiresAt) {
    return shopData.accessToken;
  }

  // Token expirado ou prestes a expirar, renova
  console.log(`Renovando token para loja ${shopId}...`);
  
  const tokenResponse = await refreshAccessToken(shopId, shopData.refreshToken);

  // Salva os novos tokens
  await saveShopTokens(
    shopId,
    tokenResponse.access_token,
    tokenResponse.refresh_token,
    tokenResponse.expire_in,
    shopData.connectedBy,
    shopData.shopName
  );

  return tokenResponse.access_token;
}

/**
 * Desconecta uma loja (remove do Firestore)
 */
export async function disconnectShop(shopId: number): Promise<void> {
  const docRef = db.collection(SHOPEE_SHOPS_COLLECTION).doc(shopId.toString());
  await docRef.delete();
}

/**
 * Verifica o status de conexão de uma loja
 */
export async function getShopConnectionStatus(shopId?: number): Promise<{
  connected: boolean;
  shop?: ShopeeShopData;
  shops?: ShopeeShopData[];
}> {
  if (shopId) {
    const shop = await getShopTokens(shopId);
    return {
      connected: !!shop,
      shop: shop || undefined,
    };
  }

  const shops = await getConnectedShops();
  return {
    connected: shops.length > 0,
    shops,
  };
}
