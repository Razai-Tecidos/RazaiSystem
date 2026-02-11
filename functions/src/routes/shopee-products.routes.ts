import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ensureOwnedShopOrFail } from '../middleware/shopee-shop-ownership.middleware';
import * as productService from '../services/shopee-product.service';
import * as syncService from '../services/shopee-sync.service';
import { CreateShopeeProductData } from '../types/shopee-product.types';

const router = Router();

function logPublishRoute(
  level: 'info' | 'error',
  event: string,
  details: Record<string, unknown>
): void {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    module: 'shopee_products.route',
    event,
    ...details,
  });

  if (level === 'error') {
    console.error(payload);
    return;
  }
  console.log(payload);
}

/**
 * GET /api/shopee/products
 * Lista produtos/rascunhos do usuário
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const shopId = req.query.shop_id ? parseInt(req.query.shop_id as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    
    const products = await productService.listProducts(userId, shopId, status);
    
    res.json({
      success: true,
      data: products,
    });
  } catch (error: any) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar produtos',
    });
  }
});

/**
 * POST /api/shopee/products/sync-all
 * Sincroniza todos os produtos de uma loja
 * IMPORTANTE: Esta rota deve vir ANTES das rotas com :id
 */
router.post('/sync-all', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { shop_id } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    if (!shop_id) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    const shopId = await ensureOwnedShopOrFail(req, res, shop_id);
    if (!shopId) return;

    const result = await syncService.syncAllProducts(shopId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar produtos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao sincronizar produtos',
    });
  }
});

/**
 * GET /api/shopee/products/:id
 * Busca um produto por ID
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }

    const product = await productService.getProductById(id);
    
    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado',
      });
      return;
    }

    const ownerId = product.created_by || product.user_id;
    if (!ownerId || ownerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Sem permissão para acessar este produto',
      });
      return;
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar produto',
    });
  }
});

/**
 * POST /api/shopee/products
 * Cria um novo produto/rascunho
 */
router.post('/', authMiddleware, async (req: Request<object, object, CreateShopeeProductData>, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const {
      shop_id,
      tecido_id,
      cores,
      tamanhos,
      precos_por_tamanho,
      preco_base,
      precificacao,
      estoque_padrao,
      categoria_id,
      peso,
      dimensoes,
      descricao_customizada,
      titulo_anuncio,
      usar_imagens_publicas,
      imagens_principais,
      imagens_principais_1_1,
      imagens_principais_3_4,
      imagem_ratio_principal,
      template_id,
      video_url,
      atributos,
      brand_id,
      brand_nome,
      logistic_info,
      condition,
      is_pre_order,
      days_to_ship,
      size_chart_id,
      description_type,
      extended_description,
      wholesale,
      ncm_padrao,
    } = req.body;
    
    // Validações
    if (!shop_id) {
      res.status(400).json({
        success: false,
        error: 'shop_id é obrigatório',
      });
      return;
    }
    
    if (!tecido_id) {
      res.status(400).json({
        success: false,
        error: 'tecido_id é obrigatório',
      });
      return;
    }
    
    if (!cores || cores.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Pelo menos uma cor deve ser selecionada',
      });
      return;
    }
    
    if (preco_base === undefined || preco_base <= 0) {
      res.status(400).json({
        success: false,
        error: 'Preço base deve ser maior que zero',
      });
      return;
    }
    
    if (estoque_padrao === undefined || estoque_padrao < 0) {
      res.status(400).json({
        success: false,
        error: 'Estoque padrão deve ser maior ou igual a zero',
      });
      return;
    }
    
    if (!categoria_id) {
      res.status(400).json({
        success: false,
        error: 'Categoria é obrigatória',
      });
      return;
    }
    
    if (!peso || peso <= 0) {
      res.status(400).json({
        success: false,
        error: 'Peso deve ser maior que zero',
      });
      return;
    }
    
    if (!dimensoes || dimensoes.comprimento <= 0 || dimensoes.largura <= 0 || dimensoes.altura <= 0) {
      res.status(400).json({
        success: false,
        error: 'Dimensões devem ser maiores que zero',
      });
      return;
    }

    if (imagem_ratio_principal !== undefined && imagem_ratio_principal !== '1:1' && imagem_ratio_principal !== '3:4') {
      res.status(400).json({
        success: false,
        error: 'imagem_ratio_principal deve ser "1:1" ou "3:4"',
      });
      return;
    }

    if (imagens_principais_1_1 && imagens_principais_1_1.length > 9) {
      res.status(400).json({
        success: false,
        error: 'imagens_principais_1_1 permite no maximo 9 imagens',
      });
      return;
    }

    if (imagens_principais_3_4 && imagens_principais_3_4.length > 9) {
      res.status(400).json({
        success: false,
        error: 'imagens_principais_3_4 permite no maximo 9 imagens',
      });
      return;
    }
    
    // Valida estoque de cada cor
    for (const cor of cores) {
      if (!cor.cor_id) {
        res.status(400).json({
          success: false,
          error: 'cor_id é obrigatório para cada cor',
        });
        return;
      }
      if (cor.estoque === undefined || cor.estoque < 0) {
        res.status(400).json({
          success: false,
          error: 'Estoque de cada cor deve ser maior ou igual a zero',
        });
        return;
      }
    }
    
    const product = await productService.createProduct(userId, {
      shop_id,
      tecido_id,
      cores,
      tamanhos,
      precos_por_tamanho,
      preco_base,
      precificacao,
      estoque_padrao,
      categoria_id,
      peso,
      dimensoes,
      descricao_customizada,
      titulo_anuncio,
      usar_imagens_publicas,
      imagens_principais,
      imagens_principais_1_1,
      imagens_principais_3_4,
      imagem_ratio_principal,
      template_id,
      video_url,
      atributos,
      brand_id,
      brand_nome,
      logistic_info,
      condition,
      is_pre_order,
      days_to_ship,
      size_chart_id,
      description_type,
      extended_description,
      wholesale,
      ncm_padrao,
    });
    
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar produto',
    });
  }
});

/**
 * PUT /api/shopee/products/:id
 * Atualiza um produto/rascunho
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const product = await productService.updateProduct(id, userId, req.body);
    
    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    
    if (error.message.includes('permissão')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar produto',
    });
  }
});

/**
 * DELETE /api/shopee/products/:id
 * Exclui um produto/rascunho (incluindo anúncio publicado na Shopee)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const deleted = await productService.deleteProduct(id, userId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Produto excluído com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir produto:', error);
    
    if (error.message.includes('permissão')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir produto',
    });
  }
});

/**
 * POST /api/shopee/products/:id/publish
 * Publica um rascunho na Shopee
 */
router.post('/:id/publish', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const requestStartedAt = Date.now();
  const { id } = req.params;
  const dryRun = req.query.dry_run === 'true';

  try {
    const userId = req.user?.uid;

    if (!userId) {
      logPublishRoute('error', 'publish.request.unauthenticated', {
        product_id: id,
        dry_run: dryRun,
      });
      res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
      return;
    }

    logPublishRoute('info', 'publish.request.received', {
      product_id: id,
      user_id: userId,
      dry_run: dryRun,
    });

    const result = await productService.publishProduct(id, userId, dryRun);

    if (dryRun) {
      logPublishRoute('info', 'publish.request.success', {
        product_id: id,
        user_id: userId,
        dry_run: true,
        duration_ms: Date.now() - requestStartedAt,
      });
      res.json({
        success: true,
        dry_run: true,
        payload: result,
        message: 'Dry-run: payload gerado sem chamar API Shopee',
      });
      return;
    }

    logPublishRoute('info', 'publish.request.success', {
      product_id: id,
      user_id: userId,
      dry_run: false,
      duration_ms: Date.now() - requestStartedAt,
    });

    res.json({
      success: true,
      data: result,
      message: 'Produto publicado com sucesso na Shopee',
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Erro ao publicar produto';
    const normalizedErrorMessage = String(error.message || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalizedErrorMessage.includes('publicacao ja em andamento')) {
      logPublishRoute('error', 'publish.request.error', {
        product_id: id,
        dry_run: dryRun,
        status_code: 409,
        duration_ms: Date.now() - requestStartedAt,
        error: errorMessage,
      });
      res.status(409).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (normalizedErrorMessage.includes('validacao falhou') || normalizedErrorMessage.includes('validacao pre-publish reforcada falhou')) {
      logPublishRoute('error', 'publish.request.error', {
        product_id: id,
        dry_run: dryRun,
        status_code: 400,
        duration_ms: Date.now() - requestStartedAt,
        error: errorMessage,
      });
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (normalizedErrorMessage.includes('permissao')) {
      logPublishRoute('error', 'publish.request.error', {
        product_id: id,
        dry_run: dryRun,
        status_code: 403,
        duration_ms: Date.now() - requestStartedAt,
        error: errorMessage,
      });
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (normalizedErrorMessage.includes('nao encontrado')) {
      logPublishRoute('error', 'publish.request.error', {
        product_id: id,
        dry_run: dryRun,
        status_code: 404,
        duration_ms: Date.now() - requestStartedAt,
        error: errorMessage,
      });
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    logPublishRoute('error', 'publish.request.error', {
      product_id: id,
      dry_run: dryRun,
      status_code: 500,
      duration_ms: Date.now() - requestStartedAt,
      error: errorMessage,
    });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/shopee/products/:id/sync
 * Sincroniza um produto específico com a Shopee
 */
router.post('/:id/sync', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    // Verifica se o produto existe e pertence ao usuário
    const product = await productService.getProductById(id);
    
    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado',
      });
      return;
    }
    
    const ownerId = product.created_by || product.user_id;
    if (!ownerId || ownerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Sem permissão para sincronizar este produto',
      });
      return;
    }
    
    if (product.status !== 'published' || !product.shopee_item_id) {
      res.status(400).json({
        success: false,
        error: 'Apenas produtos publicados podem ser sincronizados',
      });
      return;
    }
    
    const result = await syncService.syncProductFromShopee(id);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar produto:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao sincronizar produto',
    });
  }
});

export default router;
