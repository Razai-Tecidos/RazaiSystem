import { Request, Response } from 'express';
import { getShopTokens } from '../services/shopee.service';

function parseShopId(rawShopId: unknown): number | null {
  if (typeof rawShopId === 'number' && Number.isInteger(rawShopId) && rawShopId > 0) {
    return rawShopId;
  }

  if (typeof rawShopId === 'string') {
    const trimmed = rawShopId.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export async function ensureOwnedShopOrFail(
  req: Request,
  res: Response,
  rawShopId: unknown
): Promise<number | null> {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Usuario nao autenticado',
    });
    return null;
  }

  const shopId = parseShopId(rawShopId);
  if (!shopId) {
    res.status(400).json({
      success: false,
      error: 'shop_id invalido',
    });
    return null;
  }

  const shopData = await getShopTokens(shopId);
  if (!shopData) {
    res.status(404).json({
      success: false,
      error: 'Loja Shopee nao encontrada ou nao conectada',
    });
    return null;
  }

  if (shopData.connectedBy !== userId) {
    res.status(403).json({
      success: false,
      error: 'Sem permissao para acessar esta loja Shopee',
    });
    return null;
  }

  return shopId;
}
