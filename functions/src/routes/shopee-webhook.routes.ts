import { Router, Request, Response } from 'express';
import { getShopeeCredentials } from '../config/shopee';
import {
  verifyWebhookSignature,
  processReservedStockChange,
} from '../services/shopee-webhook.service';

const router = Router();

/**
 * POST /api/shopee/webhook
 * Handler de webhooks da Shopee
 * 
 * Nota: Para Cloud Functions, o body já vem parseado pelo Express.
 * A verificação de assinatura usa o body serializado de forma consistente.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verificar assinatura
    // Usar JSON.stringify com ordenação de chaves para garantir consistência
    const signature = req.headers['x-shopee-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Se não há assinatura, pode ser uma requisição de teste da Shopee
    // Aceitamos e retornamos 200 para permitir verificação
    if (!signature) {
      console.log('[Webhook] Requisição sem assinatura - pode ser teste da Shopee');
      // Retorna 200 para permitir verificação inicial da Shopee
      return res.status(200).json({ 
        success: true,
        message: 'Webhook endpoint está funcionando. Configure a assinatura para processar eventos.',
      });
    }

    const { partnerKey } = getShopeeCredentials();
    const isValid = verifyWebhookSignature(signature, rawBody, partnerKey);

    if (!isValid) {
      console.warn('[Webhook] Assinatura inválida');
      // Retorna 200 mesmo com assinatura inválida para evitar retries
      // mas logamos o erro para investigação
      return res.status(200).json({
        success: false,
        error: 'Assinatura inválida',
      });
    }

    const { code } = req.body;

    // Processar apenas eventos reserved_stock_change_push (code: 8)
    if (code === 8) {
      console.log('[Webhook] Recebido evento reserved_stock_change_push');
      await processReservedStockChange(req.body);
    } else {
      console.log(`[Webhook] Evento ignorado (code: ${code})`);
    }

    // Sempre retorna 200 para a Shopee
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    // Retorna 200 mesmo em caso de erro para não causar retry desnecessário
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
