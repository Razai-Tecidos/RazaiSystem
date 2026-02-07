import { useState, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { 
  ShopeeProduct, 
  CreateShopeeProductData,
  DefaultFormValues,
} from '@/types/shopee-product.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Hook para gerenciar produtos/anúncios Shopee
 */
export function useShopeeProducts() {
  const [products, setProducts] = useState<ShopeeProduct[]>([]);
  const [currentProduct, setCurrentProduct] = useState<ShopeeProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
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
   * Lista produtos/rascunhos
   */
  const loadProducts = useCallback(async (shopId?: number, status?: string) => {
    try {
      setLoading(true);
      let url = '/api/shopee/products';
      const params = new URLSearchParams();
      if (shopId) params.append('shop_id', shopId.toString());
      if (status) params.append('status', status);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await apiRequest<{ success: boolean; data: ShopeeProduct[] }>(url);
      setProducts(response.data);
      setError(null);
      return response.data;
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Busca um produto por ID
   */
  const getProduct = useCallback(async (id: string): Promise<ShopeeProduct | null> => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProduct }>(
        `/api/shopee/products/${id}`
      );
      setCurrentProduct(response.data);
      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Produto não encontrado',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Cria um novo produto/rascunho
   */
  const createProduct = useCallback(async (data: CreateShopeeProductData): Promise<ShopeeProduct | null> => {
    try {
      setSaving(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProduct }>(
        '/api/shopee/products',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      setProducts(prev => [response.data, ...prev]);
      setCurrentProduct(response.data);

      toast({
        title: 'Sucesso!',
        description: 'Rascunho salvo com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar rascunho',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Atualiza um produto/rascunho
   */
  const updateProduct = useCallback(async (
    id: string, 
    data: Partial<CreateShopeeProductData>
  ): Promise<ShopeeProduct | null> => {
    try {
      setSaving(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProduct }>(
        `/api/shopee/products/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      setProducts(prev => prev.map(p => p.id === id ? response.data : p));
      setCurrentProduct(response.data);

      toast({
        title: 'Sucesso!',
        description: 'Rascunho atualizado com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao atualizar rascunho',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Exclui um produto/rascunho
   */
  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiRequest<{ success: boolean }>(
        `/api/shopee/products/${id}`,
        { method: 'DELETE' }
      );

      setProducts(prev => prev.filter(p => p.id !== id));
      if (currentProduct?.id === id) {
        setCurrentProduct(null);
      }

      toast({
        title: 'Sucesso!',
        description: 'Produto excluído com sucesso',
      });

      return true;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao excluir produto',
        variant: 'destructive',
      });
      return false;
    }
  }, [currentProduct, toast]);

  /**
   * Publica um rascunho na Shopee
   */
  const publishProduct = useCallback(async (id: string): Promise<ShopeeProduct | null> => {
    try {
      setPublishing(true);
      const response = await apiRequest<{ success: boolean; data: ShopeeProduct }>(
        `/api/shopee/products/${id}/publish`,
        { method: 'POST' }
      );

      setProducts(prev => prev.map(p => p.id === id ? response.data : p));
      setCurrentProduct(response.data);

      toast({
        title: 'Sucesso!',
        description: 'Produto publicado na Shopee com sucesso!',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao publicar produto',
        variant: 'destructive',
      });
      return null;
    } finally {
      setPublishing(false);
    }
  }, [toast]);

  /**
   * Busca valores padrão para o formulário
   */
  const getDefaultValues = useCallback(async (tecidoLargura?: number): Promise<DefaultFormValues | null> => {
    try {
      let url = '/api/shopee/preferences/defaults';
      if (tecidoLargura) {
        url += `?tecido_largura=${tecidoLargura}`;
      }

      const response = await apiRequest<{ success: boolean; data: DefaultFormValues }>(url);
      return response.data;
    } catch (err: any) {
      console.error('Erro ao buscar valores padrão:', err);
      // Retorna valores padrão do sistema
      return {
        peso: 0.1,
        dimensoes: {
          comprimento: 100,
          largura: tecidoLargura ? tecidoLargura * 100 : 150,
          altura: 1,
        },
        usar_imagens_publicas: true,
      };
    }
  }, []);

  /**
   * Filtra produtos por status
   */
  const getProductsByStatus = useCallback((status: ShopeeProduct['status']): ShopeeProduct[] => {
    return products.filter(p => p.status === status);
  }, [products]);

  /**
   * Conta produtos por status
   */
  const countByStatus = useCallback(() => {
    return {
      draft: products.filter(p => p.status === 'draft').length,
      publishing: products.filter(p => p.status === 'publishing').length,
      created: products.filter(p => p.status === 'created').length,
      error: products.filter(p => p.status === 'error').length,
    };
  }, [products]);

  return {
    products,
    currentProduct,
    loading,
    saving,
    publishing,
    error,
    loadProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    publishProduct,
    getDefaultValues,
    getProductsByStatus,
    countByStatus,
    setCurrentProduct,
  };
}
