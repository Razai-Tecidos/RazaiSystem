import { useState, useCallback } from 'react';
import { Tecido } from '@/types/tecido.types';
import { CorTecido } from '@/types/cor.types';
import {
  createCatalogo as createCatalogoFirebase,
  getCatalogoById,
  getCatalogoUrl,
} from '@/lib/firebase/catalogos';
import { getTecidoById } from '@/lib/firebase/tecidos';
import { getCorTecidosByTecidoId } from '@/lib/firebase/cor-tecido';
import { useToast } from '@/hooks/use-toast';

// Tipo para agrupar vínculos por tecido (usado na página pública)
export interface TecidoComVinculosPublico {
  tecido: Tecido;
  vinculos: CorTecido[];
}

interface UseCatalogosReturn {
  // Estado
  loading: boolean;
  generating: boolean;
  
  // Ações
  createCatalogoLink: (tecidoIds: string[]) => Promise<string | null>;
  loadCatalogoTecidos: (catalogoId: string) => Promise<TecidoComVinculosPublico[] | null>;
}

/**
 * Hook para gerenciar catálogos e links compartilháveis
 */
export function useCatalogos(): UseCatalogosReturn {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  /**
   * Cria um catálogo e retorna a URL compartilhável
   */
  const createCatalogoLink = useCallback(
    async (tecidoIds: string[]): Promise<string | null> => {
      if (tecidoIds.length === 0) {
        toast({
          title: 'Atenção',
          description: 'Selecione pelo menos um tecido para criar o catálogo',
          variant: 'destructive',
        });
        return null;
      }

      setGenerating(true);

      try {
        const catalogo = await createCatalogoFirebase({ tecidoIds });
        const url = getCatalogoUrl(catalogo.id);

        return url;
      } catch (err: any) {
        toast({
          title: 'Erro',
          description: err.message || 'Erro ao criar link do catálogo',
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
   * Carrega os tecidos e seus vínculos (cores) de um catálogo pelo ID
   * Usado na página pública para exibir o catálogo
   */
  const loadCatalogoTecidos = useCallback(
    async (catalogoId: string): Promise<TecidoComVinculosPublico[] | null> => {
      setLoading(true);

      try {
        const catalogo = await getCatalogoById(catalogoId);

        if (!catalogo) {
          return null; // Catálogo não existe ou expirou
        }

        // Carregar todos os tecidos e vínculos em paralelo
        const tecidosPromises = catalogo.tecidoIds.map(async (tecidoId) => {
          const [tecido, vinculos] = await Promise.all([
            getTecidoById(tecidoId),
            getCorTecidosByTecidoId(tecidoId),
          ]);

          // Se tecido não existe ou não tem vínculos com imagem, retornar null
          if (!tecido) return null;

          const vinculosComImagem = vinculos.filter(v => v.imagemTingida);
          if (vinculosComImagem.length === 0) return null;

          return {
            tecido,
            vinculos: vinculosComImagem.sort((a, b) =>
              (a.corNome || '').localeCompare(b.corNome || '')
            ),
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
        console.error('Erro ao carregar catálogo:', err);
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
    createCatalogoLink,
    loadCatalogoTecidos,
  };
}
