import { useMemo } from 'react';
import { TecidoComEstampas } from '@/pages/Catalogo';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface EstampaCheckboxListProps {
  tecidosComEstampas: TecidoComEstampas[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

/**
 * Lista de tecidos com checkboxes para seleção de estampas
 * Mostra quantidade de estampas em cada tecido base
 */
export function EstampaCheckboxList({
  tecidosComEstampas,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: EstampaCheckboxListProps) {
  const allSelected = useMemo(
    () => tecidosComEstampas.length > 0 && selectedIds.size === tecidosComEstampas.length,
    [tecidosComEstampas.length, selectedIds.size]
  );

  const someSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < tecidosComEstampas.length,
    [selectedIds.size, tecidosComEstampas.length]
  );

  const totalEstampas = useMemo(
    () => tecidosComEstampas.reduce((acc, t) => acc + t.estampas.length, 0),
    [tecidosComEstampas]
  );

  return (
    <div className="space-y-4">
      {/* Header com seleção total */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
            onCheckedChange={() => {
              if (allSelected || someSelected) {
                onDeselectAll();
              } else {
                onSelectAll();
              }
            }}
          />
          <span className="text-sm font-medium text-gray-700">
            {allSelected
              ? 'Todos selecionados'
              : someSelected
              ? `${selectedIds.size} de ${tecidosComEstampas.length} tecidos`
              : 'Selecionar todos'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {totalEstampas} estampas no total
        </span>
      </div>

      {/* Lista de tecidos */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {tecidosComEstampas.map(({ tecido, estampas }) => {
          const isSelected = selectedIds.has(tecido.id);

          return (
            <div
              key={tecido.id}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all',
                isSelected
                  ? 'bg-purple-50 border-purple-300'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              )}
              onClick={() => onToggle(tecido.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(tecido.id)}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Preview das estampas (mini thumbnails) */}
              <div className="flex -space-x-1">
                {estampas.slice(0, 4).map((estampa, idx) => (
                  <div
                    key={estampa.id}
                    className="w-8 h-8 rounded border-2 border-white shadow-sm overflow-hidden bg-gray-100"
                    style={{ zIndex: 4 - idx }}
                    title={estampa.nome}
                  >
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
                ))}
                {estampas.length > 4 && (
                  <div 
                    className="w-8 h-8 rounded border-2 border-white shadow-sm bg-gray-200 flex items-center justify-center text-xs text-gray-600"
                    style={{ zIndex: 0 }}
                  >
                    +{estampas.length - 4}
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-gray-900 truncate">
                    {tecido.nome}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                    {tecido.sku}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {estampas.length} {estampas.length === 1 ? 'estampa' : 'estampas'}
                </div>
              </div>
            </div>
          );
        })}

        {tecidosComEstampas.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum tecido com estampas cadastradas
          </div>
        )}
      </div>
    </div>
  );
}
