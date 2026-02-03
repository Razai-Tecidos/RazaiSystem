import { CapturaItem } from '@/types/captura.types';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, AlertCircle } from 'lucide-react';
import { DeltaEBadge } from './DeltaEBadge';
import { cn } from '@/lib/utils';

interface CapturaItemComponenteProps {
  captura: CapturaItem;
  onEditar: (captura: CapturaItem) => void;
  onExcluir: (id: string) => void;
}

/**
 * Componente para exibir um item individual da lista de capturas
 */
export function CapturaItemComponente({
  captura,
  onEditar,
  onExcluir,
}: CapturaItemComponenteProps) {
  const temConflito = captura.status === 'conflito';

  return (
    <div
      className={cn(
        'p-3 sm:p-4 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-[0.995]',
        temConflito
          ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
          : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      {/* Layout mobile: vertical / Desktop: horizontal */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Swatch + Info principal */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Swatch miniatura */}
          <div
            className="w-14 h-14 sm:w-12 sm:h-12 rounded-lg border-2 border-gray-300 flex-shrink-0 shadow-sm transition-transform hover:scale-105"
            style={{ backgroundColor: captura.hex }}
            title={captura.hex}
          />

          {/* Informações */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                  {captura.nome}
                </h4>
                <div className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-1">
                  <span className="font-medium truncate max-w-[120px] sm:max-w-none">
                    {captura.tecidoNome}
                  </span>
                  <span className="text-gray-400 hidden sm:inline">•</span>
                  <span className="text-gray-500">{captura.tecidoSku}</span>
                </div>
              </div>

              {/* Badge de conflito - visivel apenas em desktop inline */}
              <div className="hidden sm:block">
                {temConflito && captura.deltaE !== undefined && (
                  <DeltaEBadge deltaE={captura.deltaE} />
                )}
              </div>
            </div>

            {/* Valores LAB - compacto em mobile */}
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-mono text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
              L={captura.lab.L.toFixed(1)} a={captura.lab.a.toFixed(1)} b={captura.lab.b.toFixed(1)}
              <span className="hidden sm:inline"> | {captura.hex}</span>
            </div>
          </div>
        </div>

        {/* Badge de conflito em mobile - linha separada */}
        {temConflito && captura.deltaE !== undefined && (
          <div className="sm:hidden">
            <DeltaEBadge deltaE={captura.deltaE} />
          </div>
        )}

        {/* Alerta de conflito detalhado */}
        {temConflito && captura.corConflitoNome && (
          <div className="flex items-start gap-2 text-xs text-yellow-800 bg-yellow-100/50 rounded-md p-2 sm:hidden">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-2">
              Próximo de <strong>"{captura.corConflitoNome}"</strong>
              {captura.corConflitoHex && (
                <span
                  className="inline-block w-3 h-3 rounded border border-yellow-300 align-middle ml-1"
                  style={{ backgroundColor: captura.corConflitoHex }}
                />
              )}
            </span>
          </div>
        )}

        {/* Botões de ação - linha separada em mobile */}
        <div className="flex gap-2 sm:flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditar(captura)}
            title="Editar captura"
            className="flex-1 sm:flex-none transition-all duration-200 hover:bg-primary/5 hover:border-primary/30 active:scale-95"
          >
            <Edit2 className="h-4 w-4 sm:mr-0" />
            <span className="ml-2 sm:hidden">Editar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExcluir(captura.id)}
            title="Excluir captura"
            className="flex-1 sm:flex-none transition-all duration-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:scale-95"
          >
            <Trash2 className="h-4 w-4 sm:mr-0" />
            <span className="ml-2 sm:hidden">Excluir</span>
          </Button>
        </div>
      </div>

      {/* Alerta de conflito detalhado - apenas desktop */}
      {temConflito && captura.corConflitoNome && (
        <div className="hidden sm:flex mt-3 items-start gap-2 text-xs text-yellow-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Próximo de <strong>"{captura.corConflitoNome}"</strong>
            {captura.corConflitoHex && (
              <span className="ml-1">
                (
                <span
                  className="inline-block w-3 h-3 rounded border border-yellow-300 align-middle mr-1"
                  style={{ backgroundColor: captura.corConflitoHex }}
                />
                {captura.corConflitoHex})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
