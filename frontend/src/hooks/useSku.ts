import { useState, useCallback } from 'react';
import {
  getSkuControl,
  updateSkuControl,
  addInvalidatedSku as addInvalidatedSkuFirebase,
} from '@/lib/firebase/tecidos';

/**
 * Hook para gerenciar geração e invalidação de SKUs
 */
export function useSku() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Gera o próximo SKU disponível
   * Formato: T001, T002, T003, etc.
   */
  const generateNextSku = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      let control = await getSkuControl();

      // Se não existe controle, criar inicial
      if (!control) {
        control = {
          lastSkuNumber: 0,
          invalidatedSkus: [],
        };
      }

      // Incrementar número do SKU
      const nextNumber = control.lastSkuNumber + 1;
      const newSku = `T${nextNumber.toString().padStart(3, '0')}`;

      // Atualizar controle no Firebase
      await updateSkuControl(nextNumber, control.invalidatedSkus);

      setLoading(false);
      return newSku;
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar SKU');
      setLoading(false);
      throw err;
    }
  }, []);

  /**
   * Invalida um SKU (adiciona ao array de SKUs inválidos)
   */
  const invalidateSku = useCallback(async (sku: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await addInvalidatedSkuFirebase(sku);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao invalidar SKU');
      setLoading(false);
      throw err;
    }
  }, []);

  return {
    generateNextSku,
    invalidateSku,
    loading,
    error,
  };
}
