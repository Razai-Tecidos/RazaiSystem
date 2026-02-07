import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as itemLimitService from '../services/shopee-item-limit.service';

const router = Router();

/**
 * GET /api/shopee/item-limit
 * Busca limites de item para uma categoria
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/dts
 * Busca limites de dias para envio
 */
router.get('/dts', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/size-chart-support
 * Verifica se categoria suporta size chart
 */
router.get('/size-chart-support', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

/**
 * GET /api/shopee/item-limit/size-charts
 * Lista size charts disponíveis
 */
router.get('/size-charts', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string);
    
    if (!shopId) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const sizeCharts = await itemLimitService.getSizeCharts(shopId);
    
    res.json({
      success: true,
      data: sizeCharts,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar size charts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

export default router;
