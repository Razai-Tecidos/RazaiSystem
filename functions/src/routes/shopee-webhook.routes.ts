import { Router, Request, Response } from 'express';
import { getShopeeCredentials } from '../config/shopee';
import {
  verifyWebhookSignature,
  processReservedStockChange,
  processVideoUpload,
  processViolation,
  processPriceUpdate,
  processPublishFailed,
  processOrderStatus,
} from '../services/shopee-webhook.service';

const router = Router();

/**
 * POST /api/shopee/webhook
 * Handler de webhooks da Shopee (Push Mechanism)
 * 
 * Códigos suportados:
 * - 3:  order_status_push
 * - 8:  reserved_stock_change_push
 * - 11: video_upload_push
 * - 16: violation_item_push
 * - 22: item_price_update_push
 * - 27: item_scheduled_publish_failed_push
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verificar assinatura
    const signature = req.headers['x-shopee-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Se não há assinatura, pode ser requisição de teste da Shopee
    if (!signature) {
      console.log('[Webhook] Requisição sem assinatura - pode ser teste da Shopee');
      return res.status(200).json({ 
        success: true,
        message: 'Webhook endpoint está funcionando. Configure a assinatura para processar eventos.',
      });
    }

    const { partnerKey } = getShopeeCredentials();
    const isValid = verifyWebhookSignature(signature, rawBody, partnerKey);

    if (!isValid) {
      console.warn('[Webhook] Assinatura inválida');
      return res.status(200).json({
        success: false,
        error: 'Assinatura inválida',
      });
    }

    const { code } = req.body;
    console.log(`[Webhook] Evento recebido - code: ${code}`);

    // Retorna 200 rapidamente e processa em background
    res.status(200).json({ success: true });

    // Roteia para o handler correto baseado no código
    switch (code) {
      case 3:
        await processOrderStatus(req.body);
        break;
      case 8:
        await processReservedStockChange(req.body);
        break;
      case 11:
        await processVideoUpload(req.body);
        break;
      case 16:
        await processViolation(req.body);
        break;
      case 22:
        await processPriceUpdate(req.body);
        break;
      case 27:
        await processPublishFailed(req.body);
        break;
      default:
        console.log(`[Webhook] Evento não tratado (code: ${code})`);
    }

    return;
  } catch (error: any) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    // Retorna 200 mesmo em caso de erro para não causar retry desnecessário
    if (!res.headersSent) {
      return res.status(200).json({
        success: false,
        error: error.message,
      });
    }
    return;
  }
});

export default router;
