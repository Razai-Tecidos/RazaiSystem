import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ensureOwnedShopOrFail } from '../middleware/shopee-shop-ownership.middleware';
import * as categoryService from '../services/shopee-category.service';
import { ShopeeBrand } from '../types/shopee-product.types';

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

function resolvePageSize(value: unknown, fallback = 100): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
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
      message: `Falha ao consultar Shopee no endpoint ${endpoint}. Verifique permissões/categoria e tente novamente. Detalhe: ${raw}`,
      endpoint,
    };
  }
  return { message: raw || fallback };
}

/**
 * GET /api/shopee/categories
 * Lista categorias (do cache ou da API)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const forceRefresh = req.query.refresh === 'true';
    const language = resolveLanguage(req.query.language);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const categories = await categoryService.getCategories(shopId, forceRefresh, language);
    
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
router.get('/subcategories', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const parentId = req.query.parent_id ? parseInt(req.query.parent_id as string, 10) : undefined;
    const language = resolveLanguage(req.query.language);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const subcategories = await categoryService.getSubcategories(shopId, parentId, language);
    
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
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.body.shop_id as string, 10);
    const language = resolveLanguage(req.body.language);
    
    if (!shopId || isNaN(shopId)) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const categories = await categoryService.forceRefreshCategories(shopId, language);
    
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
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    const language = resolveLanguage(req.query.language);
    
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
    
    const category = await categoryService.getCategoryById(shopId, categoryId, language);
    
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
router.get('/:id/path', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    const language = resolveLanguage(req.query.language);
    
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
    
    const path = await categoryService.getCategoryPath(shopId, categoryId, language);
    
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
router.get('/:id/attributes', async (req: Request, res: Response): Promise<void> => {
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
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar atributos da categoria');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_ATTRIBUTE_TREE_ERROR',
    });
    return;
  }
});

/**
 * GET /api/shopee/categories/:id/brands
 * Busca marcas disponíveis para uma categoria
 */
router.get('/:id/brands', async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = parseInt(req.query.shop_id as string, 10);
    const categoryId = parseInt(req.params.id, 10);
    const language = resolveLanguage(req.query.language);
    const pageSize = resolvePageSize(req.query.page_size, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const fetchAllPages = req.query.all !== 'false';
    const statusQuery = String(req.query.status || '1').toLowerCase();
    const statusMode: 1 | 2 | 'all' =
      statusQuery === '2' ? 2 : statusQuery === 'all' ? 'all' : 1;
    
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
    
    const isMandatory = await categoryService.isBrandMandatory(shopId, categoryId);
    const mergeBrands = (lists: Array<{ brands: ShopeeBrand[] }>) => {
      const dedup = new Map<number, ShopeeBrand>();
      lists.forEach((list) => {
        list.brands.forEach((brand) => {
          dedup.set(brand.brand_id, brand);
        });
      });
      return Array.from(dedup.values());
    };

    if (fetchAllPages) {
      if (statusMode === 'all') {
        const [normal, pending] = await Promise.all([
          categoryService.getAllCategoryBrands(shopId, categoryId, 1, pageSize, language),
          categoryService.getAllCategoryBrands(shopId, categoryId, 2, pageSize, language),
        ]);
        const brands = mergeBrands([normal, pending]);
        res.json({
          success: true,
          data: {
            brands,
            has_more: normal.hasMore || pending.hasMore,
            total: brands.length,
            pages_fetched: normal.pagesFetched + pending.pagesFetched,
            is_mandatory: isMandatory,
          },
        });
        return;
      }

      const result = await categoryService.getAllCategoryBrands(shopId, categoryId, statusMode, pageSize, language);
      res.json({
        success: true,
        data: {
          brands: result.brands,
          has_more: result.hasMore,
          total: result.brands.length,
          pages_fetched: result.pagesFetched,
          is_mandatory: isMandatory,
        },
      });
      return;
    }

    if (statusMode === 'all') {
      const [normal, pending] = await Promise.all([
        categoryService.getCategoryBrands(shopId, categoryId, 1, pageSize, offset, language),
        categoryService.getCategoryBrands(shopId, categoryId, 2, pageSize, offset, language),
      ]);
      const brands = mergeBrands([normal, pending]);
      res.json({
        success: true,
        data: {
          brands,
          has_more: normal.hasMore || pending.hasMore,
          next_offset: Math.max(normal.nextOffset, pending.nextOffset),
          total: brands.length,
          is_mandatory: isMandatory,
        },
      });
      return;
    }

    const result = await categoryService.getCategoryBrands(shopId, categoryId, statusMode, pageSize, offset, language);
    res.json({
      success: true,
      data: {
        brands: result.brands,
        has_more: result.hasMore,
        next_offset: result.nextOffset,
        total: result.brands.length,
        is_mandatory: isMandatory,
      },
    });
    return;
  } catch (error: any) {
    console.error('Erro ao buscar marcas da categoria:', error);
    const mapped = toEndpointOrientedError(error, 'Erro ao buscar marcas da categoria');
    res.status(500).json({
      success: false,
      error: mapped.message,
      endpoint: mapped.endpoint,
      error_code: mapped.endpoint ? 'SHOPEE_ENDPOINT_ERROR' : 'SHOPEE_BRAND_LIST_ERROR',
    });
    return;
  }
});

export default router;
