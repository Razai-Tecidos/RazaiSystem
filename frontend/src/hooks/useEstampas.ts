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
   * Cria uma nova estampa com UI otimista
   */
  const createEstampa = useCallback(
    async (data: CreateEstampaData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      let imageUrl = '';

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

        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível cadastrar a estampa.',
          variant: 'destructive',
        });

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

      // Marcar como salvando
      setEstampas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, _status: 'saving' as const } : e
        )
      );

      try {
        let imageUrl: string | undefined;
        let tecidoBaseNome: string | undefined;
        let novoSku: string | null | undefined = undefined;

        // Upload nova imagem se for File
        if (updateData.imagem instanceof File) {
          imageUrl = await uploadEstampaImage(updateData.imagem, id);
        }

        // Buscar nome do tecido se mudou
        if (updateData.tecidoBaseId && updateData.tecidoBaseId !== currentEstampa.tecidoBaseId) {
          const tecido = await getTecidoById(updateData.tecidoBaseId);
          tecidoBaseNome = tecido?.nome || '';
        }

        // Se o nome mudou, verificar se precisa gerar novo SKU
        if (updateData.nome && updateData.nome !== currentEstampa.nome) {
          const familiaAtual = extrairNomeFamiliaEstampa(currentEstampa.nome);
          const novaFamilia = extrairNomeFamiliaEstampa(updateData.nome);
          
          // Se a família mudou, gerar novo SKU
          if (familiaAtual?.toLowerCase() !== novaFamilia?.toLowerCase()) {
            const resultado = await gerarSkuPorFamiliaEstampa(updateData.nome);
            novoSku = resultado.sku;
          }
        }

        // Atualizar no Firestore
        await updateEstampaFirebase(
          id, 
          { ...updateData, sku: novoSku }, 
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
                  sku: novoSku || e.sku,
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

        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível atualizar a estampa.',
          variant: 'destructive',
        });

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

  return {
    estampas,
    loading,
    loadEstampas,
    createEstampa,
    updateEstampa,
    deleteEstampa,
  };
}
