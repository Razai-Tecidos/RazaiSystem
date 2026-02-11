import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getAuthUrl,
  getAccessToken,
  saveShopTokens,
  disconnectShop,
  getShopConnectionStatus,
  getConnectedShops,
  getShopTokens,
} from '../services/shopee.service';

const router = Router();

function parseShopId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * GET /api/shopee/auth-url
 */
router.get('/auth-url', authMiddleware, async (_req: Request, res: Response) => {
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
      error: error.message || 'Erro ao gerar URL de autorizacao',
    });
  }
});

/**
 * POST /api/shopee/callback
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

    const shopId = parseShopId(shop_id);
    if (!shopId) {
      return res.status(400).json({
        success: false,
        error: 'shop_id invalido',
      });
    }

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

    res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja conectada com sucesso',
      },
    });
  } catch (error: any) {
    console.error('Erro no callback Shopee:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar autorizacao',
    });
  }
});

/**
 * GET /api/shopee/status
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
    }

    const rawShopId = req.query.shop_id;
    if (rawShopId !== undefined && rawShopId !== null && rawShopId !== '') {
      const shopId = parseShopId(rawShopId);
      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: 'shop_id invalido',
        });
      }

      const shop = await getShopTokens(shopId);
      if (!shop || shop.connectedBy !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Sem permissao para acessar esta loja Shopee',
        });
      }

      const status = await getShopConnectionStatus(shopId);
      return res.json({
        success: true,
        data: {
          connected: status.connected,
          shop: status.shop ? {
            shopId: status.shop.shopId,
            shopName: status.shop.shopName,
            connectedAt: status.shop.connectedAt,
            tokenExpiresAt: status.shop.tokenExpiresAt,
          } : undefined,
        },
      });
    }

    const ownedShops = (await getConnectedShops()).filter((shop) => shop.connectedBy === userId);
    return res.json({
      success: true,
      data: {
        connected: ownedShops.length > 0,
        shops: ownedShops.map((shop) => ({
          shopId: shop.shopId,
          shopName: shop.shopName,
          connectedAt: shop.connectedAt,
          tokenExpiresAt: shop.tokenExpiresAt,
        })),
      },
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
 */
router.get('/shops', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
    }

    const shops = (await getConnectedShops()).filter((shop) => shop.connectedBy === userId);
    res.json({
      success: true,
      data: {
        shops: shops.map((shop) => ({
          shopId: shop.shopId,
          shopName: shop.shopName,
          connectedAt: shop.connectedAt,
          tokenExpiresAt: shop.tokenExpiresAt,
        })),
      },
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
 */
router.post('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
    }

    const shopId = parseShopId(req.body.shop_id);
    if (!shopId) {
      return res.status(400).json({
        success: false,
        error: 'shop_id invalido',
      });
    }

    const shop = await getShopTokens(shopId);
    if (!shop || shop.connectedBy !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissao para desconectar esta loja',
      });
    }

    await disconnectShop(shopId);

    res.json({
      success: true,
      data: {
        shopId,
        message: 'Loja desconectada com sucesso',
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
