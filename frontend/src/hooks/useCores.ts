import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface CorWithStatus extends Cor {
  _status?: 'saving' | 'deleting' | 'idle';
  _tempId?: string;
}

/**
 * Hook para operações CRUD de cores com UI otimista
 */
export function useCores() {
  const [cores, setCores] = useState<CorWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Ref estável para acessar cores dentro dos callbacks sem dependência
  const coresRef = useRef(cores);
  coresRef.current = cores;

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
      const isErroEsperado = 
        err.code === 'permission-denied' ||
        err.code === 'failed-precondition' ||
        err.code === 'not-found' ||
        err.code === 'unavailable';
      
      if (isErroEsperado) {
        console.warn('Erro esperado ao carregar cores:', err.code, err.message);
        setCores([]);
        setError(null);
      } else {
        const errorMessage = err.message || 'Erro ao carregar cores';
        setError(errorMessage);
        console.error('Erro crítico ao carregar cores:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar cores ao montar componente
  useEffect(() => {
    loadCores();
  }, [loadCores]);

  /**
   * Gera SKU baseado na família da cor
   */
  const generateSkuFromName = useCallback(async (nome: string): Promise<string | null> => {
    const result = await gerarSkuPorFamilia(nome);
    return result.sku;
  }, []);

  /**
   * Verifica se um nome de cor já existe
   */
  const verificarNomeDuplicado = useCallback(
    async (nome: string, excludeId?: string): Promise<Cor | null> => {
      return await checkNomeDuplicado(nome, excludeId);
    },
    []
  );

  /**
   * Cria uma nova cor com UI otimista
   */
  const createCor = useCallback(
    async (data: CreateCorData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      const isPadrao = isNomePadrao(data.nome);

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

      const tempCor: CorWithStatus = {
        id: tempId,
        nome: data.nome,
        codigoHex: data.codigoHex,
        sku: isPadrao ? undefined : '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      setCores((prev) => [tempCor, ...prev]);

      try {
        const sku = await generateSkuFromName(data.nome);
        const createdCor = await createCorFirebase(data, sku);

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
        setCores((prev) => prev.filter((c) => c._tempId !== tempId));

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
   */
  const updateCor = useCallback(
    async (data: UpdateCorData): Promise<void> => {
      // Usar ref para acessar estado atual sem dependência
      const currentCores = coresRef.current;
      const originalCor = currentCores.find((c) => c.id === data.id);
      if (!originalCor) return;

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

      try {
        let novoSku: string | null = null;
        const nomeAtualizado = data.nome || originalCor.nome;
        
        if (!originalCor.sku && data.nome && !isNomePadrao(data.nome)) {
          novoSku = await generateSkuFromName(nomeAtualizado);
        }

        const skuFinal = novoSku || data.sku;

        await updateCorFirebase(data.id, {
          ...data,
          ...(skuFinal !== undefined ? { sku: skuFinal } : {}),
        });

        const dadosParaVinculos: { corNome?: string; corHex?: string; corSku?: string } = {};
        if (data.nome) dadosParaVinculos.corNome = data.nome;
        if (data.codigoHex) dadosParaVinculos.corHex = data.codigoHex;
        if (skuFinal) dadosParaVinculos.corSku = skuFinal;
        
        if (Object.keys(dadosParaVinculos).length > 0) {
          await updateCorDataInVinculos(data.id, dadosParaVinculos);
        }

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
    [loadCores, toast, generateSkuFromName]
  );

  /**
   * Exclui uma cor com UI otimista
   */
  const deleteCor = useCallback(
    async (id: string): Promise<void> => {
      // Usar ref para acessar estado atual sem dependência
      const currentCores = coresRef.current;
      const cor = currentCores.find((c) => c.id === id);
      if (!cor) return;

      // Remover otimisticamente
      setCores((prev) => prev.filter((c) => c.id !== id));

      try {
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
    [toast]
  );

  /**
   * Busca cor similar por LAB
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
   */
  const mesclarCores = useCallback(
    async (corOrigemId: string, corDestinoId: string): Promise<number> => {
      const corDestino = await getCorById(corDestinoId);
      if (!corDestino) {
        throw new Error('Cor destino não encontrada');
      }

      toast({
        title: 'Mesclando...',
        description: 'Movendo vínculos e removendo cor duplicada...',
      });

      try {
        const vinculosMovidos = await moverVinculosDeCor(
          corOrigemId,
          corDestinoId,
          {
            corNome: corDestino.nome,
            corHex: corDestino.codigoHex,
            corSku: corDestino.sku,
          }
        );

        await deleteCorFirebase(corOrigemId);
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
