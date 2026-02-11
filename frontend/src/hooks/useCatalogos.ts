import { useState, useCallback } from 'react';
import { Tecido } from '@/types/tecido.types';
import { CorTecido } from '@/types/cor.types';
import {
  Catalogo,
  CatalogoTecidoSnapshot,
  createCatalogo as createCatalogoFirebase,
  getCatalogoById,
  getCatalogoUrl,
  listCatalogosByCurrentUser,
} from '@/lib/firebase/catalogos';
import { getTecidoById } from '@/lib/firebase/tecidos';
import { getCorTecidosByTecidoId } from '@/lib/firebase/cor-tecido';
import { useToast } from '@/hooks/use-toast';

// Tipo para agrupar vinculos por tecido (usado na pagina publica)
export interface TecidoComVinculosPublico {
  tecido: Tecido;
  vinculos: CorTecido[];
}

interface UseCatalogosReturn {
  // Estado
  loading: boolean;
  generating: boolean;
  historyLoading: boolean;
  catalogosHistorico: Catalogo[];

  // Acoes
  createCatalogoLink: (
    tecidoIds: string[],
    options?: {
      tecidosSnapshot?: CatalogoTecidoSnapshot[];
      totalCoresSnapshot?: number;
      totalEstampasSnapshot?: number;
    }
  ) => Promise<string | null>;
  loadCatalogoTecidos: (catalogoId: string) => Promise<TecidoComVinculosPublico[] | null>;
  loadCatalogosHistorico: () => Promise<Catalogo[] | null>;
}

/**
 * Hook para gerenciar catalogos e links compartilhaveis
 */
export function useCatalogos(): UseCatalogosReturn {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [catalogosHistorico, setCatalogosHistorico] = useState<Catalogo[]>([]);
  const { toast } = useToast();

  /**
   * Cria um novo catalogo e retorna a URL compartilhavel
   */
  const createCatalogoLink = useCallback(
    async (
      tecidoIds: string[],
      options?: {
        tecidosSnapshot?: CatalogoTecidoSnapshot[];
        totalCoresSnapshot?: number;
        totalEstampasSnapshot?: number;
      }
    ): Promise<string | null> => {
      if (tecidoIds.length === 0) {
        toast({
          title: 'Atencao',
          description: 'Selecione pelo menos um tecido para criar o catalogo',
          variant: 'destructive',
        });
        return null;
      }

      setGenerating(true);

      try {
        const catalogo = await createCatalogoFirebase({
          tecidoIds,
          tecidosSnapshot: options?.tecidosSnapshot,
          totalCoresSnapshot: options?.totalCoresSnapshot,
          totalEstampasSnapshot: options?.totalEstampasSnapshot,
        });
        const url = getCatalogoUrl(catalogo.id);

        setCatalogosHistorico((prev) => [catalogo, ...prev.filter((item) => item.id !== catalogo.id)]);
        return url;
      } catch (err: any) {
        toast({
          title: 'Erro',
          description: err.message || 'Erro ao criar link do catalogo',
          variant: 'destructive',
        });
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [toast]
  );

  /**
   * Carrega o historico de catalogos do usuario autenticado
   */
  const loadCatalogosHistorico = useCallback(async (): Promise<Catalogo[] | null> => {
    setHistoryLoading(true);

    try {
      const items = await listCatalogosByCurrentUser(40);
      setCatalogosHistorico(items);
      return items;
    } catch (err: any) {
      console.error('Erro ao carregar historico de catalogos:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Nao foi possivel carregar o historico de catalogos',
        variant: 'destructive',
      });
      return null;
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  /**
   * Carrega os tecidos e seus vinculos (cores) de um catalogo pelo ID
   * Usado na pagina publica para exibir o catalogo
   */
  const loadCatalogoTecidos = useCallback(
    async (catalogoId: string): Promise<TecidoComVinculosPublico[] | null> => {
      setLoading(true);

      try {
        const catalogo = await getCatalogoById(catalogoId);

        if (!catalogo) {
          return null; // Catalogo nao existe ou expirou
        }

        // Carregar todos os tecidos e vinculos em paralelo
        const tecidosPromises = catalogo.tecidoIds.map(async (tecidoId) => {
          const [tecido, vinculos] = await Promise.all([
            getTecidoById(tecidoId),
            getCorTecidosByTecidoId(tecidoId),
          ]);

          // Se tecido nao existe ou nao tem vinculos com imagem, retornar null
          if (!tecido) return null;

          const vinculosComImagem = vinculos.filter((v) => v.imagemTingida);
          if (vinculosComImagem.length === 0) return null;

          return {
            tecido,
            vinculos: vinculosComImagem.sort((a, b) => (a.corNome || '').localeCompare(b.corNome || '')),
          };
        });

        const tecidosCarregados = await Promise.all(tecidosPromises);

        // Filtrar resultados nulos e criar array final
        const resultados = tecidosCarregados.filter(
          (item): item is TecidoComVinculosPublico => item !== null
        );

        // Ordenar por nome do tecido
        resultados.sort((a, b) => a.tecido.nome.localeCompare(b.tecido.nome));

        return resultados;
      } catch (err: any) {
        console.error('Erro ao carregar catalogo:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    generating,
    historyLoading,
    catalogosHistorico,
    createCatalogoLink,
    loadCatalogoTecidos,
    loadCatalogosHistorico,
  };
}
