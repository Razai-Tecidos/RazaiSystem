import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ensureValidToken, callShopeeApi } from '../services/shopee.service';

const db = admin.firestore();
const DISABLED_COLORS_COLLECTION = 'disabled_colors';

/**
 * Cloud Function agendada para manter estoque zerado
 * Executa a cada hora
 */
export const maintainDisabledColors = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[Scheduled] Iniciando verificação de cores desativadas');

    try {
      const snapshot = await db.collection(DISABLED_COLORS_COLLECTION).get();
      
      if (snapshot.empty) {
        console.log('[Scheduled] Nenhuma cor desativada encontrada');
        return null;
      }

      let verifiedCount = 0;
      let zeroedCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const { shop_id, item_ids, model_ids: modelIds, item_sku, color_option } = data;

        try {
          const accessToken = await ensureValidToken(shop_id);
          verifiedCount++;

          // Verificar estoque para cada item_id
          for (const itemIdStr of item_ids || []) {
            const itemId = typeof itemIdStr === 'string' ? parseInt(itemIdStr, 10) : itemIdStr;

            try {
              const modelData = await callShopeeApi({
                path: '/api/v2/product/get_model_list',
                method: 'GET',
                shopId: shop_id,
                accessToken,
                query: {
                  item_id: String(itemId),
                },
              }) as any;

              const models = modelData?.response?.model || [];
              
              // Verificar cada modelo relacionado
              for (const model of models) {
                const modelId = model?.model_id;
                const availableStock = model?.stock_info_v2?.summary_info?.total_available_stock ?? 0;

                // Se modelo está na lista de desativados e tem estoque > 0
                if (
                  modelIds.includes(modelId) || 
                  modelIds.includes(String(modelId))
                ) {
                  if (availableStock > 0) {
                    console.log(`[Scheduled] Zerando estoque para item ${itemId}, model ${modelId} (estoque: ${availableStock})`);

                    await callShopeeApi({
                      path: '/api/v2/product/update_stock',
                      method: 'POST',
                      shopId: shop_id,
                      accessToken,
                      body: {
                        item_id: itemId,
                        stock_list: [{
                          model_id: modelId,
                          seller_stock: [{ stock: 0 }],
                        }],
                      },
                    });

                    zeroedCount++;
                  }
                }
              }
            } catch (error: any) {
              console.error(`[Scheduled] Erro ao verificar item ${itemId}:`, error);
            }
          }

          // Atualizar last_maintained
          await doc.ref.update({
            last_maintained: admin.firestore.Timestamp.now(),
          });

        } catch (error: any) {
          console.error(`[Scheduled] Erro ao processar cor desativada (SKU: ${item_sku}, Cor: ${color_option}):`, error);
        }
      }

      console.log(`[Scheduled] Verificação concluída: ${verifiedCount} cores verificadas, ${zeroedCount} estoques zerados`);
      return null;
    } catch (error: any) {
      console.error('[Scheduled] Erro na função agendada:', error);
      return null;
    }
  });
