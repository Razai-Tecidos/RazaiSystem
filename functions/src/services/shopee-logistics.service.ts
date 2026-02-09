import admin from '../config/firebase';
import { callShopeeApi, ensureValidToken } from './shopee.service';

const db = admin.firestore();
const LOGISTICS_CACHE_COLLECTION = 'shopee_logistics_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface LogisticsChannel {
  logistics_channel_id: number;
  logistics_channel_name: string;
  cod_enabled: boolean;
  enabled: boolean;
  fee_type: string;
  size_list?: Array<{
    size_id: string;
    name: string;
    default_price: number;
  }>;
  weight_limit?: {
    item_max_weight: number;
    item_min_weight: number;
  };
  item_max_dimension?: {
    height: number;
    width: number;
    length: number;
    unit: string;
  };
  volume_limit?: {
    item_max_volume: number;
    item_min_volume: number;
  };
  logistics_description?: string;
  force_enable?: boolean;
  mask_channel_id?: number;
  preferred?: boolean;
}

export interface LogisticsInfo {
  logistic_id: number;
  enabled: boolean;
  shipping_fee?: number;
  size_id?: string;
  is_free?: boolean;
}

/**
 * Busca canais de logística do cache
 */
async function getCachedLogistics(shopId: number): Promise<LogisticsChannel[] | null> {
  const cacheDoc = await db.collection(LOGISTICS_CACHE_COLLECTION).doc(shopId.toString()).get();
  
  if (!cacheDoc.exists) {
    return null;
  }
  
  const cache = cacheDoc.data();
  const cacheAge = Date.now() - cache?.updated_at?.toMillis();
  
  if (cacheAge < CACHE_TTL_MS) {
    return cache?.channels || null;
  }
  
  return null;
}

/**
 * Salva canais de logística no cache
 */
async function saveLogisticsCache(shopId: number, channels: LogisticsChannel[]): Promise<void> {
  await db.collection(LOGISTICS_CACHE_COLLECTION).doc(shopId.toString()).set({
    channels,
    updated_at: admin.firestore.Timestamp.now(),
  });
}

/**
 * Busca canais de logística da API Shopee
 */
async function fetchLogisticsFromShopee(shopId: number): Promise<LogisticsChannel[]> {
  const accessToken = await ensureValidToken(shopId);
  
  const response = await callShopeeApi({
    path: '/api/v2/logistics/get_channel_list',
    method: 'GET',
    shopId,
    accessToken,
  }) as {
    error?: string;
    message?: string;
    response?: {
      logistics_channel_list: LogisticsChannel[];
    };
  };
  
  if (response.error) {
    throw new Error(`Erro ao buscar canais de logística: ${response.error} - ${response.message}`);
  }
  
  return response.response?.logistics_channel_list || [];
}

/**
 * Busca canais de logística (do cache ou da API)
 */
export async function getLogisticsChannels(shopId: number, forceRefresh = false): Promise<LogisticsChannel[]> {
  if (!forceRefresh) {
    const cached = await getCachedLogistics(shopId);
    if (cached) {
      return cached;
    }
  }
  
  const channels = await fetchLogisticsFromShopee(shopId);
  await saveLogisticsCache(shopId, channels);
  
  return channels;
}

/**
 * Busca apenas canais habilitados
 */
export async function getEnabledLogisticsChannels(shopId: number): Promise<LogisticsChannel[]> {
  const channels = await getLogisticsChannels(shopId);
  return channels.filter(c => c.enabled);
}

/**
 * Gera logistic_info para criação de produto
 * Retorna lista de logísticas habilitadas formatadas para a API add_item
 */
export async function buildLogisticInfoForProduct(
  shopId: number,
  peso: number, // em kg
  dimensoes: { comprimento: number; largura: number; altura: number } // em cm
): Promise<LogisticsInfo[]> {
  const enabledChannels = await getEnabledLogisticsChannels(shopId);
  
  if (enabledChannels.length === 0) {
    throw new Error('Nenhum canal de logística habilitado. Configure a logística na Shopee primeiro.');
  }
  
  const logisticInfo: LogisticsInfo[] = [];

  console.log(`[buildLogisticInfo] peso=${peso}kg, dimensoes=${JSON.stringify(dimensoes)}, enabledChannels=${enabledChannels.length}`);

  for (const channel of enabledChannels) {
    let skipped = false;

    // Verifica se o produto está dentro dos limites de peso
    // Shopee API retorna weight_limit em kg (mesma unidade do produto)
    if (channel.weight_limit) {
      if (peso < channel.weight_limit.item_min_weight ||
          peso > channel.weight_limit.item_max_weight) {
        console.log(`[buildLogisticInfo] Canal ${channel.logistics_channel_name} (${channel.logistics_channel_id}) - PESO fora: ${peso}kg vs min=${channel.weight_limit.item_min_weight}, max=${channel.weight_limit.item_max_weight}`);
        skipped = true;
      }
    }

    // Verifica se o produto está dentro dos limites de dimensão
    if (!skipped && channel.item_max_dimension) {
      if (dimensoes.comprimento > channel.item_max_dimension.length ||
          dimensoes.largura > channel.item_max_dimension.width ||
          dimensoes.altura > channel.item_max_dimension.height) {
        console.log(`[buildLogisticInfo] Canal ${channel.logistics_channel_name} (${channel.logistics_channel_id}) - DIMENSAO fora: ${JSON.stringify(dimensoes)} vs max=${JSON.stringify(channel.item_max_dimension)}`);
        skipped = true;
      }
    }

    if (skipped) continue;

    // Adiciona o canal à lista
    const info: LogisticsInfo = {
      logistic_id: channel.logistics_channel_id,
      enabled: true,
    };

    // Se o canal tem tamanhos, seleciona o primeiro disponível
    if (channel.size_list && channel.size_list.length > 0) {
      info.size_id = channel.size_list[0].size_id;
    }

    logisticInfo.push(info);
    console.log(`[buildLogisticInfo] Canal ${channel.logistics_channel_name} (${channel.logistics_channel_id}) - OK`);
  }

  if (logisticInfo.length === 0) {
    throw new Error(`Nenhum canal de logística compatível com peso=${peso}kg e dimensões=${dimensoes.comprimento}x${dimensoes.largura}x${dimensoes.altura}cm. Total canais habilitados: ${enabledChannels.length}`);
  }
  
  return logisticInfo;
}

/**
 * Força atualização do cache de logística
 */
export async function forceRefreshLogistics(shopId: number): Promise<LogisticsChannel[]> {
  return getLogisticsChannels(shopId, true);
}
