import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface TecidoWithStatus extends Tecido {
  _status?: 'saving' | 'deleting' | 'idle';
  _tempId?: string;
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

  // Ref estável para acessar tecidos dentro dos callbacks sem dependência
  const tecidosRef = useRef(tecidos);
  tecidosRef.current = tecidos;

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

  // Carregar tecidos ao montar componente
  useEffect(() => {
    loadTecidos();
  }, [loadTecidos]);

  /**
   * Cria um novo tecido com UI otimista
   */
  const createTecido = useCallback(
    async (data: CreateTecidoData): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      let imageUrl = '';
      let sku = '';

      const tempTecido: TecidoWithStatus = {
        id: tempId,
        nome: data.nome,
        tipo: data.tipo || 'liso',
        largura: data.largura,
        composicao: data.composicao,
        rendimentoPorKg: data.rendimentoPorKg,
        gramaturaValor: data.gramaturaValor,
        gramaturaUnidade: data.gramaturaUnidade,
        imagemPadrao: data.imagemPadrao instanceof File ? '' : (data.imagemPadrao || ''),
        descricao: data.descricao,
        sku: '...',
        createdAt: {} as any,
        updatedAt: {} as any,
        _status: 'saving',
        _tempId: tempId,
      };

      setTecidos((prev) => [tempTecido, ...prev]);

      try {
        sku = await generateNextSku();

        if (data.imagemPadrao instanceof File) {
          const tempImageUrl = 'temp';
          const createdTecido = await createTecidoFirebase(
            { ...data, imagemPadrao: tempImageUrl },
            sku,
            tempImageUrl
          );

          try {
            imageUrl = await uploadTecidoImage(data.imagemPadrao, createdTecido.id);
            await updateTecidoFirebase(createdTecido.id, {}, imageUrl);
            createdTecido.imagemPadrao = imageUrl;

            setTecidos((prev) => [
              { ...createdTecido, _status: 'idle' as const },
              ...prev.filter((t) => t._tempId !== tempId).map((t) => ({ ...t, _status: 'idle' as const })),
            ]);

            toast({
              title: 'Sucesso!',
              description: 'Tecido cadastrado com sucesso!',
            });
          } catch (uploadError: any) {
            await deleteTecidoFirebase(createdTecido.id, '');
            await invalidateSku(sku);
            throw uploadError;
          }
        } else {
          imageUrl = data.imagemPadrao || '';
          const createdTecido = await createTecidoFirebase(
            { ...data, imagemPadrao: imageUrl },
            sku,
            imageUrl || undefined
          );

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
        setTecidos((prev) => prev.filter((t) => t._tempId !== tempId));

        toast({
          title: 'Erro',
          description: err.message || 'Erro ao cadastrar tecido',
          variant: 'destructive',
        });

        throw err;
      }
    },
    [generateNextSku, invalidateSku, toast]
  );

  /**
   * Atualiza um tecido existente
   */
  const updateTecido = useCallback(
    async (data: UpdateTecidoData): Promise<void> => {
      // Usar ref para acessar estado atual sem dependência
      const currentTecidos = tecidosRef.current;
      const originalTecido = currentTecidos.find((t) => t.id === data.id);
      if (!originalTecido) return;

      // Atualizar otimisticamente
      setTecidos((prev) =>
        prev.map((t) => {
          if (t.id === data.id) {
            const updateData: any = { ...data };
            if (updateData.imagemPadrao instanceof File) {
              delete updateData.imagemPadrao;
            }
            return { ...t, ...updateData, _status: 'saving' as const };
          }
          return t;
        })
      );

      try {
        let imageUrl: string | undefined;

        if (data.imagemPadrao instanceof File) {
          imageUrl = await uploadTecidoImage(data.imagemPadrao, data.id);
        }

        await updateTecidoFirebase(data.id, data, imageUrl);

        // Propagar mudanças para vínculos denormalizados
        const dadosParaVinculos: { tecidoNome?: string; tecidoSku?: string } = {};
        if (data.nome) dadosParaVinculos.tecidoNome = data.nome;

        if (Object.keys(dadosParaVinculos).length > 0) {
          await updateTecidoDataInVinculos(data.id, dadosParaVinculos);
        }

        // Recarregar para ter dados atualizados do servidor
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
    [loadTecidos, toast]
  );

  /**
   * Exclui um tecido com UI otimista
   */
  const deleteTecido = useCallback(
    async (id: string): Promise<void> => {
      // Usar ref para acessar estado atual sem dependência
      const currentTecidos = tecidosRef.current;
      const tecido = currentTecidos.find((t) => t.id === id);
      if (!tecido) return;

      // Remover otimisticamente
      setTecidos((prev) => prev.filter((t) => t.id !== id));

      try {
        await invalidateSku(tecido.sku);
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
    [invalidateSku, toast]
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
