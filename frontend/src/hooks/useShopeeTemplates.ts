import { useState, useCallback, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { ShopeeProductTemplate } from '@/types/shopee-product.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Dados para criar um template
 */
interface CreateTemplateData {
  nome: string;
  descricao?: string;
  categoria_id?: number;
  categoria_nome?: string;
  preco_base?: number;
  estoque_padrao?: number;
  peso?: number;
  dimensoes?: {
    comprimento: number;
    largura?: number;
    altura: number;
  };
  descricao_template?: string;
  usar_imagens_publicas?: boolean;
  incluir_tamanhos?: boolean;
  tamanhos_padrao?: string[];
}

/**
 * Hook para gerenciar templates de anúncios Shopee
 */
export function useShopeeTemplates() {
  const [templates, setTemplates] = useState<ShopeeProductTemplate[]>([]);
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
   * Carrega templates
   */
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProductTemplate[] }>(
        '/api/shopee/templates'
      );
      setTemplates(response.data);
      setError(null);
      return response.data;
    } catch (err: any) {
      setError(err.message);
      // Não mostra toast pois pode não ter templates ainda
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Busca template por ID
   */
  const getTemplate = useCallback(async (id: string): Promise<ShopeeProductTemplate | null> => {
    try {
      const response = await apiRequest<{ success: boolean; data: ShopeeProductTemplate }>(
        `/api/shopee/templates/${id}`
      );
      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Template não encontrado',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  /**
   * Cria um novo template
   */
  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<ShopeeProductTemplate | null> => {
    try {
      setSaving(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProductTemplate }>(
        '/api/shopee/templates',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      setTemplates(prev => [response.data, ...prev]);

      toast({
        title: 'Sucesso!',
        description: 'Template criado com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao criar template',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Atualiza um template
   */
  const updateTemplate = useCallback(async (
    id: string, 
    data: Partial<CreateTemplateData>
  ): Promise<ShopeeProductTemplate | null> => {
    try {
      setSaving(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProductTemplate }>(
        `/api/shopee/templates/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      setTemplates(prev => prev.map(t => t.id === id ? response.data : t));

      toast({
        title: 'Sucesso!',
        description: 'Template atualizado com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao atualizar template',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Exclui um template
   */
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiRequest<{ success: boolean }>(
        `/api/shopee/templates/${id}`,
        { method: 'DELETE' }
      );

      setTemplates(prev => prev.filter(t => t.id !== id));

      toast({
        title: 'Sucesso!',
        description: 'Template excluído com sucesso',
      });

      return true;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao excluir template',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Carrega templates ao montar
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      loadTemplates();
    }
  }, [loadTemplates]);

  return {
    templates,
    loading,
    saving,
    error,
    loadTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
