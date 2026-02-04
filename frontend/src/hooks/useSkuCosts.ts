import { useState, useCallback } from 'react';
import {
  SkuCost,
  CreateSkuCostData,
  UpdateSkuCostData,
} from '@/types/shopee-pricing.types';
import {
  getSkuCosts,
  getSkuCost,
  upsertSkuCost,
  updateSkuCost,
  deleteSkuCost,
  importSkuCosts,
  calcularPrecoSugerido,
} from '@/lib/firebase/shopee-pricing';
import { useToast } from '@/hooks/use-toast';

interface UseSkuCostsReturn {
  // Estado
  costs: SkuCost[];
  loading: boolean;
  error: string | null;
  
  // Ações
  loadCosts: (shopId: number) => Promise<void>;
  getCost: (shopId: number, itemSku: string) => Promise<SkuCost | null>;
  saveCost: (data: CreateSkuCostData) => Promise<SkuCost | null>;
  updateCost: (shopId: number, itemSku: string, data: UpdateSkuCostData) => Promise<boolean>;
  removeCost: (shopId: number, itemSku: string) => Promise<boolean>;
  importCosts: (shopId: number, costs: Array<{
    item_sku: string;
    custo_unitario: number;
    margem_minima?: number;
    margem_target?: number;
  }>) => Promise<{ success: number; errors: Array<{ sku: string; error: string }> }>;
  
  // Helpers
  calcularPreco: (custoUnitario: number, margemDesejada: number, comFreteGratis?: boolean) => number;
}

export function useSkuCosts(): UseSkuCostsReturn {
  const [costs, setCosts] = useState<SkuCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadCosts = useCallback(async (shopId: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSkuCosts(shopId);
      setCosts(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar custos';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getCost = useCallback(async (shopId: number, itemSku: string): Promise<SkuCost | null> => {
    try {
      return await getSkuCost(shopId, itemSku);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar custo';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const saveCost = useCallback(async (data: CreateSkuCostData): Promise<SkuCost | null> => {
    try {
      setLoading(true);
      const result = await upsertSkuCost(data);
      
      // Atualiza lista local
      setCosts((prev) => {
        const exists = prev.find((c) => c.item_sku === data.item_sku);
        if (exists) {
          return prev.map((c) => (c.item_sku === data.item_sku ? result : c));
        }
        return [...prev, result];
      });

      toast({
        title: 'Sucesso',
        description: `Custo do SKU ${data.item_sku} salvo`,
      });

      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar custo';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateCostFn = useCallback(async (
    shopId: number,
    itemSku: string,
    data: UpdateSkuCostData
  ): Promise<boolean> => {
    try {
      setLoading(true);
      await updateSkuCost(shopId, itemSku, data);
      
      // Atualiza lista local
      setCosts((prev) =>
        prev.map((c) =>
          c.item_sku === itemSku && c.shop_id === shopId
            ? { ...c, ...data }
            : c
        )
      );

      toast({
        title: 'Sucesso',
        description: `Custo do SKU ${itemSku} atualizado`,
      });

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar custo';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const removeCost = useCallback(async (shopId: number, itemSku: string): Promise<boolean> => {
    try {
      setLoading(true);
      await deleteSkuCost(shopId, itemSku);
      
      // Remove da lista local
      setCosts((prev) =>
        prev.filter((c) => !(c.item_sku === itemSku && c.shop_id === shopId))
      );

      toast({
        title: 'Sucesso',
        description: `Custo do SKU ${itemSku} removido`,
      });

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover custo';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const importCostsFn = useCallback(async (
    shopId: number,
    costsData: Array<{
      item_sku: string;
      custo_unitario: number;
      margem_minima?: number;
      margem_target?: number;
    }>
  ): Promise<{ success: number; errors: Array<{ sku: string; error: string }> }> => {
    try {
      setLoading(true);
      const result = await importSkuCosts(shopId, costsData);
      
      // Recarrega lista completa
      await loadCosts(shopId);

      if (result.errors.length > 0) {
        toast({
          title: 'Importação parcial',
          description: `${result.success} importados, ${result.errors.length} erros`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `${result.success} custos importados`,
        });
      }

      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar custos';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: 0, errors: [{ sku: 'geral', error: errorMessage }] };
    } finally {
      setLoading(false);
    }
  }, [toast, loadCosts]);

  return {
    costs,
    loading,
    error,
    loadCosts,
    getCost,
    saveCost,
    updateCost: updateCostFn,
    removeCost,
    importCosts: importCostsFn,
    calcularPreco: calcularPrecoSugerido,
  };
}
