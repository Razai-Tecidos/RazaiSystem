import { callShopeeApi, ensureValidToken } from './shopee.service';

/**
 * Limites de item retornados pela API Shopee
 */
export interface ItemLimit {
  // Limites de preço
  price_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Limites de estoque
  stock_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Limites de nome do item
  item_name_length_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Limites de descrição
  item_description_length_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Limites de imagens
  item_image_count_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Limites de variações
  tier_variation_option_length_limit: {
    min_limit: number;
    max_limit: number;
  };
  // Suporte a size chart
  size_chart_supported: boolean;
  // Suporte a extended description (descrição com imagens)
  extended_description_limit?: {
    description_text_length_limit: number;
    description_image_num_limit: number;
  };
  // Limites de dias para envio
  dts_limit?: {
    non_pre_order_dts_limit: number;
    pre_order_dts_limit: {
      min_limit: number;
      max_limit: number;
    };
  };
  // Limites de wholesale
  wholesale_limit?: {
    min_count: number;
    max_count: number;
    min_unit_count: number;
    max_unit_count: number;
  };
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
 */
export async function isSizeChartSupported(shopId: number, categoryId: number): Promise<boolean> {
  const limits = await getItemLimit(shopId, categoryId);
  return limits?.size_chart_supported || false;
}

/**
 * Busca limites de DTS (Days to Ship)
 */
export async function getDtsLimits(shopId: number, categoryId: number): Promise<{
  nonPreOrder: number;
  preOrderMin: number;
  preOrderMax: number;
} | null> {
  const limits = await getItemLimit(shopId, categoryId);
  
  if (!limits?.dts_limit) {
    // Valores padrão se não disponível
    return {
      nonPreOrder: 2,
      preOrderMin: 7,
      preOrderMax: 30,
    };
  }
  
  return {
    nonPreOrder: limits.dts_limit.non_pre_order_dts_limit,
    preOrderMin: limits.dts_limit.pre_order_dts_limit.min_limit,
    preOrderMax: limits.dts_limit.pre_order_dts_limit.max_limit,
  };
}

/**
 * Busca size charts disponíveis para a loja
 */
export async function getSizeCharts(
  shopId: number,
  categoryId: number,
  pageSize: number = 50,
  cursor?: string
): Promise<Array<{
  size_chart_id: number;
  size_chart_name: string;
  name: string;
}>> {
  try {
    const accessToken = await ensureValidToken(shopId);
    
    // Nota: Este endpoint pode não existir em todas as regiões
    // A Shopee pode exigir que size charts sejam criados no Seller Center
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
      response?: {
        size_chart_list: Array<{
          size_chart_id: number;
          size_chart_name?: string;
          name?: string;
        }>;
      };
    };
    
    if (response.error) {
      console.warn('Size chart list não disponível:', response.error);
      return [];
    }
    
    return (response.response?.size_chart_list || []).map((item) => {
      const resolvedName = item.name || item.size_chart_name || `Size Chart #${item.size_chart_id}`;
      return {
        size_chart_id: item.size_chart_id,
        size_chart_name: item.size_chart_name || resolvedName,
        name: resolvedName,
      };
    });
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
