import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ensureOwnedShopOrFail } from '../middleware/shopee-shop-ownership.middleware';
import * as logisticsService from '../services/shopee-logistics.service';

const router = Router();
const DEFAULT_SHOPEE_LANGUAGE = 'pt-BR';

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

function resolveLanguage(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SHOPEE_LANGUAGE;
  const sanitized = value.replace('_', '-').trim();
  return sanitized || DEFAULT_SHOPEE_LANGUAGE;
}

function extractShopeeEndpoint(errorMessage: string): string | null {
  const match = errorMessage.match(/\/api\/v2\/[a-z0-9_/-]+/i);
  return match?.[0] || null;
}

function toEndpointOrientedError(error: unknown, fallback: string): { message: string; endpoint?: string } {
  const raw = error instanceof Error ? error.message : String(error || fallback);
  const endpoint = extractShopeeEndpoint(raw);
  if (endpoint) {
    return {
      message: `Falha ao consultar Shopee no endpoint ${endpoint}. Revise as permissões/logística da loja e tente novamente. Detalhe: ${raw}`,
      endpoint,
    };
  }
  return { message: raw || fallback };
}

/**
 * GET /api/shopee/logistics
 * Lista canais de logística de uma loja
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const language = resolveLanguage(req.query.language);
    
    if (!shopId) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.getLogisticsChannels(shopId, false, language);
    
    res.json({
      success: true,
      data: channels,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar canais de logística:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar canais de logística');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_LOGISTICS_ERROR',
    });
    return;
  }
});

/**
 * GET /api/shopee/logistics/enabled
 * Lista apenas canais de logística habilitados
 */
router.get('/enabled', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    const language = resolveLanguage(req.query.language);
    
    if (!shopId) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.getEnabledLogisticsChannels(shopId, language);
    
    res.json({
      success: true,
      data: channels,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar canais habilitados:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar canais habilitados');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_LOGISTICS_ENABLED_ERROR',
    });
    return;
  }
});

/**
 * POST /api/shopee/logistics/refresh
 * Força atualização do cache de logística
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shop_id } = req.body;
    const language = resolveLanguage(req.body.language);
    
    if (!shop_id) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.forceRefreshLogistics(shop_id, language);
    
    res.json({
      success: true,
      data: channels,
      message: 'Cache de logística atualizado',
    });
    return;
  } catch (error: any) {
    console.error('Erro ao atualizar cache de logística:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao atualizar cache de logística');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_LOGISTICS_REFRESH_ERROR',
    });
    return;
  }
});

/**
 * POST /api/shopee/logistics/validate
 * Valida se um produto pode ser enviado pelos canais disponíveis
 */
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shop_id, peso, dimensoes } = req.body;
    const language = resolveLanguage(req.body.language);
    
    if (!shop_id || !peso || !dimensoes) {
      res.status(400).json({
        success: false,
        error: 'shop_id, peso e dimensoes são obrigatórios',
      });
      return;
    }
    
    const logisticInfo = await logisticsService.buildLogisticInfoForProduct(
      shop_id,
      peso,
      dimensoes,
      language
    );
    
    res.json({
      success: true,
      data: {
        compatible_channels: logisticInfo.length,
        logistic_info: logisticInfo,
      },
    });
    return;
  } catch (error: any) {
    console.error('Erro ao validar logística:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao validar logística');
    res.status(400).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_LOGISTICS_VALIDATE_ERROR',
    });
    return;
  }
});

export default router;

