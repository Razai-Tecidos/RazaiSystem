import { CapturaItem } from '@/types/captura.types';
import { CapturaItemComponente } from './CapturaItemComponente';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Send, Loader2, ListX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapturaListaProps {
  capturas: CapturaItem[];
  onEditar: (captura: CapturaItem) => void;
  onExcluir: (id: string) => void;
  onLimparLista: () => void;
  onEnviarCores: () => Promise<void>;
  temConflitos: boolean;
  enviando?: boolean;
  className?: string;
}

/**
 * Componente principal para exibir lista de capturas
 */
export function CapturaLista({
  capturas,
  onEditar,
  onExcluir,
  onLimparLista,
  onEnviarCores,
  temConflitos,
  enviando = false,
  className,
}: CapturaListaProps) {
  if (capturas.length === 0) {
    return (
      <div className={cn(
        'bg-white rounded-lg border-2 border-dashed border-gray-200 p-6 sm:p-8 text-center animate-fade-in', 
        className
      )}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
          <ListX className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-500 font-medium">Nenhuma captura adicionada à lista</p>
        <p className="text-sm text-gray-400 mt-1">
          Capture uma cor e adicione à lista para começar
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Cabeçalho - responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">
            Lista de Capturas 
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({capturas.length} {capturas.length === 1 ? 'item' : 'itens'})
            </span>
          </h3>
          {temConflitos && (
            <div className="flex items-center gap-2 mt-1 text-sm text-yellow-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Algumas cores têm conflitos</span>
            </div>
          )}
        </div>
        
        {/* Botoes - empilhados em mobile */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onLimparLista}
            disabled={enviando}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto transition-all duration-200 active:scale-95"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button
            onClick={onEnviarCores}
            disabled={enviando || capturas.length === 0}
            size="sm"
            className="w-full sm:w-auto transition-all duration-200 active:scale-95"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Cores ({capturas.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Lista de capturas com animacao escalonada */}
      <div className="space-y-3 animate-stagger">
        {capturas.map((captura) => (
          <CapturaItemComponente
            key={captura.id}
            captura={captura}
            onEditar={onEditar}
            onExcluir={onExcluir}
          />
        ))}
      </div>
    </div>
  );
}
