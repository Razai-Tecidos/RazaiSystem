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

        toast({
          title: 'Link criado!',
          description: 'O link do catálogo foi copiado para a área de transferência',
        });

        // Copiar para clipboard
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // Se não conseguir copiar, apenas retorna a URL
          console.warn('Não foi possível copiar para clipboard');
        }

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

        // Carregar cada tecido e seus vínculos
        const resultados: TecidoComVinculosPublico[] = [];

        for (const tecidoId of catalogo.tecidoIds) {
          const tecido = await getTecidoById(tecidoId);
          if (!tecido) continue; // Tecido foi excluído

          // Buscar vínculos (cores) deste tecido
          const vinculos = await getCorTecidosByTecidoId(tecidoId);
          
          // Filtrar apenas vínculos com imagem
          const vinculosComImagem = vinculos.filter(v => v.imagemTingida);

          if (vinculosComImagem.length > 0) {
            resultados.push({
              tecido,
              vinculos: vinculosComImagem.sort((a, b) => 
                (a.corNome || '').localeCompare(b.corNome || '')
              ),
            });
          }
        }

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
