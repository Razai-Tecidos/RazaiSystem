import { useState, useCallback, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { ShopeeUserPreferences } from '@/types/shopee-product.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Dados para atualizar preferências
 */
interface UpdatePreferencesData {
  preco_base_padrao?: number;
  estoque_padrao_padrao?: number;
  categoria_id_padrao?: number;
  peso_padrao?: number;
  dimensoes_padrao?: {
    comprimento: number;
    largura?: number;
    altura: number;
  };
  usar_imagens_publicas_padrao?: boolean;
  descricao_template?: string;
}

/**
 * Hook para gerenciar preferências do usuário para Shopee
 */
export function useShopeePreferences() {
  const [preferences, setPreferences] = useState<ShopeeUserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
   * Carrega preferências do usuário
   */
  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeUserPreferences | null }>(
        '/api/shopee/preferences'
      );
      setPreferences(response.data);
      setError(null);
      return response.data;
    } catch (err: any) {
      setError(err.message);
      // Não mostra toast pois pode não ter preferências ainda
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Salva/atualiza preferências
   */
  const savePreferences = useCallback(async (data: UpdatePreferencesData): Promise<ShopeeUserPreferences | null> => {
    try {
      setSaving(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeUserPreferences }>(
        '/api/shopee/preferences',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      setPreferences(response.data);

      toast({
        title: 'Sucesso!',
        description: 'Preferências salvas com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar preferências',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Reseta preferências para padrões do sistema
   */
  const resetPreferences = useCallback(async (): Promise<boolean> => {
    try {
      setSaving(true);
      await apiRequest<{ success: boolean }>(
        '/api/shopee/preferences',
        { method: 'DELETE' }
      );

      setPreferences(null);

      toast({
        title: 'Sucesso!',
        description: 'Preferências resetadas para os padrões do sistema',
      });

      return true;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao resetar preferências',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  // Carrega preferências ao montar
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      loadPreferences();
    }
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    saving,
    error,
    loadPreferences,
    savePreferences,
    resetPreferences,
  };
}
