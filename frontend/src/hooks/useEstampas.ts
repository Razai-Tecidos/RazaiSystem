import { useState, useEffect, useCallback } from 'react';
import { Estampa, CreateEstampaData, UpdateEstampaData } from '@/types/estampa.types';
import {
  getEstampas,
  createEstampa as createEstampaFirebase,
  updateEstampa as updateEstampaFirebase,
  deleteEstampa as deleteEstampaFirebase,
  uploadEstampaImage,
  gerarSkuPorFamiliaEstampa,
  extrairNomeFamiliaEstampa,
  checkNomeDuplicadoEstampa,
} from '@/lib/firebase/estampas';
import { getTecidoById } from '@/lib/firebase/tecidos';
import { useToast } from './use-toast';

interface EstampaWithStatus extends Estampa {
  _status?: 'saving' | 'deleting';
  _tempId?: string;
}

export function useEstampas() {
  const [estampas, setEstampas] = useState<EstampaWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  /**
   * Carrega todas as estampas
   */
  const loadEstampas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEstampas();
      setEstampas(data);
    } catch (error) {
      console.error('Erro ao carregar estampas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as estampas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEstampas();
  }, [loadEstampas]);

  /**
   * Verifica se um nome de estampa já existe
   * @param nome Nome a verificar
   * @param excludeId ID da estampa a excluir (para edição)
   * @returns A estampa duplicada ou null
   */
  const verificarNomeDuplicado = useCallback(
    async (nome: string, excludeId?: string): Promise<Estampa | null> => {
      return await checkNomeDuplicadoEstampa(nome, excludeId);
    },
    []
  );

  /**
   * Cria uma nova estampa com UI otimista
   */
  const createEstampa = useCallback(
    async (data: CreateEstampaData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      let imageUrl = '';

      // Verificar nome duplicado
      const estampaDuplicada = await checkNomeDuplicadoEstampa(data.nome);
      if (estampaDuplicada) {
        toast({
          title: 'Nome já existe!',
          description: `Já existe uma estampa cadastrada com o nome "${estampaDuplicada.nome}". Escolha outro nome.`,
          variant: 'destructive',
        });
        throw new Error(`Nome duplicado: "${data.nome}" já existe`);
      }

      // Buscar nome do tecido base
      let tecidoBaseNome = '';
      try {
        const tecido = await getTecidoById(data.tecidoBaseId);
        tecidoBaseNome = tecido?.nome || '';
      } catch (error) {
        console.warn('Erro ao buscar tecido base:', error);
      }

      // Criar estampa temporária para UI otimista
      const tempEstampa: EstampaWithStatus = {
        id: tempId,
        nome: data.nome,
        tecidoBaseId: data.tecidoBaseId,
        tecidoBaseNome,
        imagem: data.imagem instanceof File ? '' : (data.imagem || ''),
        descricao: data.descricao,
        sku: '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      setEstampas((prev) => [tempEstampa, ...prev]);

      toast({
        title: 'Cadastrando...',
        description: 'Estampa sendo cadastrada...',
      });

      try {
        // Gerar SKU baseado na família (primeira palavra do nome)
        const { sku } = await gerarSkuPorFamiliaEstampa(data.nome);

        // Upload da imagem se for File (imagem é opcional)
        if (data.imagem instanceof File) {
          imageUrl = await uploadEstampaImage(data.imagem, tempId);
        } else if (data.imagem) {
          imageUrl = data.imagem;
        }

        // Criar no Firestore
        const created = await createEstampaFirebase(data, sku, imageUrl || undefined, tecidoBaseNome);

        // Atualizar lista com estampa real
        setEstampas((prev) =>
          prev.map((e) =>
            e._tempId === tempId ? { ...created } : e
          )
        );

        toast({
          title: 'Sucesso!',
          description: `Estampa "${data.nome}" cadastrada com sucesso.`,
        });
      } catch (error: any) {
        console.error('Erro ao criar estampa:', error);

        // Remover temporário em caso de erro
        setEstampas((prev) => prev.filter((e) => e._tempId !== tempId));

        // Só mostrar toast se não for erro de duplicado (já mostrou acima)
        if (!error.message?.includes('Nome duplicado')) {
          toast({
            title: 'Erro',
            description: error.message || 'Não foi possível cadastrar a estampa.',
            variant: 'destructive',
          });
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Atualiza uma estampa existente
   */
  const updateEstampa = useCallback(
    async (data: UpdateEstampaData): Promise<void> => {
      const { id, ...updateData } = data;

      // Encontrar estampa atual
      const currentEstampa = estampas.find((e) => e.id === id);
      if (!currentEstampa) {
        throw new Error('Estampa não encontrada');
      }

      // Verificar nome duplicado se estiver alterando o nome
      if (updateData.nome && updateData.nome !== currentEstampa.nome) {
        const estampaDuplicada = await checkNomeDuplicadoEstampa(updateData.nome, id);
        if (estampaDuplicada) {
          toast({
            title: 'Nome já existe!',
            description: `Já existe uma estampa cadastrada com o nome "${estampaDuplicada.nome}". Escolha outro nome.`,
            variant: 'destructive',
          });
          throw new Error(`Nome duplicado: "${updateData.nome}" já existe`);
        }
      }

      // Marcar como salvando
      setEstampas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, _status: 'saving' as const } : e
        )
      );

      try {
        let imageUrl: string | undefined;
        let tecidoBaseNome: string | undefined;

        // Upload nova imagem se for File
        if (updateData.imagem instanceof File) {
          imageUrl = await uploadEstampaImage(updateData.imagem, id);
        }

        // Buscar nome do tecido se mudou
        if (updateData.tecidoBaseId && updateData.tecidoBaseId !== currentEstampa.tecidoBaseId) {
          const tecido = await getTecidoById(updateData.tecidoBaseId);
          tecidoBaseNome = tecido?.nome || '';
        }

        // Determinar o SKU final
        // 1. Se foi passado um SKU manualmente, usar ele
        // 2. Se o nome mudou e a família mudou, gerar novo SKU
        // 3. Caso contrário, manter o SKU atual
        let skuFinal: string | undefined = undefined;
        
        if (updateData.sku !== undefined) {
          // SKU foi passado manualmente
          skuFinal = updateData.sku;
        } else if (updateData.nome && updateData.nome !== currentEstampa.nome) {
          // Nome mudou, verificar se família mudou
          const familiaAtual = extrairNomeFamiliaEstampa(currentEstampa.nome);
          const novaFamilia = extrairNomeFamiliaEstampa(updateData.nome);
          
          if (familiaAtual?.toLowerCase() !== novaFamilia?.toLowerCase()) {
            const resultado = await gerarSkuPorFamiliaEstampa(updateData.nome);
            skuFinal = resultado.sku || undefined;
          }
        }

        // Atualizar no Firestore
        await updateEstampaFirebase(
          id, 
          { ...updateData, sku: skuFinal }, 
          imageUrl, 
          tecidoBaseNome
        );

        // Atualizar lista local
        setEstampas((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...updateData,
                  imagem: imageUrl || (typeof updateData.imagem === 'string' ? updateData.imagem : e.imagem),
                  tecidoBaseNome: tecidoBaseNome || e.tecidoBaseNome,
                  sku: skuFinal !== undefined ? skuFinal : e.sku,
                  _status: undefined,
                }
              : e
          )
        );

        toast({
          title: 'Sucesso!',
          description: 'Estampa atualizada com sucesso.',
        });
      } catch (error: any) {
        console.error('Erro ao atualizar estampa:', error);

        // Remover status de salvando
        setEstampas((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, _status: undefined } : e
          )
        );

        // Só mostrar toast se não for erro de duplicado (já mostrou acima)
        if (!error.message?.includes('Nome duplicado')) {
          toast({
            title: 'Erro',
            description: error.message || 'Não foi possível atualizar a estampa.',
            variant: 'destructive',
          });
        }

        throw error;
      }
    },
    [estampas, toast]
  );

  /**
   * Exclui uma estampa com UI otimista
   */
  const deleteEstampa = useCallback(
    async (id: string): Promise<void> => {
      const estampaToDelete = estampas.find((e) => e.id === id);
      if (!estampaToDelete) return;

      // Marcar como deletando
      setEstampas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, _status: 'deleting' as const } : e
        )
      );

      try {
        await deleteEstampaFirebase(id);

        // Remover da lista
        setEstampas((prev) => prev.filter((e) => e.id !== id));

        toast({
          title: 'Sucesso!',
          description: 'Estampa excluída com sucesso.',
        });
      } catch (error: any) {
        console.error('Erro ao excluir estampa:', error);

        // Restaurar estampa
        setEstampas((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, _status: undefined } : e
          )
        );

        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível excluir a estampa.',
          variant: 'destructive',
        });

        throw error;
      }
    },
    [estampas, toast]
  );

  /**
   * Cria múltiplas estampas em lote
   */
  const createEstampasBatch = useCallback(
    async (nomes: string[], tecidoBaseId: string): Promise<void> => {
      if (nomes.length === 0) return;

      // Verificar nomes duplicados antes de iniciar
      const nomesExistentes: string[] = [];
      for (const nome of nomes) {
        const duplicada = await checkNomeDuplicadoEstampa(nome);
        if (duplicada) {
          nomesExistentes.push(nome);
        }
      }

      if (nomesExistentes.length > 0) {
        toast({
          title: 'Nomes duplicados!',
          description: `Os seguintes nomes já existem: ${nomesExistentes.join(', ')}`,
          variant: 'destructive',
        });
        throw new Error(`Nomes duplicados: ${nomesExistentes.join(', ')}`);
      }

      // Buscar nome do tecido base uma vez
      let tecidoBaseNome = '';
      try {
        const tecido = await getTecidoById(tecidoBaseId);
        tecidoBaseNome = tecido?.nome || '';
      } catch (error) {
        console.warn('Erro ao buscar tecido base:', error);
      }

      // Criar estampas temporárias para UI otimista
      const tempEstampas: EstampaWithStatus[] = nomes.map((nome, index) => ({
        id: `temp-batch-${Date.now()}-${index}`,
        nome,
        tecidoBaseId,
        tecidoBaseNome,
        imagem: '',
        sku: '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: `temp-batch-${Date.now()}-${index}`,
      }));

      setEstampas((prev) => [...tempEstampas, ...prev]);

      toast({
        title: 'Cadastrando...',
        description: `Criando ${nomes.length} estampa${nomes.length > 1 ? 's' : ''}...`,
      });

      let criadas = 0;
      let erros = 0;
      const estampasCriadas: Estampa[] = [];

      // Criar sequencialmente para garantir SKUs corretos
      for (let i = 0; i < nomes.length; i++) {
        const nome = nomes[i];
        const tempId = tempEstampas[i]._tempId!;

        try {
          // Gerar SKU
          const { sku } = await gerarSkuPorFamiliaEstampa(nome);

          // Criar no Firestore
          const created = await createEstampaFirebase(
            { nome, tecidoBaseId },
            sku,
            undefined,
            tecidoBaseNome
          );

          estampasCriadas.push(created);
          criadas++;

          // Atualizar UI com estampa real
          setEstampas((prev) =>
            prev.map((e) =>
              e._tempId === tempId ? { ...created } : e
            )
          );
        } catch (error) {
          console.error(`Erro ao criar estampa "${nome}":`, error);
          erros++;

          // Remover temporário com erro
          setEstampas((prev) => prev.filter((e) => e._tempId !== tempId));
        }
      }

      // Toast final
      if (erros === 0) {
        toast({
          title: 'Sucesso!',
          description: `${criadas} estampa${criadas > 1 ? 's' : ''} criada${criadas > 1 ? 's' : ''}.`,
        });
      } else if (criadas > 0) {
        toast({
          title: 'Parcialmente concluído',
          description: `${criadas} criada${criadas > 1 ? 's' : ''}, ${erros} erro${erros > 1 ? 's' : ''}.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar as estampas.',
          variant: 'destructive',
        });
        throw new Error('Falha ao criar estampas em lote');
      }
    },
    [toast]
  );

  return {
    estampas,
    loading,
    loadEstampas,
    createEstampa,
    createEstampasBatch,
    updateEstampa,
    deleteEstampa,
    verificarNomeDuplicado,
  };
}
