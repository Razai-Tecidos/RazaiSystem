import { useState, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { ShopeeCategory } from '@/types/shopee-product.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Hook para gerenciar categorias Shopee
 */
export function useShopeeCategories() {
  const [categories, setCategories] = useState<ShopeeCategory[]>([]);
  const [loading, setLoading] = useState(false);
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
   * Carrega todas as categorias
   * @param shopId - ID da loja
   * @param forceRefresh - Forçar atualização do cache
   * @param silent - Se true, não exibe toast de erro (útil para carregamento inicial)
   */
  const loadCategories = useCallback(async (shopId: number, forceRefresh = false, silent = false) => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeCategory[] }>(
        `/api/shopee/categories?shop_id=${shopId}${forceRefresh ? '&refresh=true' : ''}`
      );
      setCategories(response.data);
      setError(null);
      return response.data;
    } catch (err: any) {
      setError(err.message);
      console.warn('Erro ao carregar categorias:', err.message);
      if (!silent) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as categorias',
          variant: 'destructive',
        });
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Busca subcategorias de uma categoria pai
   */
  const getSubcategories = useCallback(async (shopId: number, parentId?: number): Promise<ShopeeCategory[]> => {
    try {
      const response = await apiRequest<{ success: boolean; data: ShopeeCategory[] }>(
        `/api/shopee/categories/subcategories?shop_id=${shopId}${parentId ? `&parent_id=${parentId}` : ''}`
      );
      return response.data;
    } catch (err: any) {
      console.error('Erro ao buscar subcategorias:', err);
      return [];
    }
  }, []);

  /**
   * Busca caminho completo de uma categoria (breadcrumb)
   */
  const getCategoryPath = useCallback(async (shopId: number, categoryId: number): Promise<ShopeeCategory[]> => {
    try {
      const response = await apiRequest<{ success: boolean; data: ShopeeCategory[] }>(
        `/api/shopee/categories/${categoryId}/path?shop_id=${shopId}`
      );
      return response.data;
    } catch (err: any) {
      console.error('Erro ao buscar caminho da categoria:', err);
      return [];
    }
  }, []);

  /**
   * Busca atributos de uma categoria
   */
  const getCategoryAttributes = useCallback(async (shopId: number, categoryId: number): Promise<unknown[]> => {
    try {
      const response = await apiRequest<{ success: boolean; data: unknown[] }>(
        `/api/shopee/categories/${categoryId}/attributes?shop_id=${shopId}`
      );
      return response.data;
    } catch (err: any) {
      console.error('Erro ao buscar atributos:', err);
      return [];
    }
  }, []);

  /**
   * Força atualização do cache de categorias
   */
  const refreshCategories = useCallback(async (shopId: number): Promise<ShopeeCategory[]> => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeCategory[] }>(
        '/api/shopee/categories/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ shop_id: shopId }),
        }
      );
      setCategories(response.data);
      toast({
        title: 'Sucesso!',
        description: 'Categorias atualizadas com sucesso',
      });
      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao atualizar categorias',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Filtra categorias por nível
   */
  const getCategoriesByLevel = useCallback((level: number): ShopeeCategory[] => {
    return categories.filter(c => c.level === level);
  }, [categories]);

  /**
   * Busca categoria por ID
   */
  const getCategoryById = useCallback((categoryId: number): ShopeeCategory | undefined => {
    return categories.find(c => c.id === categoryId);
  }, [categories]);

  /**
   * Busca categorias filhas de uma categoria
   */
  const getChildCategories = useCallback((parentId: number): ShopeeCategory[] => {
    return categories.filter(c => c.parent_category_id === parentId);
  }, [categories]);

  /**
   * Busca categorias raiz (sem pai)
   */
  const getRootCategories = useCallback((): ShopeeCategory[] => {
    return categories.filter(c => !c.parent_category_id);
  }, [categories]);

  return {
    categories,
    loading,
    error,
    loadCategories,
    getSubcategories,
    getCategoryPath,
    getCategoryAttributes,
    refreshCategories,
    getCategoriesByLevel,
    getCategoryById,
    getChildCategories,
    getRootCategories,
  };
}
