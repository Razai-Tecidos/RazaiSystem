import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as categoryService from '../services/shopee-category.service';

const router = Router();

/**
 * GET /api/shopee/categories
 * Lista categorias (do cache ou da API)
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const forceRefresh = req.query.refresh === 'true';
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const categories = await categoryService.getCategories(shopId, forceRefresh);
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar categorias',
    });
  }
});

/**
 * GET /api/shopee/categories/subcategories
 * Lista subcategorias de uma categoria pai
 */
router.get('/subcategories', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const parentId = req.query.parent_id ? parseInt(req.query.parent_id as string, 10) : undefined;
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const subcategories = await categoryService.getSubcategories(shopId, parentId);
    
    res.json({
      success: true,
      data: subcategories,
    });
  } catch (error: any) {
    console.error('Erro ao listar subcategorias:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar subcategorias',
    });
  }
});

/**
 * POST /api/shopee/categories/refresh
 * Força atualização do cache de categorias
 * IMPORTANTE: Esta rota deve vir ANTES das rotas com :id
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.body.shop_id as string, 10);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const categories = await categoryService.forceRefreshCategories(shopId);
    
    res.json({
      success: true,
      data: categories,
      message: 'Cache de categorias atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao atualizar cache de categorias:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar cache de categorias',
    });
  }
});

/**
 * GET /api/shopee/categories/:id
 * Busca uma categoria por ID
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        error: 'ID de categoria inválido',
      });
      return;
    }
    
    const category = await categoryService.getCategoryById(shopId, categoryId);
    
    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Categoria não encontrada',
      });
      return;
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar categoria',
    });
  }
});

/**
 * GET /api/shopee/categories/:id/path
 * Busca o caminho completo de uma categoria (breadcrumb)
 */
router.get('/:id/path', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        error: 'ID de categoria inválido',
      });
      return;
    }
    
    const path = await categoryService.getCategoryPath(shopId, categoryId);
    
    res.json({
      success: true,
      data: path,
    });
  } catch (error: any) {
    console.error('Erro ao buscar caminho da categoria:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar caminho da categoria',
    });
  }
});

/**
 * GET /api/shopee/categories/:id/attributes
 * Busca atributos de uma categoria
 */
router.get('/:id/attributes', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    const onlyMandatory = req.query.mandatory === 'true';
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        error: 'ID de categoria inválido',
      });
      return;
    }
    
    const attributes = onlyMandatory 
      ? await categoryService.getMandatoryAttributes(shopId, categoryId)
      : await categoryService.getCategoryAttributes(shopId, categoryId);
    
    res.json({
      success: true,
      data: attributes,
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar atributos da categoria:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar atributos da categoria',
    });
    return;
  }
});

/**
 * GET /api/shopee/categories/:id/brands
 * Busca marcas disponíveis para uma categoria
 */
router.get('/:id/brands', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    const pageSize = parseInt(req.query.page_size as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        error: 'ID de categoria inválido',
      });
      return;
    }
    
    const result = await categoryService.getCategoryBrands(shopId, categoryId, 1, pageSize, offset);
    const isMandatory = await categoryService.isBrandMandatory(shopId, categoryId);
    
    res.json({
      success: true,
      data: {
        brands: result.brands,
        has_more: result.hasMore,
        is_mandatory: isMandatory,
      },
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar marcas da categoria:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar marcas da categoria',
    });
    return;
  }
});

export default router;
