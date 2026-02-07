// Shopee Routes - v2 with seller_stock format
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import admin from '../config/firebase';
import {
  getAuthUrl,
  getAccessToken,
  saveShopTokens,
  disconnectShop,
  getShopConnectionStatus,
  getConnectedShops,
  ensureValidToken,
  callShopeeApi,
  getEscrowList,
  getEscrowDetailBatch,
  getIncomeOverview,
  getOrderList,
  getOrderDetailBatch,
  updatePrice,
  getItemPriceInfo,
} from '../services/shopee.service';

const router = Router();
const db = admin.firestore();
const DISABLED_COLORS_COLLECTION = 'disabled_colors';

/**
 * GET /api/shopee/auth-url
 * Gera URL de autorizacao para conectar loja Shopee
 */
router.get('/auth-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUrl = getAuthUrl();

    return res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error: any) {
    console.error('Erro ao gerar auth URL:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar URL de autorizacao',
    });
  }
});

/**
 * POST /api/shopee/callback
 * Recebe o codigo de autorizacao e troca por tokens
 */
router.post('/callback', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, shop_id } = req.body;

    if (!code || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'code e shop_id sao obrigatorios',
      });
    }

    const shopId = parseInt(shop_id, 10);
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
    }

    const tokenResponse = await getAccessToken(code, shopId);

    await saveShopTokens(
      shopId,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      tokenResponse.expire_in,
      userId
    );

    return res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja conectada com sucesso!',
      },
    });
  } catch (error: any) {
    console.error('Erro no callback Shopee:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar autorizacao',
    });
  }
});

/**
 * GET /api/shopee/status
 * Verifica status de conexao das lojas
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id } = req.query;

    const shopId = shop_id ? parseInt(shop_id as string, 10) : undefined;
    const status = await getShopConnectionStatus(shopId);

    const sanitizedStatus = {
      connected: status.connected,
      shop: status.shop ? {
        shopId: status.shop.shopId,
        shopName: status.shop.shopName,
        connectedAt: status.shop.connectedAt,
        tokenExpiresAt: status.shop.tokenExpiresAt,
      } : undefined,
      shops: status.shops?.map(shop => ({
        shopId: shop.shopId,
        shopName: shop.shopName,
        connectedAt: shop.connectedAt,
        tokenExpiresAt: shop.tokenExpiresAt,
      })),
    };

    return res.json({
      success: true,
      data: sanitizedStatus,
    });
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao verificar status',
    });
  }
});

/**
 * GET /api/shopee/shops
 * Lista todas as lojas conectadas
 */
router.get('/shops', authMiddleware, async (req: Request, res: Response) => {
  try {
    const shops = await getConnectedShops();

    const sanitizedShops = shops.map(shop => ({
      shopId: shop.shopId,
      shopName: shop.shopName,
      connectedAt: shop.connectedAt,
      connectedBy: shop.connectedBy,
      tokenExpiresAt: shop.tokenExpiresAt,
    }));

    return res.json({
      success: true,
      data: { shops: sanitizedShops },
    });
  } catch (error: any) {
    console.error('Erro ao listar lojas:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar lojas',
    });
  }
});

/**
 * POST /api/shopee/disconnect
 * Desconecta uma loja
 */
router.post('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id } = req.body;

    if (!shop_id) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e obrigatorio',
      });
    }

    const shopId = parseInt(shop_id, 10);

    await disconnectShop(shopId);

    return res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja desconectada com sucesso!',
      },
    });
  } catch (error: any) {
    console.error('Erro ao desconectar loja:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao desconectar loja',
    });
  }
});

/**
 * POST /api/shopee/proxy
 * Faz chamada assinada para endpoints Shopee
 */
router.post('/proxy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { path, method, query, body, shop_id } = req.body as {
      path?: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      query?: Record<string, string | number | boolean>;
      body?: Record<string, unknown>;
      shop_id?: number | string;
    };

    if (!path || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'path e shop_id sao obrigatorios',
      });
    }

    const normalizedPath = path.startsWith('http')
      ? new URL(path).pathname
      : path;

    if (!normalizedPath.startsWith('/api/v2/')) {
      return res.status(400).json({
        success: false,
        error: 'Apenas endpoints /api/v2/ sao permitidos',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;

    const accessToken = await ensureValidToken(shopId);

    const data = await callShopeeApi({
      path: normalizedPath,
      method,
      shopId,
      accessToken,
      query,
      body,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Erro no proxy Shopee:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message || 'Erro ao chamar Shopee',
    });
  }
});

/**
 * POST /api/shopee/inventory
 * Agrega lista de itens, detalhes e modelos
 */
router.post('/inventory', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, page_size, offset } = req.body as {
      shop_id?: number | string;
      page_size?: number;
      offset?: number;
    };

    if (!shop_id) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e obrigatorio',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    const accessToken = await ensureValidToken(shopId);

    const listData = await callShopeeApi({
      path: '/api/v2/product/get_item_list',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        item_status: 'NORMAL',
        offset: offset || 0,
        page_size: page_size || 50,
      },
    }) as any;

    const itemList = listData?.response?.item || [];
    const statusMap = new Map<string, string>();
    const itemIds = itemList
      .map((item: any) => {
        if (item?.item_id) {
          statusMap.set(String(item.item_id), item.item_status || '');
        }
        return item?.item_id;
      })
      .filter((id: any) => typeof id === 'number' || typeof id === 'string')
      .map((id: any) => String(id));

    if (itemIds.length === 0) {
      return res.json({
        success: true,
        data: { items: [] },
      });
    }

    const chunkSize = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < itemIds.length; i += chunkSize) {
      chunks.push(itemIds.slice(i, i + chunkSize));
    }

    const baseInfoMap = new Map<string, { item_name?: string; item_sku?: string }>();
    for (const chunk of chunks) {
      const baseInfoData = await callShopeeApi({
        path: '/api/v2/product/get_item_base_info',
        method: 'GET',
        shopId,
        accessToken,
        query: {
          item_id_list: chunk.join(','),
        },
      }) as any;

      const baseItems = baseInfoData?.response?.item_list || [];
      baseItems.forEach((item: any) => {
        if (!item?.item_id) return;
        baseInfoMap.set(String(item.item_id), {
          item_name: item.item_name,
          item_sku: item.item_sku,
        });
      });
    }

    const items = [];
    for (const itemId of itemIds) {
      const modelData = await callShopeeApi({
        path: '/api/v2/product/get_model_list',
        method: 'GET',
        shopId,
        accessToken,
        query: {
          item_id: itemId,
        },
      }) as any;

      // Log da resposta completa da Shopee para debug
      const modelsWithUnavailable = (modelData?.response?.model || []).filter((m: any) => m?.model_status === 'UNAVAILABLE');
      if (modelsWithUnavailable.length > 0) {
        console.log(`[Inventory] Item ${itemId} tem ${modelsWithUnavailable.length} modelos UNAVAILABLE:`, {
          item_id: itemId,
          unavailable_models: modelsWithUnavailable.map((m: any) => ({
            model_id: m?.model_id,
            model_status: m?.model_status,
            model_name: m?.model_name,
          })),
          full_response_sample: modelData?.response?.model?.[0] ? {
            model_id: modelData.response.model[0].model_id,
            model_status: modelData.response.model[0].model_status,
            model_name: modelData.response.model[0].model_name,
            all_fields: Object.keys(modelData.response.model[0]),
          } : null,
        });
      }

      const tierVariation = modelData?.response?.tier_variation || [];
      const optionList = tierVariation?.[0]?.option_list || [];
      const options = optionList.map((option: any) => option?.option).filter(Boolean);

      const models = (modelData?.response?.model || []).map((model: any) => {
        const rawName = model?.model_name || '';
        const modelName = String(rawName).split(',')[0].trim();
        const tierIndex = Array.isArray(model?.tier_index) ? model.tier_index : [];
        const colorOptionIndex = typeof tierIndex[0] === 'number' ? tierIndex[0] : null;
        const colorOption = colorOptionIndex !== null ? options[colorOptionIndex] : null;
        const modelStatus = model?.model_status || 'NORMAL';
        
        // Log detalhado para debug
        console.log(`[Inventory] Item ${itemId}, Model ${model?.model_id}:`, {
          model_id: model?.model_id,
          model_name: modelName,
          model_status: modelStatus,
          raw_model_status: model?.model_status,
          color_option: colorOption,
          tier_index: tierIndex,
        });
        
        return {
          model_id: model?.model_id,
          model_name: modelName,
          model_status: modelStatus,
          total_available_stock: model?.stock_info_v2?.summary_info?.total_available_stock ?? null,
          color_option: colorOption,
        };
      });

      const baseInfo = baseInfoMap.get(itemId);
      items.push({
        item_id: itemId,
        item_status: statusMap.get(itemId) || '',
        item_name: baseInfo?.item_name || '',
        item_sku: baseInfo?.item_sku || '',
        variation_options: options,
        models,
      });
    }

    return res.json({
      success: true,
      data: { items },
    });
  } catch (error: any) {
    console.error('Erro ao agregar inventario Shopee:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message || 'Erro ao buscar inventario Shopee',
    });
  }
});

/**
 * Zera estoque para modelos específicos
 */
async function zeroStockForModels(
  shopId: number,
  accessToken: string,
  targets: Array<{ item_id: number | string; model_ids: Array<number | string> }>
): Promise<{ zeroed: number[]; alreadyZero: number[] }> {
  const result = { zeroed: [] as number[], alreadyZero: [] as number[] };
  
  for (const target of targets) {
    const itemId = typeof target.item_id === 'string' ? parseInt(target.item_id, 10) : target.item_id;
    
    try {
      // Verificar estoque atual antes de zerar (otimização)
      const modelData = await callShopeeApi({
        path: '/api/v2/product/get_model_list',
        method: 'GET',
        shopId,
        accessToken,
        query: {
          item_id: String(itemId),
        },
      }) as any;

      const models = modelData?.response?.model || [];
      const modelsToZero: Array<{ model_id: number; currentStock: number }> = [];

      // Verificar quais modelos realmente precisam ser zerados
      for (const modelIdRaw of target.model_ids) {
        const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
        const model = models.find((m: any) => m?.model_id === modelId);
        const currentStock = model?.stock_info_v2?.summary_info?.total_available_stock ?? 0;

        if (currentStock > 0) {
          modelsToZero.push({ model_id: modelId, currentStock });
        } else {
          console.log(`[ZeroStock] Modelo ${modelId} já está com estoque zerado (${currentStock})`);
          result.alreadyZero.push(modelId);
        }
      }

      // Se não há modelos para zerar, continua para o próximo target
      if (modelsToZero.length === 0) {
        console.log(`[ZeroStock] Todos os modelos do item ${itemId} já estão com estoque zerado`);
        continue;
      }

      console.log(`[ZeroStock] Zerando estoque para ${modelsToZero.length} modelo(s) do item ${itemId}`);

      // Zerar apenas os modelos que precisam
      const stockResponse = await callShopeeApi({
        path: '/api/v2/product/update_stock',
        method: 'POST',
        shopId,
        accessToken,
        body: {
          item_id: itemId,
          stock_list: modelsToZero.map(({ model_id }) => ({
            model_id,
            stock: 0,
          })),
        },
      }) as any;

      if (stockResponse?.error) {
        console.error(`[ZeroStock] Erro ao zerar estoque para item ${itemId}:`, stockResponse);
        throw new Error(`Erro ao zerar estoque: ${stockResponse.error}`);
      }

      // Adicionar modelos zerados ao resultado
      modelsToZero.forEach(m => result.zeroed.push(m.model_id));

      console.log(`[ZeroStock] Estoque zerado com sucesso para item ${itemId}: ${modelsToZero.map(m => `${m.model_id}(${m.currentStock}→0)`).join(', ')}`);
    } catch (error: any) {
      console.error(`[ZeroStock] Erro ao processar item ${itemId}:`, error);
      throw error;
    }
  }
  
  return result;
}

/**
 * Salva estado de cor desativada no Firestore
 */
async function saveDisabledColor(
  shopId: number,
  itemSku: string,
  colorOption: string,
  itemIds: string[],
  modelIds: number[],
  userId: string
): Promise<void> {
  const docId = `${shopId}_${itemSku}_${colorOption}`.replace(/[^a-zA-Z0-9_]/g, '_');
  const now = admin.firestore.Timestamp.now();

  await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).set({
    shop_id: shopId,
    item_sku: itemSku,
    color_option: colorOption,
    item_ids: itemIds,
    model_ids: modelIds,
    disabled_at: now,
    disabled_by: userId,
    last_maintained: now,
  }, { merge: true });

  console.log(`[DisabledColor] Salvo estado para SKU ${itemSku}, cor ${colorOption}`);
}

/**
 * Remove estado de cor desativada do Firestore
 */
async function removeDisabledColor(
  shopId: number,
  itemSku: string,
  colorOption: string
): Promise<void> {
  const docId = `${shopId}_${itemSku}_${colorOption}`.replace(/[^a-zA-Z0-9_]/g, '_');
  
  await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).delete();
  
  console.log(`[DisabledColor] Removido estado para SKU ${itemSku}, cor ${colorOption}`);
}

/**
 * POST /api/shopee/update-color-availability
 * Atualiza status e estoque (opcional) para um conjunto de modelos
 */
router.post('/update-color-availability', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, item_id, model_ids, model_status, stock, targets, item_sku, color_option } = req.body as {
      shop_id?: number | string;
      item_id?: number | string;
      model_ids?: Array<number | string>;
      model_status?: 'UNAVAILABLE' | 'NORMAL';
      stock?: number;
      targets?: Array<{
        item_id: number | string;
        model_ids: Array<number | string>;
      }>;
      item_sku?: string;
      color_option?: string;
    };

    if (!shop_id || !model_status || (!targets && (!item_id || !model_ids?.length))) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, model_status e targets (ou item_id + model_ids) são obrigatórios',
      });
    }

    if (!['UNAVAILABLE', 'NORMAL'].includes(model_status)) {
      return res.status(400).json({
        success: false,
        error: 'model_status inválido',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    const accessToken = await ensureValidToken(shopId);
    const userId = req.user?.uid || '';

    const targetList = targets && targets.length
      ? targets
      : [{
          item_id: item_id as number | string,
          model_ids: model_ids as Array<number | string>,
        }];

    const results: Array<{ item_id: number; model_id: number; response: any }> = [];
    const allItemIds = targetList.map(t => String(t.item_id));
    const allModelIds = targetList.flatMap(t => t.model_ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id));

    // Buscar informações de SKU se não foram fornecidas
    let finalItemSku = item_sku;
    let finalColorOption = color_option;
    
    if (!finalItemSku || !finalColorOption) {
      // Buscar do primeiro item para obter SKU e color_option
      if (targetList.length > 0 && targetList[0].model_ids.length > 0) {
        const firstItemId = typeof targetList[0].item_id === 'string' 
          ? parseInt(targetList[0].item_id, 10) 
          : targetList[0].item_id;
        const firstModelId = typeof targetList[0].model_ids[0] === 'string'
          ? parseInt(targetList[0].model_ids[0], 10)
          : targetList[0].model_ids[0];
        
        try {
          // Buscar SKU
          if (!finalItemSku) {
            const baseInfoData = await callShopeeApi({
              path: '/api/v2/product/get_item_base_info',
              method: 'GET',
              shopId,
              accessToken,
              query: {
                item_id_list: String(firstItemId),
              },
            }) as any;

            const itemInfo = baseInfoData?.response?.item_list?.[0];
            if (itemInfo) {
              finalItemSku = itemInfo.item_sku || 'Sem SKU';
            }
          }

          // Buscar color_option do modelo
          if (!finalColorOption) {
            const modelData = await callShopeeApi({
              path: '/api/v2/product/get_model_list',
              method: 'GET',
              shopId,
              accessToken,
              query: {
                item_id: String(firstItemId),
              },
            }) as any;

            const tierVariation = modelData?.response?.tier_variation || [];
            const optionList = tierVariation?.[0]?.option_list || [];
            const options = optionList.map((option: any) => option?.option).filter(Boolean);

            const model = (modelData?.response?.model || []).find((m: any) => m?.model_id === firstModelId);
            if (model) {
              const tierIndex = Array.isArray(model?.tier_index) ? model.tier_index : [];
              const colorOptionIndex = typeof tierIndex[0] === 'number' ? tierIndex[0] : null;
              if (colorOptionIndex !== null && options[colorOptionIndex]) {
                finalColorOption = options[colorOptionIndex];
              }
            }
          }
        } catch (error) {
          console.warn('[UpdateColor] Erro ao buscar SKU/color:', error);
        }
      }
    }

    // Não tentamos mais atualizar model_status, apenas controlamos estoque
    // A Shopee não suporta model_status para todos os tipos de vendedores
    // Usamos apenas estoque = 0 para indicar "desativado"
    
    for (const target of targetList) {
      const itemId = typeof target.item_id === 'string' ? parseInt(target.item_id, 10) : target.item_id;

      // Zerar estoque quando desativa (UNAVAILABLE)
      if (model_status === 'UNAVAILABLE') {
        try {
          const zeroResult = await zeroStockForModels(shopId, accessToken, [target]);
          console.log(`[UpdateColor] Estoque processado para item ${itemId}:`, zeroResult);
          
          // Adiciona resultado de sucesso para cada modelo
          for (const modelIdRaw of target.model_ids) {
            const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
            const wasZeroed = zeroResult.zeroed.includes(modelId);
            const wasAlreadyZero = zeroResult.alreadyZero.includes(modelId);
            
            results.push({ 
              item_id: itemId, 
              model_id: modelId, 
              response: { 
                success: true, 
                message: wasZeroed ? 'Estoque zerado' : (wasAlreadyZero ? 'Estoque já estava zerado' : 'Processado')
              } 
            });
          }
        } catch (error: any) {
          console.error(`[UpdateColor] Erro ao zerar estoque:`, error);
          // Adiciona resultado de erro para cada modelo
          for (const modelIdRaw of target.model_ids) {
            const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
            results.push({ 
              item_id: itemId, 
              model_id: modelId, 
              response: { error: error.message || 'Erro ao zerar estoque' } 
            });
          }
          // Não falha a operação se zerar estoque falhar, apenas loga
        }
      }

      // Atualizar estoque quando ativa (NORMAL)
      if (model_status === 'NORMAL' && typeof stock === 'number') {
        try {
          const stockResponse = await callShopeeApi({
            path: '/api/v2/product/update_stock',
            method: 'POST',
            shopId,
            accessToken,
            body: {
              item_id: itemId,
              stock_list: target.model_ids.map(modelIdRaw => ({
                model_id: typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw,
                stock,
              })),
            },
          }) as any;

          if (stockResponse?.error) {
            // Adiciona resultado de erro para cada modelo
            for (const modelIdRaw of target.model_ids) {
              const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
              results.push({ 
                item_id: itemId, 
                model_id: modelId, 
                response: { error: stockResponse.error } 
              });
            }
            return res.status(500).json({
              success: false,
              error: stockResponse,
            });
          }

          // Adiciona resultado de sucesso para cada modelo
          for (const modelIdRaw of target.model_ids) {
            const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
            results.push({ 
              item_id: itemId, 
              model_id: modelId, 
              response: { success: true, message: `Estoque atualizado para ${stock}` } 
            });
          }
        } catch (error: any) {
          console.error(`[UpdateColor] Erro ao atualizar estoque:`, error);
          // Adiciona resultado de erro para cada modelo
          for (const modelIdRaw of target.model_ids) {
            const modelId = typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw;
            results.push({ 
              item_id: itemId, 
              model_id: modelId, 
              response: { error: error.message || 'Erro ao atualizar estoque' } 
            });
          }
          return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao atualizar estoque',
          });
        }
      }
    }

    // Salvar ou remover estado no Firestore
    if (finalItemSku && finalColorOption) {
      try {
        if (model_status === 'UNAVAILABLE') {
          await saveDisabledColor(
            shopId,
            finalItemSku,
            finalColorOption,
            allItemIds,
            allModelIds,
            userId
          );
        } else if (model_status === 'NORMAL') {
          await removeDisabledColor(shopId, finalItemSku, finalColorOption);
        }
      } catch (error: any) {
        console.error('[UpdateColor] Erro ao salvar/remover estado:', error);
        // Não falha a operação se salvar estado falhar
      }
    }

    return res.json({
      success: true,
      data: { results },
      // Não usamos mais model_status, apenas controle de estoque
      stockBased: true,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar disponibilidade por cor:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message || 'Erro ao atualizar disponibilidade',
    });
  }
});

/**
 * POST /api/shopee/update-stock
 * Endpoint simplificado para controle de estoque
 * - action: 'zero' = zera estoque e salva no Firestore para monitoramento via webhook
 * - action: 'restore' = restaura estoque e remove do Firestore
 */
router.post('/update-stock', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, targets, action, stock, item_sku, color_option } = req.body as {
      shop_id: number | string;
      targets: Array<{ item_id: string; model_ids: Array<string | number> }>;
      action: 'zero' | 'restore';
      stock?: number;
      item_sku: string;
      color_option: string;
    };

    // Validação
    if (!shop_id || !targets?.length || !action || !item_sku || !color_option) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, targets, action, item_sku e color_option são obrigatórios',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    const accessToken = await ensureValidToken(shopId);
    const userId = req.user?.uid || '';
    const newStock = action === 'zero' ? 0 : (stock || 500);

    console.log(`[UpdateStock] Ação: ${action}, SKU: ${item_sku}, Cor: ${color_option}, Stock: ${newStock}`);

    // Atualizar estoque na Shopee
    const results: Array<{ item_id: number; model_id: number; success: boolean; error?: string }> = [];
    
    for (const target of targets) {
      const itemId = typeof target.item_id === 'string' ? parseInt(target.item_id, 10) : target.item_id;
      
      try {
        // Monta stock_list com seller_stock (campo correto para a API v2)
        const stockList = target.model_ids.map(modelIdRaw => ({
          model_id: typeof modelIdRaw === 'string' ? parseInt(modelIdRaw, 10) : modelIdRaw,
          seller_stock: [{ stock: newStock }],
        }));

        console.log(`[UpdateStock] Enviando para item ${itemId}:`, JSON.stringify({ item_id: itemId, stock_list: stockList }));

        const stockResponse = await callShopeeApi({
          path: '/api/v2/product/update_stock',
          method: 'POST',
          shopId,
          accessToken,
          body: {
            item_id: itemId,
            stock_list: stockList,
          },
        }) as any;

        console.log(`[UpdateStock] Resposta Shopee item ${itemId}:`, JSON.stringify(stockResponse));

        if (stockResponse?.error) {
          console.error(`[UpdateStock] Erro item ${itemId}:`, stockResponse);
          for (const modelId of target.model_ids) {
            results.push({ 
              item_id: itemId, 
              model_id: typeof modelId === 'string' ? parseInt(modelId, 10) : modelId,
              success: false,
              error: stockResponse.error || stockResponse.message,
            });
          }
        } else {
          console.log(`[UpdateStock] Sucesso item ${itemId}, stock → ${newStock}`);
          for (const modelId of target.model_ids) {
            results.push({ 
              item_id: itemId, 
              model_id: typeof modelId === 'string' ? parseInt(modelId, 10) : modelId,
              success: true,
            });
          }
        }
      } catch (error: any) {
        console.error(`[UpdateStock] Erro catch item ${itemId}:`, error.message, error.response?.data);
        for (const modelId of target.model_ids) {
          results.push({ 
            item_id: itemId, 
            model_id: typeof modelId === 'string' ? parseInt(modelId, 10) : modelId,
            success: false,
            error: error.response?.data?.error || error.response?.data?.message || error.message,
          });
        }
      }
    }

    // Salvar/remover do Firestore para monitoramento via webhook
    const allItemIds = targets.map(t => t.item_id);
    const allModelIds = targets.flatMap(t => 
      t.model_ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
    );

    try {
      if (action === 'zero') {
        await saveDisabledColor(shopId, item_sku, color_option, allItemIds, allModelIds, userId);
        console.log(`[UpdateStock] Cor ${color_option} salva para monitoramento`);
      } else {
        await removeDisabledColor(shopId, item_sku, color_option);
        console.log(`[UpdateStock] Cor ${color_option} removida do monitoramento`);
      }
    } catch (error: any) {
      console.error('[UpdateStock] Erro ao salvar estado no Firestore:', error);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    // Considera sucesso se pelo menos um modelo foi atualizado
    const overallSuccess = successCount > 0;
    
    return res.json({
      success: overallSuccess,
      data: { 
        results,
        action,
        stock: newStock,
        monitored: action === 'zero',
        summary: {
          total: results.length,
          success: successCount,
          failed: errorCount,
        },
      },
      // Só inclui warning se houve erros parciais
      warning: errorCount > 0 && successCount > 0 ? `${errorCount} de ${results.length} modelos falharam` : undefined,
      error: successCount === 0 && errorCount > 0 ? 'Todos os modelos falharam' : undefined,
    });
  } catch (error: any) {
    console.error('[UpdateStock] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar estoque',
    });
  }
});

// ============================================================
// PAYMENT API - Dados financeiros
// ============================================================

/**
 * GET /api/shopee/payment/income-overview
 * Busca visão geral de receita em um período
 */
router.get('/payment/income-overview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, release_time_from, release_time_to } = req.query;

    if (!shop_id || !release_time_from || !release_time_to) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, release_time_from e release_time_to são obrigatórios',
      });
    }

    const shopId = parseInt(shop_id as string, 10);
    const timeFrom = parseInt(release_time_from as string, 10);
    const timeTo = parseInt(release_time_to as string, 10);

    const overview = await getIncomeOverview(shopId, timeFrom, timeTo);

    if (!overview) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar visão geral de receita',
      });
    }

    return res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    console.error('Erro ao buscar income overview:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar visão geral de receita',
    });
  }
});

/**
 * GET /api/shopee/payment/escrow-list
 * Busca lista de escrows em um período
 */
router.get('/payment/escrow-list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, release_time_from, release_time_to, page_size, cursor } = req.query;

    if (!shop_id || !release_time_from || !release_time_to) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, release_time_from e release_time_to são obrigatórios',
      });
    }

    const shopId = parseInt(shop_id as string, 10);
    const timeFrom = parseInt(release_time_from as string, 10);
    const timeTo = parseInt(release_time_to as string, 10);
    const pageSize = page_size ? parseInt(page_size as string, 10) : 100;

    const result = await getEscrowList(shopId, timeFrom, timeTo, pageSize, cursor as string || '');

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Erro ao buscar escrow list:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar lista de escrow',
    });
  }
});

/**
 * POST /api/shopee/payment/escrow-detail-batch
 * Busca detalhes de escrow em lote
 */
router.post('/payment/escrow-detail-batch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, order_sn_list } = req.body;

    if (!shop_id || !order_sn_list?.length) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e order_sn_list são obrigatórios',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;

    const details = await getEscrowDetailBatch(shopId, order_sn_list);

    return res.json({
      success: true,
      data: { orders: details },
    });
  } catch (error: any) {
    console.error('Erro ao buscar escrow detail batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar detalhes de escrow',
    });
  }
});

/**
 * POST /api/shopee/payment/collect-financial-data
 * Coleta dados financeiros de um período e agrega por SKU
 * Retorna receita líquida por SKU para cálculo de margem
 */
router.post('/payment/collect-financial-data', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, days_back = 30 } = req.body;

    if (!shop_id) {
      return res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    
    // Calcula período (últimos N dias)
    const now = Math.floor(Date.now() / 1000);
    const daysInSeconds = days_back * 24 * 60 * 60;
    const releaseTimeFrom = now - daysInSeconds;
    const releaseTimeTo = now;

    console.log(`[CollectFinancial] Buscando dados de ${days_back} dias para loja ${shopId}`);

    // 1. Buscar visão geral (pode falhar se API de Payment não estiver habilitada)
    let overview = null;
    try {
      overview = await getIncomeOverview(shopId, releaseTimeFrom, releaseTimeTo);
      console.log('[CollectFinancial] Overview:', overview);
    } catch (overviewError: any) {
      console.warn('[CollectFinancial] Não foi possível obter overview (API Payment pode não estar habilitada):', overviewError.message);
    }

    // 2. Buscar lista de escrows (com paginação) - pode falhar se API de Payment não estiver habilitada
    let allOrders: Array<{ order_sn: string; payout_time: number }> = [];
    
    try {
      let cursor = '';
      let hasMore = true;

      while (hasMore) {
        const escrowList = await getEscrowList(shopId, releaseTimeFrom, releaseTimeTo, 100, cursor);
        allOrders = [...allOrders, ...escrowList.orders];
        hasMore = escrowList.more;
        cursor = escrowList.nextCursor;

        // Limite de segurança
        if (allOrders.length > 1000) {
          console.log('[CollectFinancial] Limite de 1000 pedidos atingido');
          break;
        }
      }

      console.log(`[CollectFinancial] Total de pedidos encontrados: ${allOrders.length}`);
    } catch (escrowError: any) {
      console.warn('[CollectFinancial] Erro ao buscar escrow list:', escrowError.message);
      // Retorna dados parciais com aviso
      return res.json({
        success: true,
        data: {
          overview,
          period: { from: releaseTimeFrom, to: releaseTimeTo, days: days_back },
          orders_count: 0,
          sku_summary: [],
          warning: 'API de Payment não disponível. Verifique se as permissões estão habilitadas no Shopee Partner Center.',
        },
      });
    }

    if (allOrders.length === 0) {
      return res.json({
        success: true,
        data: {
          overview,
          period: { from: releaseTimeFrom, to: releaseTimeTo, days: days_back },
          orders_count: 0,
          sku_summary: {},
        },
      });
    }

    // 3. Buscar detalhes em batches de 50
    const batchSize = 50;
    const skuSummary: Record<string, {
      item_sku: string;
      total_quantity: number;
      total_revenue_gross: number;
      total_revenue_net: number; // escrow_amount
      total_commission_fee: number;
      total_service_fee: number;
      orders_count: number;
    }> = {};

    for (let i = 0; i < allOrders.length; i += batchSize) {
      const batch = allOrders.slice(i, i + batchSize);
      const orderSns = batch.map(o => o.order_sn);
      
      console.log(`[CollectFinancial] Buscando detalhes batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allOrders.length/batchSize)}`);
      
      const details = await getEscrowDetailBatch(shopId, orderSns);

      for (const order of details) {
        if (!order.order_income?.items) continue;

        for (const item of order.order_income.items) {
          const sku = item.item_sku || item.model_sku || 'SEM_SKU';
          
          if (!skuSummary[sku]) {
            skuSummary[sku] = {
              item_sku: sku,
              total_quantity: 0,
              total_revenue_gross: 0,
              total_revenue_net: 0,
              total_commission_fee: 0,
              total_service_fee: 0,
              orders_count: 0,
            };
          }

          skuSummary[sku].total_quantity += item.quantity_purchased || 0;
          skuSummary[sku].total_revenue_gross += (item.original_price || 0) * (item.quantity_purchased || 0);
          skuSummary[sku].total_revenue_net += item.escrow_amount_item_level || 0;
          skuSummary[sku].orders_count += 1;
        }

        // Taxas são por pedido, não por item - distribuir proporcionalmente
        const orderCommission = order.order_income.commission_fee || 0;
        const orderServiceFee = order.order_income.service_fee || 0;
        const itemCount = order.order_income.items.length;

        if (itemCount > 0) {
          const commissionPerItem = orderCommission / itemCount;
          const servicePerItem = orderServiceFee / itemCount;

          for (const item of order.order_income.items) {
            const sku = item.item_sku || item.model_sku || 'SEM_SKU';
            if (skuSummary[sku]) {
              skuSummary[sku].total_commission_fee += commissionPerItem;
              skuSummary[sku].total_service_fee += servicePerItem;
            }
          }
        }
      }

      // Delay entre batches para não sobrecarregar a API
      if (i + batchSize < allOrders.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calcular métricas derivadas
    const skuSummaryWithMetrics = Object.values(skuSummary).map(sku => ({
      ...sku,
      avg_price_gross: sku.total_quantity > 0 ? sku.total_revenue_gross / sku.total_quantity : 0,
      avg_price_net: sku.total_quantity > 0 ? sku.total_revenue_net / sku.total_quantity : 0,
      avg_fee_rate: sku.total_revenue_gross > 0 
        ? ((sku.total_commission_fee + sku.total_service_fee) / sku.total_revenue_gross) * 100 
        : 0,
    }));

    console.log(`[CollectFinancial] Dados agregados para ${skuSummaryWithMetrics.length} SKUs`);

    return res.json({
      success: true,
      data: {
        overview,
        period: { 
          from: releaseTimeFrom, 
          to: releaseTimeTo, 
          days: days_back,
          from_date: new Date(releaseTimeFrom * 1000).toISOString(),
          to_date: new Date(releaseTimeTo * 1000).toISOString(),
        },
        orders_count: allOrders.length,
        sku_summary: skuSummaryWithMetrics,
      },
    });
  } catch (error: any) {
    console.error('Erro ao coletar dados financeiros:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao coletar dados financeiros',
    });
  }
});

// ============================================================
// ORDER API - Histórico de pedidos
// ============================================================

/**
 * GET /api/shopee/orders/list
 * Busca lista de pedidos em um período
 */
router.get('/orders/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, time_from, time_to, time_range_field, order_status, page_size, cursor } = req.query;

    if (!shop_id || !time_from || !time_to) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, time_from e time_to são obrigatórios',
      });
    }

    const shopId = parseInt(shop_id as string, 10);
    const timeFrom = parseInt(time_from as string, 10);
    const timeTo = parseInt(time_to as string, 10);
    const pageSize = page_size ? parseInt(page_size as string, 10) : 100;
    const rangeField = (time_range_field as 'create_time' | 'update_time') || 'create_time';

    const result = await getOrderList(
      shopId,
      rangeField,
      timeFrom,
      timeTo,
      order_status as string,
      pageSize,
      cursor as string || ''
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Erro ao buscar order list:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar lista de pedidos',
    });
  }
});

/**
 * POST /api/shopee/orders/detail-batch
 * Busca detalhes de pedidos em lote
 */
router.post('/orders/detail-batch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, order_sn_list, response_optional_fields } = req.body;

    if (!shop_id || !order_sn_list?.length) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e order_sn_list são obrigatórios',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;

    const details = await getOrderDetailBatch(shopId, order_sn_list, response_optional_fields);

    return res.json({
      success: true,
      data: { orders: details },
    });
  } catch (error: any) {
    console.error('Erro ao buscar order detail batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar detalhes de pedidos',
    });
  }
});

/**
 * POST /api/shopee/orders/collect-sales-data
 * Coleta dados de vendas de um período e agrega por SKU
 * Retorna quantidade vendida, preço médio, etc. por SKU
 */
router.post('/orders/collect-sales-data', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, days_back = 30 } = req.body;

    if (!shop_id) {
      return res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    
    // Calcula período (últimos N dias)
    const now = Math.floor(Date.now() / 1000);
    const daysInSeconds = days_back * 24 * 60 * 60;
    const timeFrom = now - daysInSeconds;
    const timeTo = now;

    console.log(`[CollectSales] Buscando pedidos de ${days_back} dias para loja ${shopId}`);

    // Buscar apenas pedidos concluídos (COMPLETED)
    let allOrders: Array<{ order_sn: string }> = [];
    let cursor = '';
    let hasMore = true;

    while (hasMore) {
      const orderList = await getOrderList(
        shopId,
        'create_time',
        timeFrom,
        timeTo,
        'COMPLETED',
        100,
        cursor
      );
      
      allOrders = [...allOrders, ...orderList.orders];
      hasMore = orderList.more;
      cursor = orderList.nextCursor;

      // Limite de segurança
      if (allOrders.length > 1000) {
        console.log('[CollectSales] Limite de 1000 pedidos atingido');
        break;
      }
    }

    console.log(`[CollectSales] Total de pedidos encontrados: ${allOrders.length}`);

    if (allOrders.length === 0) {
      return res.json({
        success: true,
        data: {
          period: { from: timeFrom, to: timeTo, days: days_back },
          orders_count: 0,
          sku_summary: [],
        },
      });
    }

    // Buscar detalhes em batches de 50
    const batchSize = 50;
    const skuSummary: Record<string, {
      item_sku: string;
      item_name: string;
      total_quantity: number;
      total_revenue: number;
      avg_price: number;
      orders_count: number;
      min_price: number;
      max_price: number;
    }> = {};

    for (let i = 0; i < allOrders.length; i += batchSize) {
      const batch = allOrders.slice(i, i + batchSize);
      const orderSns = batch.map(o => o.order_sn);
      
      console.log(`[CollectSales] Buscando detalhes batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allOrders.length/batchSize)}`);
      
      const details = await getOrderDetailBatch(shopId, orderSns);

      for (const order of details) {
        if (!order.item_list) continue;

        for (const item of order.item_list) {
          const sku = item.item_sku || item.model_sku || 'SEM_SKU';
          const price = item.model_discounted_price || item.model_original_price || 0;
          const qty = item.model_quantity_purchased || 0;
          
          if (!skuSummary[sku]) {
            skuSummary[sku] = {
              item_sku: sku,
              item_name: item.item_name || '',
              total_quantity: 0,
              total_revenue: 0,
              avg_price: 0,
              orders_count: 0,
              min_price: price,
              max_price: price,
            };
          }

          skuSummary[sku].total_quantity += qty;
          skuSummary[sku].total_revenue += price * qty;
          skuSummary[sku].orders_count += 1;
          
          if (price > 0) {
            skuSummary[sku].min_price = Math.min(skuSummary[sku].min_price, price);
            skuSummary[sku].max_price = Math.max(skuSummary[sku].max_price, price);
          }
        }
      }

      // Delay entre batches
      if (i + batchSize < allOrders.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calcular preço médio
    const skuSummaryWithAvg = Object.values(skuSummary).map(sku => ({
      ...sku,
      avg_price: sku.total_quantity > 0 ? sku.total_revenue / sku.total_quantity : 0,
    }));

    // Ordenar por quantidade vendida
    skuSummaryWithAvg.sort((a, b) => b.total_quantity - a.total_quantity);

    console.log(`[CollectSales] Dados agregados para ${skuSummaryWithAvg.length} SKUs`);

    return res.json({
      success: true,
      data: {
        period: { 
          from: timeFrom, 
          to: timeTo, 
          days: days_back,
          from_date: new Date(timeFrom * 1000).toISOString(),
          to_date: new Date(timeTo * 1000).toISOString(),
        },
        orders_count: allOrders.length,
        sku_summary: skuSummaryWithAvg,
      },
    });
  } catch (error: any) {
    console.error('Erro ao coletar dados de vendas:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao coletar dados de vendas',
    });
  }
});

// ============================================================
// PRODUCT API - Atualização de preços
// ============================================================

/**
 * POST /api/shopee/product/update-price
 * Atualiza preço de um item ou modelo
 */
router.post('/product/update-price', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, item_id, price_list } = req.body;

    if (!shop_id || !item_id || !price_list?.length) {
      return res.status(400).json({
        success: false,
        error: 'shop_id, item_id e price_list são obrigatórios',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;
    const itemId = typeof item_id === 'string' ? parseInt(item_id, 10) : item_id;

    // Validar price_list
    const validPriceList = price_list.map((p: any) => ({
      model_id: p.model_id ? (typeof p.model_id === 'string' ? parseInt(p.model_id, 10) : p.model_id) : undefined,
      original_price: typeof p.original_price === 'string' ? parseFloat(p.original_price) : p.original_price,
    }));

    console.log(`[UpdatePrice] Atualizando preço para item ${itemId}:`, validPriceList);

    const results = await updatePrice(shopId, itemId, validPriceList);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return res.json({
      success: successCount > 0,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: errorCount,
        },
      },
      error: errorCount > 0 && successCount === 0 ? 'Falha ao atualizar preços' : undefined,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar preço:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar preço',
    });
  }
});

/**
 * POST /api/shopee/product/update-price-batch
 * Atualiza preços de múltiplos itens
 */
router.post('/product/update-price-batch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, updates } = req.body as {
      shop_id: number | string;
      updates: Array<{
        item_id: number | string;
        price_list: Array<{
          model_id?: number | string;
          original_price: number | string;
        }>;
      }>;
    };

    if (!shop_id || !updates?.length) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e updates são obrigatórios',
      });
    }

    const shopId = typeof shop_id === 'string' ? parseInt(shop_id, 10) : shop_id;

    console.log(`[UpdatePriceBatch] Atualizando ${updates.length} itens`);

    const allResults: Array<{
      item_id: number;
      model_id?: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const update of updates) {
      const itemId = typeof update.item_id === 'string' ? parseInt(update.item_id, 10) : update.item_id;
      
      const validPriceList = update.price_list.map(p => ({
        model_id: p.model_id 
          ? (typeof p.model_id === 'string' ? parseInt(p.model_id, 10) : p.model_id) 
          : undefined,
        original_price: typeof p.original_price === 'string' 
          ? parseFloat(p.original_price) 
          : p.original_price,
      }));

      const results = await updatePrice(shopId, itemId, validPriceList);
      allResults.push(...results);

      // Delay entre chamadas para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const successCount = allResults.filter(r => r.success).length;
    const errorCount = allResults.filter(r => !r.success).length;

    return res.json({
      success: successCount > 0,
      data: {
        results: allResults,
        summary: {
          total: allResults.length,
          success: successCount,
          failed: errorCount,
        },
      },
      warning: errorCount > 0 && successCount > 0 
        ? `${errorCount} de ${allResults.length} atualizações falharam` 
        : undefined,
      error: successCount === 0 && errorCount > 0 ? 'Todas as atualizações falharam' : undefined,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar preços em batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar preços',
    });
  }
});

/**
 * GET /api/shopee/product/price-info
 * Busca informações de preço de itens
 */
router.get('/product/price-info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id, item_ids } = req.query;

    if (!shop_id || !item_ids) {
      return res.status(400).json({
        success: false,
        error: 'shop_id e item_ids são obrigatórios',
      });
    }

    const shopId = parseInt(shop_id as string, 10);
    const itemIdList = (item_ids as string).split(',').map(id => parseInt(id.trim(), 10));

    const priceInfo = await getItemPriceInfo(shopId, itemIdList);

    return res.json({
      success: true,
      data: { items: priceInfo },
    });
  } catch (error: any) {
    console.error('Erro ao buscar price info:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar informações de preço',
    });
  }
});

export default router;
