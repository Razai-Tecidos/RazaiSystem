import { useState, useEffect, useCallback } from 'react';
import { CorTecido, CreateCorTecidoData, UpdateCorTecidoData } from '@/types/cor.types';
import {
  createCorTecido as createCorTecidoFb,
  updateCorTecido as updateCorTecidoFb,
  deleteCorTecido as deleteCorTecidoFb,
  getCorTecidosByCorId,
  getCorTecidosByTecidoId,
  getCorTecidoByCorAndTecido,
  existsCorTecido,
  subscribeToCorTecidos,
} from '@/lib/firebase/cor-tecido';

interface UseCorTecidoReturn {
  vinculos: CorTecido[];
  loading: boolean;
  error: string | null;
  createVinculo: (data: CreateCorTecidoData) => Promise<string>;
  updateVinculo: (data: UpdateCorTecidoData) => Promise<void>;
  deleteVinculo: (id: string) => Promise<void>;
  getVinculosByCor: (corId: string) => Promise<CorTecido[]>;
  getVinculosByTecido: (tecidoId: string) => Promise<CorTecido[]>;
  getVinculo: (corId: string, tecidoId: string) => Promise<CorTecido | null>;
  vinculoExists: (corId: string, tecidoId: string) => Promise<boolean>;
  contarVinculosPorCor: (corId: string) => number;
}

/**
 * Hook para gerenciar vínculos cor-tecido
 * Fornece CRUD e listeners em tempo real
 */
export function useCorTecido(): UseCorTecidoReturn {
  const [vinculos, setVinculos] = useState<CorTecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listener em tempo real para todos os vínculos
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCorTecidos((newVinculos) => {
      setVinculos(newVinculos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Cria um novo vínculo cor-tecido
   */
  const createVinculo = useCallback(async (data: CreateCorTecidoData): Promise<string> => {
    try {
      // Verificar se já existe vínculo
      const exists = await existsCorTecido(data.corId, data.tecidoId);
      if (exists) {
        throw new Error('Já existe um vínculo entre esta cor e este tecido');
      }

      const id = await createCorTecidoFb(data);
      return id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Atualiza um vínculo existente
   */
  const updateVinculo = useCallback(async (data: UpdateCorTecidoData): Promise<void> => {
    try {
      await updateCorTecidoFb(data);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Remove um vínculo (soft delete)
   */
  const deleteVinculo = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteCorTecidoFb(id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Busca vínculos por cor
   */
  const getVinculosByCor = useCallback(async (corId: string): Promise<CorTecido[]> => {
    return getCorTecidosByCorId(corId);
  }, []);

  /**
   * Busca vínculos por tecido
   */
  const getVinculosByTecido = useCallback(async (tecidoId: string): Promise<CorTecido[]> => {
    return getCorTecidosByTecidoId(tecidoId);
  }, []);

  /**
   * Busca vínculo específico por cor e tecido
   */
  const getVinculo = useCallback(async (corId: string, tecidoId: string): Promise<CorTecido | null> => {
    return getCorTecidoByCorAndTecido(corId, tecidoId);
  }, []);

  /**
   * Verifica se vínculo existe
   */
  const vinculoExists = useCallback(async (corId: string, tecidoId: string): Promise<boolean> => {
    return existsCorTecido(corId, tecidoId);
  }, []);

  /**
   * Conta vínculos de uma cor (usando dados em memória)
   */
  const contarVinculosPorCor = useCallback((corId: string): number => {
    return vinculos.filter(v => v.corId === corId).length;
  }, [vinculos]);

  return {
    vinculos,
    loading,
    error,
    createVinculo,
    updateVinculo,
    deleteVinculo,
    getVinculosByCor,
    getVinculosByTecido,
    getVinculo,
    vinculoExists,
    contarVinculosPorCor,
  };
}

/**
 * Hook simplificado para vínculos de uma cor específica
 */
export function useCorTecidoByCor(corId: string | undefined) {
  const [vinculos, setVinculos] = useState<CorTecido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!corId) {
      setVinculos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getCorTecidosByCorId(corId)
      .then(setVinculos)
      .finally(() => setLoading(false));
  }, [corId]);

  return { vinculos, loading };
}

/**
 * Hook simplificado para vínculos de um tecido específico
 */
export function useCorTecidoByTecido(tecidoId: string | undefined) {
  const [vinculos, setVinculos] = useState<CorTecido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tecidoId) {
      setVinculos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getCorTecidosByTecidoId(tecidoId)
      .then(setVinculos)
      .finally(() => setLoading(false));
  }, [tecidoId]);

  return { vinculos, loading };
}
