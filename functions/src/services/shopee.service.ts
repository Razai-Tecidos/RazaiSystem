import axios from 'axios';
import FormData from 'form-data';
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
  connectedBy: string;
  updatedAt: admin.firestore.Timestamp;
}

export interface ShopeeApiRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  shopId: number;
  accessToken: string;
  query?: Record<string, string | number | boolean>;
  body?: Record<string, unknown>;
}

export interface UploadRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_UPLOAD_RETRY_OPTIONS: Required<UploadRetryOptions> = {
  maxRetries: 1,
  baseDelayMs: 500,
  maxDelayMs: 4000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 200);
  return exponential + jitter;
}

function shouldRetryUpload(statusCode: number | undefined, errorCode: string | undefined, shopeeError: string): boolean {
  if (statusCode === 429) return true;
  if (typeof statusCode === 'number' && statusCode >= 500) return true;

  const normalizedErrorCode = (errorCode || '').toUpperCase();
  if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN'].includes(normalizedErrorCode)) {
    return true;
  }

  const normalizedShopeeError = (shopeeError || '').toLowerCase();
  return (
    normalizedShopeeError.includes('system_error') ||
    normalizedShopeeError.includes('internal_error') ||
    normalizedShopeeError.includes('service_unavailable') ||
    normalizedShopeeError.includes('api_limit')
  );
}

/**
 * Gera URL de autorizacao
 */
export function getAuthUrl(): string {
  return generateAuthUrl();
}

/**
 * Troca o codigo de autorizacao por tokens de acesso
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
    Date.now() + (expireIn * 1000) - (5 * 60 * 1000)
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
    data.connectedAt = now;
    data.connectedBy = connectedBy;
    if (shopName) data.shopName = shopName;
  }

  await docRef.set(data, { merge: true });
}

/**
 * Obtem os tokens da loja do Firestore
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
 * Verifica se o token precisa ser renovado e renova se necessario
 */
export async function ensureValidToken(shopId: number): Promise<string> {
  const shopData = await getShopTokens(shopId);

  if (!shopData) {
    throw new Error(`Loja ${shopId} nao esta conectada`);
  }

  const now = Date.now();
  const expiresAt = shopData.tokenExpiresAt.toMillis();

  if (now < expiresAt) {
    console.log(`[ensureValidToken] Token valido para loja ${shopId}, expira em ${Math.round((expiresAt - now) / 60000)} min`);
    return shopData.accessToken;
  }

  console.log(`[ensureValidToken] Token EXPIRADO para loja ${shopId}, renovando...`);

  const tokenResponse = await refreshAccessToken(shopId, shopData.refreshToken);

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
 * Faz chamada assinada para API Shopee
 */
export async function callShopeeApi(request: ShopeeApiRequest): Promise<unknown> {
  const { partnerId, partnerKey } = getShopeeCredentials();
  const { host } = getShopeeUrls();
  const timestamp = getTimestamp();

  const sign = generateShopeeSign(
    partnerKey,
    partnerId,
    request.path,
    timestamp,
    request.accessToken,
    request.shopId
  );

  const params = {
    partner_id: partnerId,
    timestamp,
    sign,
    access_token: request.accessToken,
    shop_id: request.shopId,
    ...(request.query || {}),
  };

  const url = `${host}${request.path}`;

  try {
    const response = await axios.request({
      url,
      method: request.method || 'GET',
      params,
      data: request.body || undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 segundos timeout
    });

    // Log de erro da API Shopee (quando retorna 200 mas com error no body)
    if (response.data?.error) {
      console.error(`[ShopeeAPI] ${request.path} - Error:`, response.data.error, response.data.message);
    }

    return response.data;
  } catch (error: any) {
    const shopeeError = error.response?.data?.error || '';
    const shopeeMessage = error.response?.data?.message || error.message;
    const httpStatus = error.response?.status || 'N/A';

    console.error(`[ShopeeAPI] ${request.path} - FALHOU: status=${httpStatus}, error=${shopeeError}, message=${shopeeMessage}`);

    // Propaga mensagem clara ao invés do objeto axios inteiro
    const errorMsg = shopeeError
      ? `Erro Shopee (${request.path}): ${shopeeError} - ${shopeeMessage}`
      : `Erro ao chamar Shopee API (${request.path}): ${shopeeMessage}`;
    throw new Error(errorMsg);
  }
}

/**
 * Faz upload de imagem para Shopee Media Space usando multipart/form-data
 * Este endpoint requer multipart/form-data, não JSON com base64
 */
export async function uploadImageToShopeeMultipart(
  shopId: number,
  accessToken: string,
  imageBuffer: Buffer,
  filename: string = 'image.jpg',
  ratio?: '1:1' | '3:4',
  retryOptions?: UploadRetryOptions
): Promise<unknown> {
  const { partnerId, partnerKey } = getShopeeCredentials();
  const { host } = getShopeeUrls();
  const timestamp = getTimestamp();
  const path = '/api/v2/media_space/upload_image';

  const sign = generateShopeeSign(
    partnerKey,
    partnerId,
    path,
    timestamp,
    accessToken,
    shopId
  );

  // Parâmetros da query (assinatura HMAC)
  const params = {
    partner_id: partnerId,
    timestamp,
    sign,
    access_token: accessToken,
    shop_id: shopId,
  };

  const url = `${host}${path}`;
  const retryConfig = { ...DEFAULT_UPLOAD_RETRY_OPTIONS, ...(retryOptions || {}) };

  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt += 1) {
    try {
      // Recria o FormData a cada tentativa para evitar reuse de stream em retry.
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename,
        contentType: 'image/jpeg', // Shopee aceita JPEG, PNG
      });
      formData.append('scene', 'normal');
      if (ratio) {
        formData.append('ratio', ratio);
      }

      const response = await axios.post(url, formData, {
        params,
        headers: {
          ...formData.getHeaders(), // Inclui Content-Type com boundary
        },
        timeout: 60000, // 60 segundos para upload de imagem
      });

      if (response.data?.error) {
        const shopeeError = String(response.data.error || '');
        const shopeeMessage = String(response.data.message || '');
        const retryable = shouldRetryUpload(response.status, undefined, shopeeError);

        if (retryable && attempt <= retryConfig.maxRetries) {
          const delayMs = getBackoffDelay(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs);
          console.warn(
            `[ShopeeAPI] ${path} - tentativa ${attempt}/${retryConfig.maxRetries + 1} com erro recuperavel (${shopeeError}). Retry em ${delayMs}ms`
          );
          await sleep(delayMs);
          continue;
        }

        console.error(`[ShopeeAPI] ${path} - Error:`, shopeeError, shopeeMessage);
      }

      return response.data;
    } catch (error: any) {
      const shopeeError = error.response?.data?.error || '';
      const shopeeMessage = error.response?.data?.message || error.message;
      const httpStatus = error.response?.status;
      const errorCode = error.code;
      const retryable = shouldRetryUpload(httpStatus, errorCode, shopeeError);

      if (retryable && attempt <= retryConfig.maxRetries) {
        const delayMs = getBackoffDelay(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs);
        console.warn(
          `[ShopeeAPI] ${path} - tentativa ${attempt}/${retryConfig.maxRetries + 1} falhou (status=${httpStatus || 'N/A'}, code=${errorCode || 'N/A'}). Retry em ${delayMs}ms`
        );
        await sleep(delayMs);
        continue;
      }

      const statusLog = httpStatus || 'N/A';
      console.error(`[ShopeeAPI] ${path} - FALHOU: status=${statusLog}, error=${shopeeError}, message=${shopeeMessage}`);

      const errorMsg = shopeeError
        ? `Erro Shopee upload (${path}): ${shopeeError} - ${shopeeMessage}`
        : `Erro upload imagem (${path}): HTTP ${statusLog} - ${shopeeMessage}`;
      throw new Error(errorMsg);
    }
  }

  throw new Error(`Erro upload imagem (${path}): tentativas esgotadas`);
}

/**
 * Desconecta uma loja (remove do Firestore)
 */
export async function disconnectShop(shopId: number): Promise<void> {
  const docRef = db.collection(SHOPEE_SHOPS_COLLECTION).doc(shopId.toString());
  await docRef.delete();
}

/**
 * Verifica o status de conexao de uma loja
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

// ============================================================
// PAYMENT API - Dados financeiros
// ============================================================

export interface EscrowDetail {
  order_sn: string;
  buyer_user_name: string;
  return_order_sn_list: string[];
  order_income: {
    escrow_amount: number;
    buyer_total_amount: number;
    original_price: number;
    seller_discount: number;
    shopee_discount: number;
    voucher_from_seller: number;
    voucher_from_shopee: number;
    coins: number;
    buyer_paid_shipping_fee: number;
    buyer_transaction_fee: number;
    cross_border_tax: number;
    payment_promotion: number;
    commission_fee: number;
    service_fee: number;
    seller_transaction_fee: number;
    seller_lost_compensation: number;
    seller_coin_cash_back: number;
    escrow_tax: number;
    final_shipping_fee: number;
    actual_shipping_fee_confirmed: boolean;
    shopee_shipping_rebate: number;
    shipping_fee_discount_from_3pl: number;
    seller_shipping_discount: number;
    estimated_shipping_fee: number;
    seller_voucher_code: string[];
    drc_adjustable_refund: number;
    cost_of_goods_sold: number;
    original_cost_of_goods_sold: number;
    original_shopee_discount: number;
    seller_return_refund: number;
    items: Array<{
      item_id: number;
      item_name: string;
      item_sku: string;
      model_id: number;
      model_name: string;
      model_sku: string;
      original_price: number;
      discounted_price: number;
      seller_discount: number;
      shopee_discount: number;
      discount_from_coin: number;
      discount_from_voucher_shopee: number;
      discount_from_voucher_seller: number;
      activity_type: string;
      activity_id: number;
      is_main_item: boolean;
      quantity_purchased: number;
      escrow_amount_item_level: number;
      wholesale_related_info?: string;
    }>;
  };
}

export interface IncomeDetail {
  order_sn: string;
  payout_time: number;
  escrow_release_time: number;
  buyer_user_name: string;
  payment_method: string;
  original_price: number;
  buyer_paid_shipping_fee: number;
  voucher_from_seller: number;
  voucher_from_shopee: number;
  commission_fee: number;
  service_fee: number;
  seller_transaction_fee: number;
  actual_shipping_fee: number;
  shopee_shipping_rebate: number;
  escrow_amount: number;
}

/**
 * Busca detalhes do escrow de um pedido
 */
export async function getEscrowDetail(
  shopId: number,
  orderSn: string
): Promise<EscrowDetail | null> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/payment/get_escrow_detail',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        order_sn: orderSn,
      },
    }) as { error?: string; response?: EscrowDetail };

    if (response.error) {
      console.error(`Erro ao buscar escrow detail: ${response.error}`);
      return null;
    }

    return response.response || null;
  } catch (error: any) {
    console.error('Erro ao buscar escrow detail:', error.message);
    return null;
  }
}

/**
 * Busca lista de escrows em um período
 */
export async function getEscrowList(
  shopId: number,
  releaseTimeFrom: number,
  releaseTimeTo: number,
  pageSize = 100,
  cursor = ''
): Promise<{
  orders: Array<{ order_sn: string; payout_time: number }>;
  more: boolean;
  nextCursor: string;
}> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const query: Record<string, string | number> = {
      release_time_from: releaseTimeFrom,
      release_time_to: releaseTimeTo,
      page_size: pageSize,
    };
    
    if (cursor) {
      query.cursor = cursor;
    }

    const response = await callShopeeApi({
      path: '/api/v2/payment/get_escrow_list',
      method: 'GET',
      shopId,
      accessToken,
      query,
    }) as {
      error?: string;
      response?: {
        order_list: Array<{ order_sn: string; payout_time: number }>;
        more: boolean;
        next_cursor: string;
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar escrow list: ${response.error}`);
      return { orders: [], more: false, nextCursor: '' };
    }

    return {
      orders: response.response?.order_list || [],
      more: response.response?.more || false,
      nextCursor: response.response?.next_cursor || '',
    };
  } catch (error: any) {
    console.error('Erro ao buscar escrow list:', error.message);
    return { orders: [], more: false, nextCursor: '' };
  }
}

/**
 * Busca detalhes de escrow em lote
 */
export async function getEscrowDetailBatch(
  shopId: number,
  orderSnList: string[]
): Promise<EscrowDetail[]> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/payment/get_escrow_detail_batch',
      method: 'POST',
      shopId,
      accessToken,
      body: {
        order_sn_list: orderSnList,
      },
    }) as {
      error?: string;
      response?: {
        order_list: EscrowDetail[];
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar escrow batch: ${response.error}`);
      return [];
    }

    return response.response?.order_list || [];
  } catch (error: any) {
    console.error('Erro ao buscar escrow batch:', error.message);
    return [];
  }
}

/**
 * Busca visão geral de receita
 */
export async function getIncomeOverview(
  shopId: number,
  releaseTimeFrom: number,
  releaseTimeTo: number
): Promise<{
  total_released_amount: number;
  total_released_order_count: number;
  total_unreleased_amount: number;
  total_unreleased_order_count: number;
} | null> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/payment/get_income_overview',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        release_time_from: releaseTimeFrom,
        release_time_to: releaseTimeTo,
      },
    }) as {
      error?: string;
      response?: {
        total_released_amount: number;
        total_released_order_count: number;
        total_unreleased_amount: number;
        total_unreleased_order_count: number;
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar income overview: ${response.error}`);
      return null;
    }

    return response.response || null;
  } catch (error: any) {
    console.error('Erro ao buscar income overview:', error.message);
    return null;
  }
}

/**
 * Gera relatório de receita (async - retorna task_id)
 */
export async function generateIncomeReport(
  shopId: number,
  releaseTimeFrom: number,
  releaseTimeTo: number
): Promise<string | null> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/payment/generate_income_report',
      method: 'POST',
      shopId,
      accessToken,
      body: {
        release_time_from: releaseTimeFrom,
        release_time_to: releaseTimeTo,
      },
    }) as {
      error?: string;
      response?: {
        task_id: string;
      };
    };

    if (response.error) {
      console.error(`Erro ao gerar income report: ${response.error}`);
      return null;
    }

    return response.response?.task_id || null;
  } catch (error: any) {
    console.error('Erro ao gerar income report:', error.message);
    return null;
  }
}

/**
 * Busca relatório de receita gerado
 */
export async function getIncomeReport(
  shopId: number,
  taskId: string
): Promise<{
  status: string;
  download_url?: string;
} | null> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/payment/get_income_report',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        task_id: taskId,
      },
    }) as {
      error?: string;
      response?: {
        status: string;
        download_url?: string;
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar income report: ${response.error}`);
      return null;
    }

    return response.response || null;
  } catch (error: any) {
    console.error('Erro ao buscar income report:', error.message);
    return null;
  }
}

// ============================================================
// ORDER API - Histórico de pedidos
// ============================================================

export interface OrderItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  model_id: number;
  model_name: string;
  model_sku: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
  wholesale: boolean;
  weight: number;
  add_on_deal: boolean;
  main_item: boolean;
  add_on_deal_id: number;
  promotion_type: string;
  promotion_id: number;
  order_item_id: number;
  promotion_group_id: number;
  image_info: {
    image_url: string;
  };
}

export interface OrderDetail {
  order_sn: string;
  region: string;
  currency: string;
  cod: boolean;
  total_amount: number;
  order_status: string;
  shipping_carrier: string;
  payment_method: string;
  estimated_shipping_fee: number;
  message_to_seller: string;
  create_time: number;
  update_time: number;
  days_to_ship: number;
  ship_by_date: number;
  buyer_user_id: number;
  buyer_username: string;
  recipient_address: {
    name: string;
    phone: string;
    town: string;
    district: string;
    city: string;
    state: string;
    region: string;
    zipcode: string;
    full_address: string;
  };
  actual_shipping_fee: number;
  goods_to_declare: boolean;
  note: string;
  note_update_time: number;
  item_list: OrderItem[];
  pay_time: number;
  dropshipper: string;
  dropshipper_phone: string;
  split_up: boolean;
  buyer_cancel_reason: string;
  cancel_by: string;
  cancel_reason: string;
  actual_shipping_fee_confirmed: boolean;
  buyer_cpf_id: string;
  fulfillment_flag: string;
  pickup_done_time: number;
  package_list: Array<{
    package_number: string;
    logistics_status: string;
    shipping_carrier: string;
    item_list: Array<{ item_id: number; model_id: number; model_quantity: number }>;
  }>;
  invoice_data: {
    number: string;
    series_number: string;
    access_key: string;
    issue_date: number;
    total_value: number;
    products_total_value: number;
    tax_code: string;
  };
  checkout_shipping_carrier: string;
  reverse_shipping_fee: number;
  order_chargeable_weight_gram: number;
}

/**
 * Busca lista de pedidos em um período
 */
export async function getOrderList(
  shopId: number,
  timeRangeField: 'create_time' | 'update_time' = 'create_time',
  timeFrom: number,
  timeTo: number,
  orderStatus?: string,
  pageSize = 100,
  cursor = ''
): Promise<{
  orders: Array<{ order_sn: string }>;
  more: boolean;
  nextCursor: string;
}> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const query: Record<string, string | number> = {
      time_range_field: timeRangeField,
      time_from: timeFrom,
      time_to: timeTo,
      page_size: pageSize,
    };
    
    if (orderStatus) {
      query.order_status = orderStatus;
    }
    
    if (cursor) {
      query.cursor = cursor;
    }

    const response = await callShopeeApi({
      path: '/api/v2/order/get_order_list',
      method: 'GET',
      shopId,
      accessToken,
      query,
    }) as {
      error?: string;
      response?: {
        order_list: Array<{ order_sn: string }>;
        more: boolean;
        next_cursor: string;
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar order list: ${response.error}`);
      return { orders: [], more: false, nextCursor: '' };
    }

    return {
      orders: response.response?.order_list || [],
      more: response.response?.more || false,
      nextCursor: response.response?.next_cursor || '',
    };
  } catch (error: any) {
    console.error('Erro ao buscar order list:', error.message);
    return { orders: [], more: false, nextCursor: '' };
  }
}

/**
 * Busca detalhes de pedidos em lote
 */
export async function getOrderDetailBatch(
  shopId: number,
  orderSnList: string[],
  responseOptionalFields?: string[]
): Promise<OrderDetail[]> {
  void shopId;
  void orderSnList;
  void responseOptionalFields;
  throw new Error('Detalhes de pedido nao disponiveis nesta integracao');
}

// ============================================================
// PRODUCT API - Atualização de preços
// ============================================================

export interface PriceUpdateResult {
  item_id: number;
  model_id?: number;
  success: boolean;
  error?: string;
}

/**
 * Atualiza preço de um item ou modelo
 */
export async function updatePrice(
  shopId: number,
  itemId: number,
  priceList: Array<{
    model_id?: number;
    original_price: number;
  }>
): Promise<PriceUpdateResult[]> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/product/update_price',
      method: 'POST',
      shopId,
      accessToken,
      body: {
        item_id: itemId,
        price_list: priceList,
      },
    }) as {
      error?: string;
      message?: string;
      response?: {
        failure_list?: Array<{
          model_id?: number;
          failed_reason: string;
        }>;
        success_list?: Array<{
          model_id?: number;
          original_price: number;
        }>;
      };
    };

    if (response.error) {
      console.error(`Erro ao atualizar preço: ${response.error} - ${response.message}`);
      return priceList.map(p => ({
        item_id: itemId,
        model_id: p.model_id,
        success: false,
        error: response.error || response.message,
      }));
    }

    const results: PriceUpdateResult[] = [];

    // Adicionar sucessos
    response.response?.success_list?.forEach(s => {
      results.push({
        item_id: itemId,
        model_id: s.model_id,
        success: true,
      });
    });

    // Adicionar falhas
    response.response?.failure_list?.forEach(f => {
      results.push({
        item_id: itemId,
        model_id: f.model_id,
        success: false,
        error: f.failed_reason,
      });
    });

    return results;
  } catch (error: any) {
    console.error('Erro ao atualizar preço:', error.message);
    return priceList.map(p => ({
      item_id: itemId,
      model_id: p.model_id,
      success: false,
      error: error.message,
    }));
  }
}

/**
 * Busca informações de preço atual de um item
 */
export async function getItemPriceInfo(
  shopId: number,
  itemIds: number[]
): Promise<Array<{
  item_id: number;
  price_info: Array<{
    model_id?: number;
    current_price: number;
    original_price: number;
  }>;
}>> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/product/get_item_base_info',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        item_id_list: itemIds.join(','),
      },
    }) as {
      error?: string;
      response?: {
        item_list: Array<{
          item_id: number;
          price_info: Array<{
            model_id?: number;
            current_price: number;
            original_price: number;
          }>;
        }>;
      };
    };

    if (response.error) {
      console.error(`Erro ao buscar price info: ${response.error}`);
      return [];
    }

    return response.response?.item_list || [];
  } catch (error: any) {
    console.error('Erro ao buscar price info:', error.message);
    return [];
  }
}
