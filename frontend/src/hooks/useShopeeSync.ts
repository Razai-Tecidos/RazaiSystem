import { useState, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface SyncResult {
  success: boolean;
  hasChanges: boolean;
  changes: string[];
  error?: string;
}

interface SyncStats {
  total: number;
  synced: number;
  withChanges: number;
  errors: number;
}

/**
 * Hook para sincronização de produtos Shopee
 */
export function useShopeeSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
  const { toast } = useToast();

  /**
   * Obtém o token de autenticação
   */
  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  /**
   * Faz requisição autenticada
   */
  const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  };

  /**
   * Sincroniza um produto específico
   */
  const syncProduct = useCallback(async (productId: string): Promise<SyncResult> => {
    try {
      setSyncing(true);
      
      const response = await apiRequest<{ success: boolean; data: SyncResult }>(
        `/api/shopee/products/${productId}/sync`,
        { method: 'POST' }
      );
      
      setLastSyncResult(response.data);
      
      if (response.data.hasChanges) {
        toast({
          title: 'Sincronizado',
          description: `${response.data.changes.length} alterações detectadas`,
        });
      } else {
        toast({
          title: 'Sincronizado',
          description: 'Nenhuma alteração detectada',
        });
      }
      
      return response.data;
    } catch (err: any) {
      const result: SyncResult = {
        success: false,
        hasChanges: false,
        changes: [],
        error: err.message,
      };
      setLastSyncResult(result);
      
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao sincronizar produto',
        variant: 'destructive',
      });
      
      return result;
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  /**
   * Sincroniza todos os produtos de uma loja
   */
  const syncAllProducts = useCallback(async (shopId: number): Promise<SyncStats | null> => {
    try {
      setSyncing(true);
      
      const response = await apiRequest<{ success: boolean; data: SyncStats }>(
        `/api/shopee/products/sync-all`,
        { 
          method: 'POST',
          body: JSON.stringify({ shop_id: shopId }),
        }
      );
      
      setLastSyncStats(response.data);
      
      toast({
        title: 'Sincronização concluída',
        description: `${response.data.synced} de ${response.data.total} produtos sincronizados. ${response.data.withChanges} com alterações.`,
      });
      
      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao sincronizar produtos',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  return {
    syncing,
    lastSyncResult,
    lastSyncStats,
    syncProduct,
    syncAllProducts,
  };
}
