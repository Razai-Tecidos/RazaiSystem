import { useMemo } from 'react';
import { TecidoComVinculos } from '@/lib/firebase/catalogos';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface TecidoCheckboxListProps {
  tecidosComVinculos: TecidoComVinculos[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

/**
 * Lista de tecidos com checkboxes para seleção múltipla
 * Mostra quantidade de cores em cada tecido
 */
export function TecidoCheckboxList({
  tecidosComVinculos,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: TecidoCheckboxListProps) {
  const allSelected = useMemo(
    () => tecidosComVinculos.length > 0 && selectedIds.size === tecidosComVinculos.length,
    [tecidosComVinculos.length, selectedIds.size]
  );

  const someSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < tecidosComVinculos.length,
    [selectedIds.size, tecidosComVinculos.length]
  );

  const totalCores = useMemo(
    () => tecidosComVinculos.reduce((acc, t) => acc + t.vinculos.length, 0),
    [tecidosComVinculos]
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
              ? `${selectedIds.size} de ${tecidosComVinculos.length} tecidos`
              : 'Selecionar todos'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {totalCores} cores no total
        </span>
      </div>

      {/* Lista de tecidos */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {tecidosComVinculos.map(({ tecido, vinculos }) => {
          const isSelected = selectedIds.has(tecido.id);

          return (
            <div
              key={tecido.id}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all',
                isSelected
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              )}
              onClick={() => onToggle(tecido.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(tecido.id)}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Preview das cores (mini swatches) */}
              <div className="flex -space-x-1">
                {vinculos.slice(0, 5).map((vinculo: any, idx: number) => (
                  <div
                    key={vinculo.id}
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ 
                      backgroundColor: vinculo.corHex || '#ccc',
                      zIndex: 5 - idx,
                    }}
                    title={vinculo.corNome}
                  />
                ))}
                {vinculos.length > 5 && (
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm bg-gray-200 flex items-center justify-center text-xs text-gray-600"
                    style={{ zIndex: 0 }}
                  >
                    +{vinculos.length - 5}
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-gray-900 truncate">
                    {tecido.nome}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {tecido.sku}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {vinculos.length} {vinculos.length === 1 ? 'cor' : 'cores'}
                </div>
              </div>
            </div>
          );
        })}

        {tecidosComVinculos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum tecido com cores cadastradas
          </div>
        )}
      </div>
    </div>
  );
}
