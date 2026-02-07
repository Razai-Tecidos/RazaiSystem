import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { Tamanho, CreateTamanhoData, UpdateTamanhoData } from '@/types/tamanho.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Hook para gerenciar tamanhos
 */
export function useTamanhos() {
  const [tamanhos, setTamanhos] = useState<Tamanho[]>([]);
  const [loading, setLoading] = useState(true);
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
   * Carrega tamanhos
   */
  const loadTamanhos = useCallback(async (includeInactive = false) => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: Tamanho[] }>(
        `/api/tamanhos${includeInactive ? '?includeInactive=true' : ''}`
      );
      setTamanhos(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os tamanhos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Cria um novo tamanho
   */
  const createTamanho = useCallback(async (data: CreateTamanhoData): Promise<Tamanho | null> => {
    try {
      const response = await apiRequest<{ success: boolean; data: Tamanho }>(
        '/api/tamanhos',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      setTamanhos(prev => [...prev, response.data].sort((a, b) => a.ordem - b.ordem));

      toast({
        title: 'Sucesso!',
        description: 'Tamanho criado com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao criar tamanho',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  /**
   * Atualiza um tamanho
   */
  const updateTamanho = useCallback(async (id: string, data: UpdateTamanhoData): Promise<Tamanho | null> => {
    try {
      const response = await apiRequest<{ success: boolean; data: Tamanho }>(
        `/api/tamanhos/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      setTamanhos(prev => 
        prev.map(t => t.id === id ? response.data : t).sort((a, b) => a.ordem - b.ordem)
      );

      toast({
        title: 'Sucesso!',
        description: 'Tamanho atualizado com sucesso',
      });

      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao atualizar tamanho',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  /**
   * Exclui um tamanho
   */
  const deleteTamanho = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiRequest<{ success: boolean }>(
        `/api/tamanhos/${id}`,
        { method: 'DELETE' }
      );

      setTamanhos(prev => prev.filter(t => t.id !== id));

      toast({
        title: 'Sucesso!',
        description: 'Tamanho excluído com sucesso',
      });

      return true;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao excluir tamanho',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  /**
   * Reordena tamanhos
   */
  const reorderTamanhos = useCallback(async (orderedIds: string[]): Promise<boolean> => {
    try {
      await apiRequest<{ success: boolean }>(
        '/api/tamanhos/reorder',
        {
          method: 'POST',
          body: JSON.stringify({ orderedIds }),
        }
      );

      // Reordena localmente
      const reordered = orderedIds
        .map((id, index) => {
          const tamanho = tamanhos.find(t => t.id === id);
          return tamanho ? { ...tamanho, ordem: index + 1 } : null;
        })
        .filter(Boolean) as Tamanho[];

      setTamanhos(reordered);

      return true;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao reordenar tamanhos',
        variant: 'destructive',
      });
      return false;
    }
  }, [tamanhos, toast]);

  // Carrega tamanhos ao montar
  useEffect(() => {
    loadTamanhos();
  }, [loadTamanhos]);

  return {
    tamanhos,
    loading,
    error,
    loadTamanhos,
    createTamanho,
    updateTamanho,
    deleteTamanho,
    reorderTamanhos,
  };
}
