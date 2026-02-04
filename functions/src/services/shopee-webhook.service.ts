import crypto from 'crypto';
import admin from '../config/firebase';
import { ensureValidToken, callShopeeApi } from './shopee.service';

const db = admin.firestore();
const DISABLED_COLORS_COLLECTION = 'disabled_colors';

/**
 * Verifica assinatura HMAC-SHA256 do webhook da Shopee
 */
export function verifyWebhookSignature(
  signature: string,
  body: string,
  partnerKey: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', partnerKey)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Webhook] Erro ao verificar assinatura:', error);
    return false;
  }
}

/**
 * Processa evento reserved_stock_change_push
 */
export async function processReservedStockChange(event: any): Promise<void> {
  const { data } = event;
  
  if (!data) {
    console.warn('[Webhook] Evento sem dados:', event);
    return;
  }

  const { shop_id, item_id, variation_id, action } = data;

  // Apenas processa quando pedido é cancelado
  if (action !== 'cancel_order') {
    console.log(`[Webhook] Ignorando evento com action=${action}`);
    return;
  }

  console.log(`[Webhook] Processando cancel_order para item ${item_id}, variation ${variation_id}`);

  // Verifica se há cor desativada relacionada
  const disabledColor = await findDisabledColorByVariation(
    shop_id,
    item_id,
    variation_id
  );

  if (!disabledColor) {
    console.log(`[Webhook] Nenhuma cor desativada encontrada para item ${item_id}, variation ${variation_id}`);
    return;
  }

  console.log(`[Webhook] Cor desativada encontrada: SKU ${disabledColor.item_sku}, cor ${disabledColor.color_option}`);

  // Verificar estoque atual antes de zerar (otimização)
  try {
    const accessToken = await ensureValidToken(shop_id);
    
    // Verificar estoque atual do modelo
    const modelData = await callShopeeApi({
      path: '/api/v2/product/get_model_list',
      method: 'GET',
      shopId: shop_id,
      accessToken,
      query: {
        item_id: String(item_id),
      },
    }) as any;

    const model = (modelData?.response?.model || []).find((m: any) => m?.model_id === variation_id);
    const currentStock = model?.stock_info_v2?.summary_info?.total_available_stock ?? 0;

    // Se já está zerado, apenas atualiza last_maintained e retorna
    if (currentStock === 0) {
      console.log(`[Webhook] Estoque já está zerado para item ${item_id}, variation ${variation_id} (${currentStock})`);
      const docId = `${shop_id}_${disabledColor.item_sku}_${disabledColor.color_option}`.replace(/[^a-zA-Z0-9_]/g, '_');
      await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).update({
        last_maintained: admin.firestore.Timestamp.now(),
      });
      return;
    }

    console.log(`[Webhook] Estoque atual: ${currentStock}, zerando para item ${item_id}, variation ${variation_id}`);

    // Zera estoque apenas se necessário
    await callShopeeApi({
      path: '/api/v2/product/update_stock',
      method: 'POST',
      shopId: shop_id,
      accessToken,
      body: {
        item_id: item_id,
        stock_list: [{
          model_id: variation_id,
          stock: 0,
        }],
      },
    });

    // Atualiza last_maintained
    const docId = `${shop_id}_${disabledColor.item_sku}_${disabledColor.color_option}`.replace(/[^a-zA-Z0-9_]/g, '_');
    await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).update({
      last_maintained: admin.firestore.Timestamp.now(),
    });

    console.log(`[Webhook] Estoque zerado com sucesso para item ${item_id}, variation ${variation_id} (era ${currentStock})`);
  } catch (error: any) {
    console.error(`[Webhook] Erro ao zerar estoque:`, error);
    throw error;
  }
}

/**
 * Busca cor desativada por variation_id
 */
async function findDisabledColorByVariation(
  shopId: number,
  itemId: number,
  variationId: number
): Promise<{ item_sku: string; color_option: string } | null> {
  try {
    const snapshot = await db
      .collection(DISABLED_COLORS_COLLECTION)
      .where('shop_id', '==', shopId)
      .where('item_ids', 'array-contains', String(itemId))
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const modelIds = data.model_ids || [];
      
      // Verifica se variation_id está na lista de model_ids
      if (modelIds.includes(variationId) || modelIds.includes(String(variationId))) {
        return {
          item_sku: data.item_sku,
          color_option: data.color_option,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Webhook] Erro ao buscar cor desativada:', error);
    return null;
  }
}
