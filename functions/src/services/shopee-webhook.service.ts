import crypto from 'crypto';
import admin from '../config/firebase';
import { ensureValidToken, callShopeeApi } from './shopee.service';

const db = admin.firestore();
const DISABLED_COLORS_COLLECTION = 'disabled_colors';
const SHOPEE_PRODUCTS_COLLECTION = 'shopee_products';
const SHOPEE_WEBHOOK_LOGS_COLLECTION = 'shopee_webhook_logs';

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
 * Registra log do webhook no Firestore
 */
async function logWebhookEvent(code: number, event: any, status: 'success' | 'error', details?: string): Promise<void> {
  try {
    await db.collection(SHOPEE_WEBHOOK_LOGS_COLLECTION).add({
      code,
      event_data: event,
      status,
      details: details || null,
      received_at: admin.firestore.Timestamp.now(),
    });
  } catch (err) {
    console.error('[Webhook] Erro ao registrar log:', err);
  }
}

// =====================================================================
// HANDLER: reserved_stock_change_push (code 8)
// =====================================================================

/**
 * Processa evento reserved_stock_change_push
 * Atualiza estoque reservado no Firestore e zera estoque de cores desabilitadas
 */
export async function processReservedStockChange(event: any): Promise<void> {
  const { data } = event;
  
  if (!data) {
    console.warn('[Webhook] Evento sem dados:', event);
    return;
  }

  const { shop_id, item_id, variation_id, action } = data;

  console.log(`[Webhook:StockChange] shop=${shop_id} item=${item_id} variation=${variation_id} action=${action}`);

  // Atualiza o produto no Firestore com informação de estoque alterado
  try {
    const productsSnapshot = await db.collection(SHOPEE_PRODUCTS_COLLECTION)
      .where('shop_id', '==', shop_id)
      .where('item_id', '==', item_id)
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      const productDoc = productsSnapshot.docs[0];
      await productDoc.ref.update({
        last_synced_at: admin.firestore.Timestamp.now(),
        sync_status: 'out_of_sync',
      });
      console.log(`[Webhook:StockChange] Produto ${productDoc.id} marcado como out_of_sync`);
    }
  } catch (err) {
    console.error('[Webhook:StockChange] Erro ao atualizar produto:', err);
  }

  // Processa cancelamento de pedido (zera estoque de cores desabilitadas)
  if (action === 'cancel_order') {
    console.log(`[Webhook:StockChange] Processando cancel_order para item ${item_id}, variation ${variation_id}`);

    const disabledColor = await findDisabledColorByVariation(shop_id, item_id, variation_id);

    if (!disabledColor) {
      console.log(`[Webhook:StockChange] Nenhuma cor desativada encontrada para item ${item_id}, variation ${variation_id}`);
      return;
    }

    console.log(`[Webhook:StockChange] Cor desativada encontrada: SKU ${disabledColor.item_sku}, cor ${disabledColor.color_option}`);

    try {
      const accessToken = await ensureValidToken(shop_id);
      
      const modelData = await callShopeeApi({
        path: '/api/v2/product/get_model_list',
        method: 'GET',
        shopId: shop_id,
        accessToken,
        query: { item_id: String(item_id) },
      }) as any;

      const model = (modelData?.response?.model || []).find((m: any) => m?.model_id === variation_id);
      const currentStock = model?.stock_info_v2?.summary_info?.total_available_stock ?? 0;

      if (currentStock === 0) {
        console.log(`[Webhook:StockChange] Estoque já zerado para variation ${variation_id}`);
        const docId = `${shop_id}_${disabledColor.item_sku}_${disabledColor.color_option}`.replace(/[^a-zA-Z0-9_]/g, '_');
        await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).update({
          last_maintained: admin.firestore.Timestamp.now(),
        });
        return;
      }

      await callShopeeApi({
        path: '/api/v2/product/update_stock',
        method: 'POST',
        shopId: shop_id,
        accessToken,
        body: {
          item_id: item_id,
          stock_list: [{ 
            model_id: variation_id, 
            seller_stock: [{ stock: 0 }] 
          }],
        },
      });

      const docId = `${shop_id}_${disabledColor.item_sku}_${disabledColor.color_option}`.replace(/[^a-zA-Z0-9_]/g, '_');
      await db.collection(DISABLED_COLORS_COLLECTION).doc(docId).update({
        last_maintained: admin.firestore.Timestamp.now(),
      });

      console.log(`[Webhook:StockChange] Estoque zerado com sucesso (era ${currentStock})`);
    } catch (error: any) {
      console.error(`[Webhook:StockChange] Erro ao zerar estoque:`, error);
      throw error;
    }
  }

  await logWebhookEvent(8, event, 'success');
}

// =====================================================================
// HANDLER: video_upload_push (code 11)
// =====================================================================

/**
 * Processa evento video_upload_push
 * Confirma processamento de vídeo e atualiza status no produto
 */
export async function processVideoUpload(event: any): Promise<void> {
  const { data } = event;

  if (!data) {
    console.warn('[Webhook:VideoUpload] Evento sem dados:', event);
    return;
  }

  const { shop_id, video_upload_id, status: videoStatus, video_url } = data;

  console.log(`[Webhook:VideoUpload] shop=${shop_id} upload_id=${video_upload_id} status=${videoStatus}`);

  try {
    // Busca produtos que podem ter este vídeo
    if (video_url) {
      const productsSnapshot = await db.collection(SHOPEE_PRODUCTS_COLLECTION)
        .where('shop_id', '==', shop_id)
        .where('video_url', '!=', null)
        .limit(10)
        .get();

      for (const doc of productsSnapshot.docs) {
        const product = doc.data();
        // Atualiza status do vídeo se relacionado
        if (product.video_upload_id === video_upload_id || product.video_url === video_url) {
          await doc.ref.update({
            video_status: videoStatus === 'SUCCEEDED' ? 'ready' : 'error',
            video_url: video_url || product.video_url,
            updated_at: admin.firestore.Timestamp.now(),
          });
          console.log(`[Webhook:VideoUpload] Produto ${doc.id} atualizado: video_status=${videoStatus}`);
        }
      }
    }

    await logWebhookEvent(11, event, 'success');
  } catch (error: any) {
    console.error('[Webhook:VideoUpload] Erro:', error);
    await logWebhookEvent(11, event, 'error', error.message);
  }
}

// =====================================================================
// HANDLER: violation_item_push (code 16)
// =====================================================================

/**
 * Processa evento violation_item_push
 * Cria alerta e atualiza status do produto para error
 */
export async function processViolation(event: any): Promise<void> {
  const { data } = event;

  if (!data) {
    console.warn('[Webhook:Violation] Evento sem dados:', event);
    return;
  }

  const { shop_id, item_id, violations } = data;

  console.log(`[Webhook:Violation] shop=${shop_id} item=${item_id} violations=${JSON.stringify(violations)}`);

  try {
    const productsSnapshot = await db.collection(SHOPEE_PRODUCTS_COLLECTION)
      .where('shop_id', '==', shop_id)
      .where('item_id', '==', item_id)
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      const productDoc = productsSnapshot.docs[0];
      const violationMessages = Array.isArray(violations)
        ? violations.map((v: any) => v.suggestion || v.violation_reason || 'Violação detectada').join('; ')
        : 'Violação detectada pela Shopee';

      await productDoc.ref.update({
        status: 'error',
        error_message: `Violação: ${violationMessages}`,
        violation_info: violations || null,
        updated_at: admin.firestore.Timestamp.now(),
        sync_status: 'error',
      });

      console.log(`[Webhook:Violation] Produto ${productDoc.id} marcado com violação`);
    } else {
      console.log(`[Webhook:Violation] Produto item_id=${item_id} não encontrado no Firestore`);
    }

    await logWebhookEvent(16, event, 'success');
  } catch (error: any) {
    console.error('[Webhook:Violation] Erro:', error);
    await logWebhookEvent(16, event, 'error', error.message);
  }
}

// =====================================================================
// HANDLER: item_price_update_push (code 22)
// =====================================================================

/**
 * Processa evento item_price_update_push
 * Sincroniza preço alterado diretamente na Shopee
 */
export async function processPriceUpdate(event: any): Promise<void> {
  const { data } = event;

  if (!data) {
    console.warn('[Webhook:PriceUpdate] Evento sem dados:', event);
    return;
  }

  const { shop_id, item_id } = data;

  console.log(`[Webhook:PriceUpdate] shop=${shop_id} item=${item_id}`);

  try {
    const productsSnapshot = await db.collection(SHOPEE_PRODUCTS_COLLECTION)
      .where('shop_id', '==', shop_id)
      .where('item_id', '==', item_id)
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      const productDoc = productsSnapshot.docs[0];

      // Busca preço atualizado da Shopee
      try {
        const accessToken = await ensureValidToken(shop_id);
        const itemInfo = await callShopeeApi({
          path: '/api/v2/product/get_item_base_info',
          method: 'GET',
          shopId: shop_id,
          accessToken,
          query: { item_id_list: String(item_id) },
        }) as any;

        const item = itemInfo?.response?.item_list?.[0];
        if (item) {
          const updateData: any = {
            updated_at: admin.firestore.Timestamp.now(),
            sync_status: 'synced',
            last_synced_at: admin.firestore.Timestamp.now(),
          };

          if (item.price_info?.[0]?.original_price) {
            updateData.preco_base = item.price_info[0].original_price;
          }

          await productDoc.ref.update(updateData);
          console.log(`[Webhook:PriceUpdate] Produto ${productDoc.id} preço sincronizado`);
        }
      } catch (apiErr: any) {
        // Se não consegue buscar o preço, marca como out_of_sync
        await productDoc.ref.update({
          sync_status: 'out_of_sync',
          updated_at: admin.firestore.Timestamp.now(),
        });
        console.error('[Webhook:PriceUpdate] Erro ao buscar preço:', apiErr);
      }
    } else {
      console.log(`[Webhook:PriceUpdate] Produto item_id=${item_id} não encontrado`);
    }

    await logWebhookEvent(22, event, 'success');
  } catch (error: any) {
    console.error('[Webhook:PriceUpdate] Erro:', error);
    await logWebhookEvent(22, event, 'error', error.message);
  }
}

// =====================================================================
// HANDLER: item_scheduled_publish_failed_push (code 27)
// =====================================================================

/**
 * Processa evento item_scheduled_publish_failed_push
 * Atualiza status do produto para error com mensagem
 */
export async function processPublishFailed(event: any): Promise<void> {
  const { data } = event;

  if (!data) {
    console.warn('[Webhook:PublishFailed] Evento sem dados:', event);
    return;
  }

  const { shop_id, item_id, fail_message, fail_reason } = data;

  console.log(`[Webhook:PublishFailed] shop=${shop_id} item=${item_id} reason=${fail_reason}`);

  try {
    const productsSnapshot = await db.collection(SHOPEE_PRODUCTS_COLLECTION)
      .where('shop_id', '==', shop_id)
      .where('item_id', '==', item_id)
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      const productDoc = productsSnapshot.docs[0];
      await productDoc.ref.update({
        status: 'error',
        error_message: `Publicação falhou: ${fail_message || fail_reason || 'Erro desconhecido'}`,
        updated_at: admin.firestore.Timestamp.now(),
        sync_status: 'error',
      });

      console.log(`[Webhook:PublishFailed] Produto ${productDoc.id} marcado como falha de publicação`);
    } else {
      console.log(`[Webhook:PublishFailed] Produto item_id=${item_id} não encontrado`);
    }

    await logWebhookEvent(27, event, 'success');
  } catch (error: any) {
    console.error('[Webhook:PublishFailed] Erro:', error);
    await logWebhookEvent(27, event, 'error', error.message);
  }
}

// =====================================================================
// HANDLER: order_status_push (code 3)
// =====================================================================

/**
 * Processa evento order_status_push
 * Registra alteração de status de pedido
 */
export async function processOrderStatus(event: any): Promise<void> {
  const { data } = event;

  if (!data) {
    console.warn('[Webhook:OrderStatus] Evento sem dados:', event);
    return;
  }

  const { shop_id, ordersn, status: orderStatus } = data;

  console.log(`[Webhook:OrderStatus] shop=${shop_id} order=${ordersn} status=${orderStatus}`);

  try {
    // Registra evento de pedido para integração futura
    await db.collection('shopee_order_events').add({
      shop_id,
      ordersn,
      status: orderStatus,
      raw_data: data,
      received_at: admin.firestore.Timestamp.now(),
      processed: false,
    });

    console.log(`[Webhook:OrderStatus] Evento de pedido registrado: ${ordersn} -> ${orderStatus}`);
    await logWebhookEvent(3, event, 'success');
  } catch (error: any) {
    console.error('[Webhook:OrderStatus] Erro:', error);
    await logWebhookEvent(3, event, 'error', error.message);
  }
}

// =====================================================================
// Utility
// =====================================================================

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
