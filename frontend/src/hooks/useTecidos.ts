import { useState, useEffect, useCallback } from 'react';
import { Tecido, CreateTecidoData, UpdateTecidoData } from '@/types/tecido.types';
import {
  getTecidos as getTecidosFirebase,
  createTecido as createTecidoFirebase,
  updateTecido as updateTecidoFirebase,
  deleteTecido as deleteTecidoFirebase,
  uploadTecidoImage,
} from '@/lib/firebase/tecidos';
import { updateTecidoDataInVinculos } from '@/lib/firebase/cor-tecido';
import { useSku } from './useSku';
import { useToast } from '@/hooks/use-toast';

interface TecidoWithStatus extends Tecido {
  _status?: 'saving' | 'deleting' | 'idle';
  _tempId?: string; // Para tecidos temporários na UI otimista
}

/**
 * Hook para operações CRUD de tecidos com UI otimista
 */
export function useTecidos() {
  const [tecidos, setTecidos] = useState<TecidoWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { generateNextSku, invalidateSku } = useSku();
  const { toast } = useToast();

  // Carregar tecidos ao montar componente
  useEffect(() => {
    loadTecidos();
  }, []);

  /**
   * Carrega todos os tecidos do Firebase
   */
  const loadTecidos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTecidosFirebase();
      setTecidos(data.map((t) => ({ ...t, _status: 'idle' as const })));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tecidos');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os tecidos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Cria um novo tecido com UI otimista
   */
  const createTecido = useCallback(
    async (data: CreateTecidoData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      let imageUrl = '';
      let sku = '';

      // Criar tecido temporário para UI otimista
      const tempTecido: TecidoWithStatus = {
        id: tempId,
        nome: data.nome,
        tipo: data.tipo || 'liso',
        largura: data.largura,
        composicao: data.composicao,
        imagemPadrao: data.imagemPadrao instanceof File ? '' : (data.imagemPadrao || ''),
        descricao: data.descricao,
        sku: '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      // Adicionar temporário à lista
      setTecidos((prev) => [tempTecido, ...prev]);

      // Fechar modal e mostrar toast
      toast({
        title: 'Cadastrando...',
        description: 'Tecido sendo cadastrado...',
      });

      try {
        // Gerar SKU
        sku = await generateNextSku();

        // Se tiver imagem para upload, fazer upload primeiro
        if (data.imagemPadrao instanceof File) {
          // Criar documento temporário para obter ID real (necessário para o caminho do upload)
          const tempImageUrl = 'temp';
          const createdTecido = await createTecidoFirebase(
            { ...data, imagemPadrao: tempImageUrl },
            sku,
            tempImageUrl
          );

          try {
            // Upload da imagem com ID real do documento
            imageUrl = await uploadTecidoImage(data.imagemPadrao, createdTecido.id);
            // Atualizar documento com URL real da imagem
            await updateTecidoFirebase(createdTecido.id, {}, imageUrl);
            createdTecido.imagemPadrao = imageUrl;

            // Atualizar lista removendo temporário e adicionando real
            setTecidos((prev) => [
              { ...createdTecido, _status: 'idle' as const },
              ...prev.filter((t) => t._tempId !== tempId).map((t) => ({ ...t, _status: 'idle' as const })),
            ]);

            toast({
              title: 'Sucesso!',
              description: 'Tecido cadastrado com sucesso!',
            });
          } catch (uploadError: any) {
            // Se upload falhar, deletar documento criado
            await deleteTecidoFirebase(createdTecido.id, '');
            // Invalidar SKU usado
            await invalidateSku(sku);
            throw uploadError;
          }
        } else {
          // Sem upload de imagem (URL existente ou vazio), criar documento diretamente
          imageUrl = data.imagemPadrao || '';
          const createdTecido = await createTecidoFirebase(
            { ...data, imagemPadrao: imageUrl },
            sku,
            imageUrl || undefined
          );

          // Atualizar lista removendo temporário e adicionando real
          setTecidos((prev) => [
            { ...createdTecido, _status: 'idle' as const },
            ...prev.filter((t) => t._tempId !== tempId).map((t) => ({ ...t, _status: 'idle' as const })),
          ]);

          toast({
            title: 'Sucesso!',
            description: 'Tecido cadastrado com sucesso!',
          });
        }
      } catch (err: any) {
        // Remover temporário em caso de erro
        setTecidos((prev) => prev.filter((t) => t._tempId !== tempId));

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao cadastrar tecido',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [generateNextSku, toast]
  );

  /**
   * Atualiza um tecido existente
   */
  const updateTecido = useCallback(
    async (data: UpdateTecidoData): Promise<void> => {
      const tecidoIndex = tecidos.findIndex((t) => t.id === data.id);
      if (tecidoIndex === -1) return;

      const originalTecido = tecidos[tecidoIndex];

      // Atualizar otimisticamente
      setTecidos((prev) =>
        prev.map((t) => {
          if (t.id === data.id) {
            const updateData: any = { ...data };
            // Se imagemPadrao for File, não incluir na atualização otimista (ainda não foi feito upload)
            if (updateData.imagemPadrao instanceof File) {
              delete updateData.imagemPadrao;
            }
            return { ...t, ...updateData, _status: 'saving' as const };
          }
          return t;
        })
      );

      toast({
        title: 'Atualizando...',
        description: 'Tecido sendo atualizado...',
      });

      try {
        let imageUrl: string | undefined;

        // Upload de nova imagem se fornecida
        if (data.imagemPadrao instanceof File) {
          imageUrl = await uploadTecidoImage(data.imagemPadrao, data.id);
        }

        await updateTecidoFirebase(data.id, data, imageUrl);

        // Propagar mudanças para os vínculos (dados denormalizados)
        const dadosParaVinculos: { tecidoNome?: string; tecidoSku?: string } = {};
        if (data.nome) dadosParaVinculos.tecidoNome = data.nome;
        // SKU de tecido não muda após criação, mas incluímos caso seja necessário
        
        if (Object.keys(dadosParaVinculos).length > 0) {
          await updateTecidoDataInVinculos(data.id, dadosParaVinculos);
        }

        // Recarregar tecidos para ter dados atualizados
        await loadTecidos();

        toast({
          title: 'Sucesso!',
          description: 'Tecido atualizado com sucesso!',
        });
      } catch (err: any) {
        // Restaurar estado original
        setTecidos((prev) =>
          prev.map((t) =>
            t.id === data.id ? { ...originalTecido, _status: 'idle' as const } : t
          )
        );

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao atualizar tecido',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [tecidos, loadTecidos, toast]
  );

  /**
   * Exclui um tecido com UI otimista
   */
  const deleteTecido = useCallback(
    async (id: string): Promise<void> => {
      const tecido = tecidos.find((t) => t.id === id);
      if (!tecido) return;

      // Remover otimisticamente
      setTecidos((prev) => prev.filter((t) => t.id !== id));

      toast({
        title: 'Excluindo...',
        description: 'Tecido sendo excluído...',
      });

      try {
        // Invalidar SKU
        await invalidateSku(tecido.sku);

        // Deletar do Firebase
        await deleteTecidoFirebase(id, tecido.imagemPadrao || '');

        toast({
          title: 'Sucesso!',
          description: 'Tecido excluído com sucesso!',
        });
      } catch (err: any) {
        // Restaurar tecido em caso de erro
        setTecidos((prev) => [...prev, { ...tecido, _status: 'idle' as const }]);

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao excluir tecido',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [tecidos, invalidateSku, toast]
  );

  return {
    tecidos,
    loading,
    error,
    createTecido,
    updateTecido,
    deleteTecido,
    loadTecidos,
  };
}
