import { callShopeeApi, ensureValidToken } from './shopee.service';

/**
 * Limites de item retornados pela API Shopee (formato real da API v2)
 */
export interface ItemLimit {
  price_limit?: { min_limit: number; max_limit: number };
  stock_limit?: { min_limit: number; max_limit: number };
  item_name_length_limit?: { min_limit: number; max_limit: number };
  item_description_length_limit?: { min_limit: number; max_limit: number };
  item_image_count_limit?: { min_limit: number; max_limit: number };
  tier_variation_option_length_limit?: { min_limit: number; max_limit: number };
  // Campo real da API (NAO e "size_chart_supported")
  size_chart_limit?: {
    size_chart_mandatory: boolean;
    support_image_size_chart: boolean;
    support_template_size_chart: boolean;
  };
  extended_description_limit?: Record<string, number>;
  dts_limit?: {
    non_pre_order_days_to_ship: number;
    support_pre_order: boolean;
  };
  weight_limit?: { weight_mandatory: boolean };
  dimension_limit?: { dimension_mandatory: boolean };
  // Qualquer outro campo da API
  [key: string]: unknown;
}

/**
 * Busca limites de item para uma categoria
 */
export async function getItemLimit(shopId: number, categoryId: number): Promise<ItemLimit | null> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    const response = await callShopeeApi({
      path: '/api/v2/product/get_item_limit',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        category_id: categoryId,
      },
    }) as {
      error?: string;
      message?: string;
      response?: ItemLimit;
    };
    
    if (response.error) {
      console.error(`Erro ao buscar limites: ${response.error} - ${response.message}`);
      return null;
    }
    
    return response.response || null;
  } catch (error: any) {
    console.error('Erro ao buscar limites de item:', error.message);
    return null;
  }
}

/**
 * Verifica se size chart é suportado para uma categoria
 * Campo real da API: size_chart_limit.support_image_size_chart ou support_template_size_chart
 */
export async function isSizeChartSupported(shopId: number, categoryId: number): Promise<boolean> {
  const limits = await getItemLimit(shopId, categoryId);
  if (!limits) return false;
  const scl = limits.size_chart_limit;
  if (scl) {
    return scl.support_image_size_chart || scl.support_template_size_chart;
  }
  return false;
}

/**
 * Busca limites de DTS (Days to Ship)
 * Formato real da API: dts_limit.non_pre_order_days_to_ship, dts_limit.support_pre_order
 */
export async function getDtsLimits(shopId: number, categoryId: number): Promise<{
  nonPreOrder: number;
  preOrderMin: number;
  preOrderMax: number;
} | null> {
  const limits = await getItemLimit(shopId, categoryId);

  if (!limits?.dts_limit) {
    return {
      nonPreOrder: 2,
      preOrderMin: 7,
      preOrderMax: 30,
    };
  }

  return {
    nonPreOrder: limits.dts_limit.non_pre_order_days_to_ship || 2,
    preOrderMin: 7,
    preOrderMax: 30,
  };
}

/**
 * Busca size charts disponíveis para a loja.
 * A API get_size_chart_list retorna APENAS size_chart_id (sem nome).
 */
export async function getSizeCharts(
  shopId: number,
  categoryId: number,
  pageSize: number = 50,
  cursor?: string
): Promise<Array<{
  size_chart_id: number;
}>> {
  try {
    const accessToken = await ensureValidToken(shopId);

    const response = await callShopeeApi({
      path: '/api/v2/product/get_size_chart_list',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        category_id: categoryId,
        page_size: pageSize,
        ...(cursor ? { cursor } : {}),
      },
    }) as {
      error?: string;
      message?: string;
      response?: {
        size_chart_list: Array<{ size_chart_id: number }>;
        total_count: number;
        next_cursor: string;
      };
    };

    if (response.error) {
      console.warn('Size chart list não disponível:', response.error, response.message);
      return [];
    }

    return (response.response?.size_chart_list || []).map((item) => ({
      size_chart_id: item.size_chart_id,
    }));
  } catch (error: any) {
    console.warn('Erro ao buscar size charts:', error.message);
    return [];
  }
}

/**
 * Verifica se a categoria suporta size chart
 * Baseado em get_item_limit.size_chart_supported
 */
export async function checkSizeChartSupport(shopId: number, categoryId: number): Promise<{
  supported: boolean;
  sizeChartType?: string;
}> {
  const supported = await isSizeChartSupported(shopId, categoryId);
  return {
    supported,
    sizeChartType: undefined,
  };
}
