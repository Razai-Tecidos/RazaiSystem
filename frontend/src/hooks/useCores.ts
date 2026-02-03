import { useState, useEffect, useCallback } from 'react';
import { Cor, CreateCorData, UpdateCorData } from '@/types/cor.types';
import {
  getCores as getCoresFirebase,
  createCor as createCorFirebase,
  updateCor as updateCorFirebase,
  deleteCor as deleteCorFirebase,
  gerarSkuPorFamilia,
  isNomePadrao,
} from '@/lib/firebase/cores';
import { useToast } from '@/hooks/use-toast';

interface CorWithStatus extends Cor {
  _status?: 'saving' | 'deleting' | 'idle';
  _tempId?: string; // Para cores temporárias na UI otimista
}

/**
 * Hook para operações CRUD de cores com UI otimista
 */
export function useCores() {
  const [cores, setCores] = useState<CorWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Carregar cores ao montar componente
  useEffect(() => {
    loadCores();
  }, []);

  /**
   * Carrega todas as cores do Firebase
   */
  const loadCores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCoresFirebase();
      setCores(data.map((c) => ({ ...c, _status: 'idle' as const })));
    } catch (err: any) {
      // Erros esperados que não devem ser tratados como erro crítico:
      // - permission-denied: permissão negada (usuário não autenticado ou sem permissão)
      // - failed-precondition: índice não criado (já tem fallback)
      // - not-found: coleção não existe ainda (estado válido)
      // - unavailable: serviço temporariamente indisponível
      
      const isErroEsperado = 
        err.code === 'permission-denied' ||
        err.code === 'failed-precondition' ||
        err.code === 'not-found' ||
        err.code === 'unavailable';
      
      if (isErroEsperado) {
        // Para erros esperados, apenas logar e continuar com lista vazia
        console.warn('Erro esperado ao carregar cores:', err.code, err.message);
        setCores([]); // Lista vazia é um estado válido
        setError(null); // Não marcar como erro
      } else {
        // Para erros críticos, marcar como erro mas não mostrar toast no carregamento inicial
        const errorMessage = err.message || 'Erro ao carregar cores';
        setError(errorMessage);
        console.error('Erro crítico ao carregar cores:', err);
        // Não mostrar toast no carregamento inicial para não incomodar o usuário
        // O erro fica disponível no estado 'error' caso seja necessário exibir na UI
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Gera SKU baseado na família da cor
   * Retorna null se o nome for padrão "Cor capturada"
   */
  const generateSkuFromName = useCallback(async (nome: string): Promise<string | null> => {
    const result = await gerarSkuPorFamilia(nome);
    return result.sku;
  }, []);

  /**
   * Cria uma nova cor com UI otimista
   */
  const createCor = useCallback(
    async (data: CreateCorData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      const isPadrao = isNomePadrao(data.nome);

      // Criar cor temporária para UI otimista
      const tempCor: CorWithStatus = {
        id: tempId,
        nome: data.nome,
        codigoHex: data.codigoHex,
        sku: isPadrao ? undefined : '...', // Sem SKU se for nome padrão
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      // Adicionar temporária à lista
      setCores((prev) => [tempCor, ...prev]);

      toast({
        title: 'Cadastrando...',
        description: 'Cor sendo cadastrada...',
      });

      try {
        // Gerar SKU apenas se não for nome padrão
        const sku = await generateSkuFromName(data.nome);

        // Criar documento
        const createdCor = await createCorFirebase(data, sku);

        // Atualizar lista removendo temporária e adicionando real
        setCores((prev) => [
          { ...createdCor, _status: 'idle' as const },
          ...prev.filter((c) => c._tempId !== tempId).map((c) => ({ ...c, _status: 'idle' as const })),
        ]);

        toast({
          title: 'Sucesso!',
          description: sku 
            ? `Cor cadastrada com SKU ${sku}!`
            : 'Cor cadastrada! Renomeie para gerar o SKU.',
        });
      } catch (err: any) {
        // Remover temporária em caso de erro
        setCores((prev) => prev.filter((c) => c._tempId !== tempId));

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao cadastrar cor',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [generateSkuFromName, toast]
  );

  /**
   * Atualiza uma cor existente
   * Se a cor não tinha SKU e o novo nome não é padrão, gera SKU
   */
  const updateCor = useCallback(
    async (data: UpdateCorData): Promise<void> => {
      const corIndex = cores.findIndex((c) => c.id === data.id);
      if (corIndex === -1) return;

      const originalCor = cores[corIndex];

      // Atualizar otimisticamente
      setCores((prev) =>
        prev.map((c) =>
          c.id === data.id ? { ...c, ...data, _status: 'saving' as const } : c
        )
      );

      toast({
        title: 'Atualizando...',
        description: 'Cor sendo atualizada...',
      });

      try {
        // Verificar se precisa gerar SKU
        // (cor não tem SKU e o novo nome não é padrão)
        let novoSku: string | null = null;
        const nomeAtualizado = data.nome || originalCor.nome;
        
        if (!originalCor.sku && data.nome && !isNomePadrao(data.nome)) {
          // Gerar SKU para a cor que foi renomeada
          novoSku = await generateSkuFromName(nomeAtualizado);
        }

        // Atualizar documento (incluindo SKU se gerado)
        await updateCorFirebase(data.id, {
          ...data,
          ...(novoSku ? { sku: novoSku } : {}),
        });

        // Recarregar cores para ter dados atualizados
        await loadCores();

        toast({
          title: 'Sucesso!',
          description: novoSku 
            ? `Cor atualizada! SKU gerado: ${novoSku}`
            : 'Cor atualizada com sucesso!',
        });
      } catch (err: any) {
        // Restaurar estado original
        setCores((prev) =>
          prev.map((c) =>
            c.id === data.id ? { ...originalCor, _status: 'idle' as const } : c
          )
        );

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao atualizar cor',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [cores, loadCores, toast, generateSkuFromName]
  );

  /**
   * Exclui uma cor com UI otimista
   */
  const deleteCor = useCallback(
    async (id: string): Promise<void> => {
      const cor = cores.find((c) => c.id === id);
      if (!cor) return;

      // Remover otimisticamente
      setCores((prev) => prev.filter((c) => c.id !== id));

      toast({
        title: 'Excluindo...',
        description: 'Cor sendo excluída...',
      });

      try {
        // Deletar do Firebase (soft delete)
        await deleteCorFirebase(id);

        toast({
          title: 'Sucesso!',
          description: 'Cor excluída com sucesso!',
        });
      } catch (err: any) {
        // Restaurar cor em caso de erro
        setCores((prev) => [...prev, { ...cor, _status: 'idle' as const }]);

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao excluir cor',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [cores, toast]
  );

  return {
    cores,
    loading,
    error,
    createCor,
    updateCor,
    deleteCor,
    loadCores,
  };
}
