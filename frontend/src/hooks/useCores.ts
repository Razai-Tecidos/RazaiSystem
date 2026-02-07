import { useState, useEffect, useCallback } from 'react';
import { Cor, CreateCorData, UpdateCorData, LabColor } from '@/types/cor.types';
import {
  getCores as getCoresFirebase,
  createCor as createCorFirebase,
  updateCor as updateCorFirebase,
  deleteCor as deleteCorFirebase,
  gerarSkuPorFamilia,
  isNomePadrao,
  findCorByLab,
  findCoresSimilares,
  getCorById,
  checkNomeDuplicado,
} from '@/lib/firebase/cores';
import { updateCorDataInVinculos, moverVinculosDeCor } from '@/lib/firebase/cor-tecido';
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
      console.log('[useCores] Carregando cores...');
      const data = await getCoresFirebase();
      console.log('[useCores] Cores carregadas:', data.length);
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
   * Verifica se um nome de cor já existe
   * @param nome Nome a verificar
   * @param excludeId ID da cor a excluir (para edição)
   * @returns A cor duplicada ou null
   */
  const verificarNomeDuplicado = useCallback(
    async (nome: string, excludeId?: string): Promise<Cor | null> => {
      return await checkNomeDuplicado(nome, excludeId);
    },
    []
  );

  /**
   * Cria uma nova cor com UI otimista
   * Bloqueia se já existir uma cor com o mesmo nome
   */
  const createCor = useCallback(
    async (data: CreateCorData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      const isPadrao = isNomePadrao(data.nome);

      // Verificar nome duplicado (exceto para nomes padrão)
      if (!isPadrao) {
        const corDuplicada = await checkNomeDuplicado(data.nome);
        if (corDuplicada) {
          toast({
            title: 'Nome já existe!',
            description: `Já existe uma cor cadastrada com o nome "${corDuplicada.nome}". Escolha outro nome.`,
            variant: 'destructive',
          });
          throw new Error(`Nome duplicado: "${data.nome}" já existe`);
        }
      }

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

        // Só mostrar toast se não for erro de duplicado (já mostrou acima)
        if (!err.message?.includes('Nome duplicado')) {
          toast({
            title: 'Erro',
            description: err.message || 'Erro ao cadastrar cor',
            variant: 'destructive',
          });
        }

        throw err;
      }
    },
    [generateSkuFromName, toast]
  );

  /**
   * Atualiza uma cor existente
   * Se a cor não tinha SKU e o novo nome não é padrão, gera SKU
   * Bloqueia se o novo nome já existir em outra cor
   */
  const updateCor = useCallback(
    async (data: UpdateCorData): Promise<void> => {
      const corIndex = cores.findIndex((c) => c.id === data.id);
      if (corIndex === -1) return;

      const originalCor = cores[corIndex];

      // Verificar nome duplicado se estiver alterando o nome
      if (data.nome && data.nome !== originalCor.nome && !isNomePadrao(data.nome)) {
        const corDuplicada = await checkNomeDuplicado(data.nome, data.id);
        if (corDuplicada) {
          toast({
            title: 'Nome já existe!',
            description: `Já existe uma cor cadastrada com o nome "${corDuplicada.nome}". Escolha outro nome.`,
            variant: 'destructive',
          });
          throw new Error(`Nome duplicado: "${data.nome}" já existe`);
        }
      }

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

        // SKU final: prioriza o gerado automaticamente, senão usa o passado manualmente
        const skuFinal = novoSku || data.sku;

        // Atualizar documento (incluindo SKU se gerado ou passado)
        await updateCorFirebase(data.id, {
          ...data,
          ...(skuFinal !== undefined ? { sku: skuFinal } : {}),
        });

        // Propagar mudanças para os vínculos (dados denormalizados)
        const dadosParaVinculos: { corNome?: string; corHex?: string; corSku?: string } = {};
        if (data.nome) dadosParaVinculos.corNome = data.nome;
        if (data.codigoHex) dadosParaVinculos.corHex = data.codigoHex;
        if (skuFinal) dadosParaVinculos.corSku = skuFinal;
        
        if (Object.keys(dadosParaVinculos).length > 0) {
          await updateCorDataInVinculos(data.id, dadosParaVinculos);
        }

        // Recarregar cores para ter dados atualizados
        await loadCores();

        toast({
          title: 'Sucesso!',
          description: novoSku 
            ? `Cor atualizada! SKU gerado: ${novoSku}`
            : skuFinal && data.sku
            ? `Cor atualizada! SKU: ${skuFinal}`
            : 'Cor atualizada com sucesso!',
        });
      } catch (err: any) {
        // Restaurar estado original
        setCores((prev) =>
          prev.map((c) =>
            c.id === data.id ? { ...originalCor, _status: 'idle' as const } : c
          )
        );

        // Só mostrar toast se não for erro de duplicado (já mostrou acima)
        if (!err.message?.includes('Nome duplicado')) {
          toast({
            title: 'Erro',
            description: err.message || 'Erro ao atualizar cor',
            variant: 'destructive',
          });
        }

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

  /**
   * Busca cor similar por LAB
   * Retorna a cor mais próxima se deltaE < limiar
   */
  const findSimilar = useCallback(async (lab: LabColor, limiar: number = 3): Promise<Cor | null> => {
    return findCorByLab(lab, limiar);
  }, []);

  /**
   * Busca todas as cores similares por LAB
   */
  const findAllSimilar = useCallback(async (lab: LabColor, limiar: number = 5): Promise<Array<{ cor: Cor; deltaE: number }>> => {
    return findCoresSimilares(lab, limiar);
  }, []);

  /**
   * Busca cor por ID (em memória)
   */
  const getCorByIdLocal = useCallback((id: string): Cor | undefined => {
    return cores.find(c => c.id === id);
  }, [cores]);

  /**
   * Mescla duas cores: move vínculos da cor origem para a cor destino e deleta a origem
   * @param corOrigemId - ID da cor que será removida
   * @param corDestinoId - ID da cor que será mantida
   * @returns Número de vínculos movidos
   */
  const mesclarCores = useCallback(
    async (corOrigemId: string, corDestinoId: string): Promise<number> => {
      // Buscar cor destino para pegar os dados
      const corDestino = await getCorById(corDestinoId);
      if (!corDestino) {
        throw new Error('Cor destino não encontrada');
      }

      toast({
        title: 'Mesclando...',
        description: 'Movendo vínculos e removendo cor duplicada...',
      });

      try {
        // Mover todos os vínculos da cor origem para a cor destino
        const vinculosMovidos = await moverVinculosDeCor(
          corOrigemId,
          corDestinoId,
          {
            corNome: corDestino.nome,
            corHex: corDestino.codigoHex,
            corSku: corDestino.sku,
          }
        );

        // Deletar a cor origem
        await deleteCorFirebase(corOrigemId);

        // Recarregar lista de cores
        await loadCores();

        toast({
          title: 'Cores mescladas!',
          description: vinculosMovidos > 0
            ? `${vinculosMovidos} vínculo(s) movido(s) para "${corDestino.nome}".`
            : `Cor duplicada removida. "${corDestino.nome}" mantida.`,
        });

        return vinculosMovidos;
      } catch (err: any) {
        toast({
          title: 'Erro ao mesclar',
          description: err.message || 'Não foi possível mesclar as cores',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [loadCores, toast]
  );

  return {
    cores,
    loading,
    error,
    createCor,
    updateCor,
    deleteCor,
    loadCores,
    findSimilar,
    findAllSimilar,
    getCorById: getCorByIdLocal,
    mesclarCores,
    verificarNomeDuplicado,
  };
}
