import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as logisticsService from '../services/shopee-logistics.service';

const router = Router();

/**
 * GET /api/shopee/logistics
 * Lista canais de logística de uma loja
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    
    if (!shopId) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.getLogisticsChannels(shopId);
    
    res.json({
      success: true,
      data: channels,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar canais de logística:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * GET /api/shopee/logistics/enabled
 * Lista apenas canais de logística habilitados
 */
router.get('/enabled', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    
    if (!shopId) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.getEnabledLogisticsChannels(shopId);
    
    res.json({
      success: true,
      data: channels,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar canais habilitados:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * POST /api/shopee/logistics/refresh
 * Força atualização do cache de logística
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { shop_id } = req.body;
    
    if (!shop_id) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const channels = await logisticsService.forceRefreshLogistics(shop_id);
    
    res.json({
      success: true,
      data: channels,
      message: 'Cache de logística atualizado',
    });
    return;
  } catch (error: any) {
    console.error('Erro ao atualizar cache de logística:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * POST /api/shopee/logistics/validate
 * Valida se um produto pode ser enviado pelos canais disponíveis
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { shop_id, peso, dimensoes } = req.body;
    
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
      dimensoes
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
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

export default router;
