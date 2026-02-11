import { useState, useCallback } from 'react';
import { LogisticsChannel } from '@/types/shopee-product.types';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UseShopeeLogisticsReturn {
  channels: LogisticsChannel[];
  enabledChannels: LogisticsChannel[];
  loading: boolean;
  error: string | null;
  loadChannels: (shopId: number, language?: string) => Promise<void>;
  loadEnabledChannels: (shopId: number, language?: string) => Promise<void>;
  validateLogistics: (shopId: number, peso: number, dimensoes: { comprimento: number; largura: number; altura: number }, language?: string) => Promise<{ compatible: number; valid: boolean }>;
  refreshCache: (shopId: number, language?: string) => Promise<void>;
}

export function useShopeeLogistics(): UseShopeeLogisticsReturn {
  const { user } = useAuth();
  const [channels, setChannels] = useState<LogisticsChannel[]>([]);
  const [enabledChannels, setEnabledChannels] = useState<LogisticsChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error('Usuário não autenticado');
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, [user]);

  const loadChannels = useCallback(async (shopId: number, language = 'pt-BR') => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/api/shopee/logistics?shop_id=${shopId}&language=${encodeURIComponent(language)}`,
        {
        headers,
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao carregar canais de logística');
      }
      
      setChannels(data.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar canais de logística:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const loadEnabledChannels = useCallback(async (shopId: number, language = 'pt-BR') => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/api/shopee/logistics/enabled?shop_id=${shopId}&language=${encodeURIComponent(language)}`,
        {
        headers,
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao carregar canais habilitados');
      }
      
      setEnabledChannels(data.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar canais habilitados:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const validateLogistics = useCallback(async (
    shopId: number, 
    peso: number, 
    dimensoes: { comprimento: number; largura: number; altura: number },
    language = 'pt-BR'
  ): Promise<{ compatible: number; valid: boolean }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/shopee/logistics/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ shop_id: shopId, peso, dimensoes, language }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        return { compatible: 0, valid: false };
      }
      
      return { 
        compatible: data.data.compatible_channels, 
        valid: data.data.compatible_channels > 0 
      };
    } catch (err: any) {
      console.error('Erro ao validar logística:', err);
      return { compatible: 0, valid: false };
    }
  }, [getAuthHeaders]);

  const refreshCache = useCallback(async (shopId: number, language = 'pt-BR') => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/shopee/logistics/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ shop_id: shopId, language }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao atualizar cache');
      }
      
      setChannels(data.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao atualizar cache de logística:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  return {
    channels,
    enabledChannels,
    loading,
    error,
    loadChannels,
    loadEnabledChannels,
    validateLogistics,
    refreshCache,
  };
}
