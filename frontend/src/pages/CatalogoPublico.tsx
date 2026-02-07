import { useEffect, useState } from 'react';
import { useCatalogos, TecidoComVinculosPublico } from '@/hooks/useCatalogos';
import { Loader2, AlertCircle, Clock } from 'lucide-react';

interface CatalogoPublicoProps {
  catalogoId: string;
}

/**
 * Página pública do catálogo de cores
 * Exibe as cores (vínculos) agrupadas por tecido
 * Não requer autenticação
 */
export function CatalogoPublico({ catalogoId }: CatalogoPublicoProps) {
  const { loadCatalogoTecidos, loading } = useCatalogos();
  const [tecidosComVinculos, setTecidosComVinculos] = useState<TecidoComVinculosPublico[] | null>(null);
  const [error, setError] = useState<'not_found' | 'expired' | null>(null);

  useEffect(() => {
    async function load() {
      const resultado = await loadCatalogoTecidos(catalogoId);
      
      if (resultado === null) {
        setError('not_found');
      } else if (resultado.length === 0) {
        setError('expired');
      } else {
        setTecidosComVinculos(resultado);
      }
    }

    load();
  }, [catalogoId, loadCatalogoTecidos]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  // Erro: não encontrado ou expirado
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          {error === 'not_found' ? (
            <>
              <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Catálogo não encontrado
              </h1>
              <p className="text-gray-500">
                Este link de catálogo não existe ou foi removido.
              </p>
            </>
          ) : (
            <>
              <Clock className="h-16 w-16 text-amber-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Catálogo expirado
              </h1>
              <p className="text-gray-500">
                Este catálogo expirou. Solicite um novo link ao fornecedor.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Sem dados
  if (!tecidosComVinculos || tecidosComVinculos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Catálogo vazio
          </h1>
          <p className="text-gray-500">
            Este catálogo não possui cores cadastradas.
          </p>
        </div>
      </div>
    );
  }

  // Contagem total de cores
  const totalCores = tecidosComVinculos.reduce((acc, t) => acc + t.vinculos.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-wide">
                CATÁLOGO DE CORES
              </h1>
              <p className="text-sm text-gray-500">
                {tecidosComVinculos.length} {tecidosComVinculos.length === 1 ? 'tecido' : 'tecidos'} • {totalCores} {totalCores === 1 ? 'cor' : 'cores'}
              </p>
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">
              RAZAI
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-10">
          {tecidosComVinculos.map(({ tecido, vinculos }) => (
            <section key={tecido.id}>
              {/* Header do tecido */}
              <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  {tecido.nome}
                </h2>
                <span className="text-sm text-gray-400 font-mono">
                  {tecido.sku}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {vinculos.length} {vinculos.length === 1 ? 'cor' : 'cores'}
                </span>
              </div>

              {/* Grid de cores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {vinculos.map((vinculo) => (
                  <div key={vinculo.id} className="group">
                    {/* Imagem tingida */}
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-sm group-hover:shadow-md transition-shadow">
                      {vinculo.imagemTingida ? (
                        <img
                          src={vinculo.imagemTingida}
                          alt={vinculo.corNome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{ backgroundColor: vinculo.corHex || '#cccccc' }}
                        />
                      )}
                    </div>

                    {/* Informações da cor */}
                    <div className="mt-2 px-1">
                      <p className="text-sm font-medium text-gray-800 truncate" title={vinculo.corNome}>
                        {vinculo.corNome}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {vinculo.sku && (
                          <span className="text-xs text-gray-500 font-mono">
                            {vinculo.sku}
                          </span>
                        )}
                        {vinculo.corHex && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: vinculo.corHex }}
                            />
                            <span className="text-xs text-gray-400">
                              {vinculo.corHex}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            Catálogo gerado por RAZAI
          </p>
        </div>
      </footer>
    </div>
  );
}
