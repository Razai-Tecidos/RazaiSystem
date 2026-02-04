import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getAuthUrl,
  getAccessToken,
  saveShopTokens,
  disconnectShop,
  getShopConnectionStatus,
  getConnectedShops,
} from '../services/shopee.service';

const router = Router();

/**
 * GET /api/shopee/auth-url
 * Gera URL de autorização para conectar loja Shopee
 */
router.get('/auth-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUrl = getAuthUrl();
    
    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error: any) {
    console.error('Erro ao gerar auth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar URL de autorização',
    });
  }
});

/**
 * POST /api/shopee/callback
 * Recebe o código de autorização e troca por tokens
 */
router.post('/callback', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, shop_id } = req.body;

    if (!code || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'code e shop_id são obrigatórios',
      });
    }

    const shopId = parseInt(shop_id, 10);
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
    }

    // Troca o código por tokens
    const tokenResponse = await getAccessToken(code, shopId);

    // Salva os tokens no Firestore
    await saveShopTokens(
      shopId,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      tokenResponse.expire_in,
      userId
    );

    res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja conectada com sucesso!',
      },
    });
  } catch (error: any) {
    console.error('Erro no callback Shopee:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar autorização',
    });
  }
});

/**
 * GET /api/shopee/status
 * Verifica status de conexão das lojas
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_id } = req.query;

    const shopId = shop_id ? parseInt(shop_id as string, 10) : undefined;
    const status = await getShopConnectionStatus(shopId);

    // Remove tokens sensíveis da resposta
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

    res.json({
      success: true,
      data: sanitizedStatus,
    });
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({
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

    // Remove tokens sensíveis da resposta
    const sanitizedShops = shops.map(shop => ({
      shopId: shop.shopId,
      shopName: shop.shopName,
      connectedAt: shop.connectedAt,
      connectedBy: shop.connectedBy,
      tokenExpiresAt: shop.tokenExpiresAt,
    }));

    res.json({
      success: true,
      data: { shops: sanitizedShops },
    });
  } catch (error: any) {
    console.error('Erro ao listar lojas:', error);
    res.status(500).json({
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
        error: 'shop_id é obrigatório',
      });
    }

    const shopId = parseInt(shop_id, 10);

    await disconnectShop(shopId);

    res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja desconectada com sucesso!',
      },
    });
  } catch (error: any) {
    console.error('Erro ao desconectar loja:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao desconectar loja',
    });
  }
});

export default router;
