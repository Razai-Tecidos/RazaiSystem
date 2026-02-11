import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface EstampaWithStatus extends Estampa {
  _status?: 'saving' | 'deleting';
  _tempId?: string;
}

export function useEstampas() {
  const [estampas, setEstampas] = useState<EstampaWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Ref estável para acessar estampas dentro dos callbacks sem dependência
  const estampasRef = useRef(estampas);
  estampasRef.current = estampas;

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

      const estampaDuplicada = await checkNomeDuplicadoEstampa(data.nome);
      if (estampaDuplicada) {
        toast({
          title: 'Nome já existe!',
          description: `Já existe uma estampa cadastrada com o nome "${estampaDuplicada.nome}". Escolha outro nome.`,
          variant: 'destructive',
        });
        throw new Error(`Nome duplicado: "${data.nome}" já existe`);
      }

      let tecidoBaseNome = '';
      try {
        const tecido = await getTecidoById(data.tecidoBaseId);
        tecidoBaseNome = tecido?.nome || '';
      } catch (error) {
        console.warn('Erro ao buscar tecido base:', error);
      }

      const tempEstampa: EstampaWithStatus = {
        id: tempId,
        nome: data.nome,
        tecidoBaseId: data.tecidoBaseId,
        tecidoBaseNome,
        imagem: data.imagem instanceof File ? '' : (data.imagem || ''),
        imagemThumb: '',
        descricao: data.descricao,
        sku: '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      setEstampas((prev) => [tempEstampa, ...prev]);

      try {
        const { sku } = await gerarSkuPorFamiliaEstampa(data.nome);

        if (data.imagem instanceof File) {
          imageUrl = await uploadEstampaImage(data.imagem, tempId);
        } else if (data.imagem) {
          imageUrl = data.imagem;
        }

        const created = await createEstampaFirebase(
          data,
          sku,
          imageUrl || undefined,
          undefined,
          tecidoBaseNome
        );

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
        setEstampas((prev) => prev.filter((e) => e._tempId !== tempId));

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
    async (data: UpdateEstampaData, options?: { silent?: boolean }): Promise<void> => {
      const { id, ...updateData } = data;
      const silent = options?.silent ?? false;

      // Usar ref para acessar estado atual sem dependência
      const currentEstampas = estampasRef.current;
      const currentEstampa = currentEstampas.find((e) => e.id === id);
      if (!currentEstampa) {
        throw new Error('Estampa não encontrada');
      }

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

      setEstampas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, _status: 'saving' as const } : e
        )
      );

      try {
        let imageUrl: string | undefined;
        let imageThumbUrl: string | undefined;
        let tecidoBaseNome: string | undefined;

        if (updateData.imagem instanceof File) {
          imageUrl = await uploadEstampaImage(updateData.imagem, id);
        }

        if (updateData.tecidoBaseId && updateData.tecidoBaseId !== currentEstampa.tecidoBaseId) {
          const tecido = await getTecidoById(updateData.tecidoBaseId);
          tecidoBaseNome = tecido?.nome || '';
        }

        let skuFinal: string | undefined = undefined;
        
        if (updateData.sku !== undefined) {
          skuFinal = updateData.sku;
        } else if (updateData.nome && updateData.nome !== currentEstampa.nome) {
          const familiaAtual = extrairNomeFamiliaEstampa(currentEstampa.nome);
          const novaFamilia = extrairNomeFamiliaEstampa(updateData.nome);
          
          if (familiaAtual?.toLowerCase() !== novaFamilia?.toLowerCase()) {
            const resultado = await gerarSkuPorFamiliaEstampa(updateData.nome);
            skuFinal = resultado.sku || undefined;
          }
        }

        const updateResult = await updateEstampaFirebase(
          id, 
          { ...updateData, sku: skuFinal }, 
          imageUrl, 
          imageThumbUrl,
          tecidoBaseNome
        );
        imageThumbUrl = updateResult.imageThumbUrl || imageThumbUrl;

        setEstampas((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...updateData,
                  imagem: imageUrl || (typeof updateData.imagem === 'string' ? updateData.imagem : e.imagem),
                  imagemThumb: imageThumbUrl || e.imagemThumb,
                  tecidoBaseNome: tecidoBaseNome || e.tecidoBaseNome,
                  sku: skuFinal !== undefined ? skuFinal : e.sku,
                  _status: undefined,
                }
              : e
          )
        );

        if (!silent) {
          toast({
            title: 'Sucesso!',
            description: 'Estampa atualizada com sucesso.',
          });
        }
      } catch (error: any) {
        console.error('Erro ao atualizar estampa:', error);

        setEstampas((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, _status: undefined } : e
          )
        );

        if (!silent && !error.message?.includes('Nome duplicado')) {
          toast({
            title: 'Erro',
            description: error.message || 'Não foi possível atualizar a estampa.',
            variant: 'destructive',
          });
        }

        throw error;
      }
    },
    [toast]
  );

  /**
   * Exclui uma estampa com UI otimista
   */
  const deleteEstampa = useCallback(
    async (id: string): Promise<void> => {
      // Usar ref para acessar estado atual sem dependência
      const currentEstampas = estampasRef.current;
      const estampaToDelete = currentEstampas.find((e) => e.id === id);
      if (!estampaToDelete) return;

      setEstampas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, _status: 'deleting' as const } : e
        )
      );

      try {
        await deleteEstampaFirebase(id);
        setEstampas((prev) => prev.filter((e) => e.id !== id));

        toast({
          title: 'Sucesso!',
          description: 'Estampa excluída com sucesso.',
        });
      } catch (error: any) {
        console.error('Erro ao excluir estampa:', error);

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
    [toast]
  );

  /**
   * Cria múltiplas estampas em lote
   */
  const createEstampasBatch = useCallback(
    async (nomes: string[], tecidoBaseId: string): Promise<void> => {
      if (nomes.length === 0) return;

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

      let tecidoBaseNome = '';
      try {
        const tecido = await getTecidoById(tecidoBaseId);
        tecidoBaseNome = tecido?.nome || '';
      } catch (error) {
        console.warn('Erro ao buscar tecido base:', error);
      }

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

      let criadas = 0;
      let erros = 0;

      for (let i = 0; i < nomes.length; i++) {
        const nome = nomes[i];
        const tempId = tempEstampas[i]._tempId!;

        try {
          const { sku } = await gerarSkuPorFamiliaEstampa(nome);
          const created = await createEstampaFirebase(
            { nome, tecidoBaseId },
            sku,
            undefined,
            undefined,
            tecidoBaseNome
          );

          criadas++;
          setEstampas((prev) =>
            prev.map((e) =>
              e._tempId === tempId ? { ...created } : e
            )
          );
        } catch (error) {
          console.error(`Erro ao criar estampa "${nome}":`, error);
          erros++;
          setEstampas((prev) => prev.filter((e) => e._tempId !== tempId));
        }
      }

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
