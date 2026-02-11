import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ensureOwnedShopOrFail } from '../middleware/shopee-shop-ownership.middleware';
import * as itemLimitService from '../services/shopee-item-limit.service';

const router = Router();

router.use(authMiddleware);
router.use(async (req: Request, res: Response, next: NextFunction) => {
  const rawShopId = req.method === 'GET'
    ? req.query.shop_id
    : req.body?.shop_id;

  const shopId = await ensureOwnedShopOrFail(req, res, rawShopId);
  if (!shopId) return;

  res.locals.shopId = shopId;
  next();
});

function extractShopeeEndpoint(errorMessage: string): string | null {
  const match = errorMessage.match(/\/api\/v2\/[a-z0-9_/-]+/i);
  return match?.[0] || null;
}

function toEndpointOrientedError(error: unknown, fallback: string): { message: string; endpoint?: string } {
  const raw = error instanceof Error ? error.message : String(error || fallback);
  const endpoint = extractShopeeEndpoint(raw);
  if (endpoint) {
    return {
      message: `Falha ao consultar Shopee no endpoint ${endpoint}. Tente novamente e valide o category_id/loja. Detalhe: ${raw}`,
      endpoint,
    };
  }
  return { message: raw || fallback };
}

/**
 * GET /api/shopee/item-limit
 * Busca limites de item para uma categoria
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const categoryId = parseInt(req.query.category_id as string);
    
    if (!shopId || !categoryId) {
      res.status(400).json({
        success: false,
        error: 'shop_id e category_id são obrigatórios',
      });
      return;
    }
    
    const limits = await itemLimitService.getItemLimit(shopId, categoryId);
    
    if (!limits) {
      res.status(404).json({
        success: false,
        error: 'Limites não encontrados para esta categoria',
      });
      return;
    }
    
    res.json({
      success: true,
      data: limits,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar limites:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar limites');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_ITEM_LIMIT_ERROR',
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/dts
 * Busca limites de dias para envio
 */
router.get('/dts', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const categoryId = parseInt(req.query.category_id as string);
    
    if (!shopId || !categoryId) {
      res.status(400).json({
        success: false,
        error: 'shop_id e category_id são obrigatórios',
      });
      return;
    }
    
    const dtsLimits = await itemLimitService.getDtsLimits(shopId, categoryId);
    
    res.json({
      success: true,
      data: dtsLimits,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar limites de DTS:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar limites de DTS');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_DTS_LIMIT_ERROR',
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/size-chart-support
 * Verifica se categoria suporta size chart
 */
router.get('/size-chart-support', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const categoryId = parseInt(req.query.category_id as string);
    
    if (!shopId || !categoryId) {
      res.status(400).json({
        success: false,
        error: 'shop_id e category_id são obrigatórios',
      });
      return;
    }
    
    const support = await itemLimitService.checkSizeChartSupport(shopId, categoryId);
    
    res.json({
      success: true,
      data: support,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao verificar suporte a size chart:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao verificar suporte a size chart');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_SIZE_CHART_SUPPORT_ERROR',
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/size-charts
 * Lista size charts disponíveis
 */
router.get('/size-charts', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const categoryId = parseInt(req.query.category_id as string);
    const pageSize = parseInt(req.query.page_size as string) || 50;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    if (!shopId || !categoryId) {
      res.status(400).json({
        success: false,
        error: 'shop_id e category_id são obrigatórios',
      });
      return;
    }

    const sizeCharts = await itemLimitService.getSizeCharts(shopId, categoryId, pageSize, cursor);
    
    res.json({
      success: true,
      data: sizeCharts,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar size charts:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar size charts');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_SIZE_CHART_LIST_ERROR',
    });
    return;
  }
});

export default router;

