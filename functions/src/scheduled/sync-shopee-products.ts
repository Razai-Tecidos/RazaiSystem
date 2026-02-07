import * as functions from 'firebase-functions';
import { syncAllShops } from '../services/shopee-sync.service';

/**
 * Função agendada para sincronizar produtos Shopee
 * Executa a cada 6 horas
 */
export const scheduledSyncShopeeProducts = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutos
    memory: '512MB',
  })
  .pubsub
  .schedule('every 6 hours')
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    console.log('Iniciando sincronização agendada de produtos Shopee...');
    
    try {
      const stats = await syncAllShops();
      
      console.log('Sincronização concluída:', {
        shops: stats.shops,
        total: stats.total,
        synced: stats.synced,
        withChanges: stats.withChanges,
        errors: stats.errors,
      });
      
      return null;
    } catch (error: any) {
      console.error('Erro na sincronização agendada:', error);
      throw error;
    }
  });
