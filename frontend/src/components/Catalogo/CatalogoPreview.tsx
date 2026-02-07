import { TecidoComVinculos, TecidoComEstampas } from '@/pages/Catalogo';
import { Palette, Image as ImageIcon } from 'lucide-react';

interface CatalogoPreviewProps {
  tecidosComVinculos: TecidoComVinculos[];
  tecidosComEstampas?: TecidoComEstampas[];
}

/**
 * Preview visual do catálogo (cores + estampas) antes de gerar PDF ou link
 */
export function CatalogoPreview({ 
  tecidosComVinculos, 
  tecidosComEstampas = [] 
}: CatalogoPreviewProps) {
  const temCores = tecidosComVinculos.length > 0;
  const temEstampas = tecidosComEstampas.length > 0;

  if (!temCores && !temEstampas) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <svg
          className="w-16 h-16 mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        <p className="text-sm">Selecione tecidos para visualizar o catálogo</p>
      </div>
    );
  }

  const totalCores = tecidosComVinculos.reduce((acc, t) => acc + t.vinculos.length, 0);
  const totalEstampas = tecidosComEstampas.reduce((acc, t) => acc + t.estampas.length, 0);

  return (
    <div className="bg-white rounded-lg border shadow-sm max-h-[500px] overflow-y-auto">
      {/* Header do Preview */}
      <div className="sticky top-0 bg-white border-b p-3 z-10">
        <h4 className="font-semibold text-gray-800 text-sm">Preview do Catálogo</h4>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          {temCores && (
            <span className="flex items-center gap-1">
              <Palette className="h-3 w-3" />
              {totalCores} {totalCores === 1 ? 'cor' : 'cores'}
            </span>
          )}
          {temEstampas && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {totalEstampas} {totalEstampas === 1 ? 'estampa' : 'estampas'}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-6">
        {/* Seção de Cores */}
        {temCores && (
          <div>
            {temEstampas && (
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <Palette className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-700">Cores</span>
                <span className="text-xs text-gray-400">
                  {tecidosComVinculos.length} {tecidosComVinculos.length === 1 ? 'tecido' : 'tecidos'}
                </span>
              </div>
            )}

            <div className="space-y-4">
              {tecidosComVinculos.map(({ tecido, vinculos }) => (
                <div key={tecido.id}>
                  {/* Nome do tecido */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {tecido.nome}
                    </span>
                    <span className="text-xs text-gray-400">
                      {tecido.sku}
                    </span>
                  </div>

                  {/* Grid de cores */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {vinculos.map((vinculo) => (
                      <div key={vinculo.id} className="text-center">
                        <div className="aspect-square rounded-md overflow-hidden bg-gray-100 mb-1">
                          {vinculo.imagemTingida ? (
                            <img
                              src={vinculo.imagemTingida}
                              alt={vinculo.corNome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: vinculo.corHex || '#ccc' }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate" title={vinculo.corNome}>
                          {vinculo.corNome}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção de Estampas */}
        {temEstampas && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <ImageIcon className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">Estampas</span>
              <span className="text-xs text-gray-400">
                {tecidosComEstampas.length} {tecidosComEstampas.length === 1 ? 'tecido' : 'tecidos'}
              </span>
            </div>

            <div className="space-y-4">
              {tecidosComEstampas.map(({ tecido, estampas }) => (
                <div key={tecido.id}>
                  {/* Nome do tecido */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {tecido.nome}
                    </span>
                    <span className="text-xs text-gray-400">
                      {tecido.sku}
                    </span>
                  </div>

                  {/* Grid de estampas */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {estampas.map((estampa) => (
                      <div key={estampa.id} className="text-center">
                        <div className="aspect-square rounded-md overflow-hidden bg-gray-100 mb-1">
                          {estampa.imagem ? (
                            <img
                              src={estampa.imagem}
                              alt={estampa.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate" title={estampa.nome}>
                          {estampa.nome}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
