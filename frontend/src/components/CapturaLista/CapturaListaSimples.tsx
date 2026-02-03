import { CapturaItem } from '@/types/captura.types';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Send, Loader2, ListX, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapturaListaSimplesProps {
  capturas: CapturaItem[];
  onExcluir: (id: string) => void;
  onLimparLista: () => void;
  onEnviarCores: () => Promise<void>;
  temConflitos: boolean;
  enviando?: boolean;
  className?: string;
}

/**
 * Componente simplificado para exibir lista de capturas
 * Sem opção de edição - apenas visualização e envio
 */
export function CapturaListaSimples({
  capturas,
  onExcluir,
  onLimparLista,
  onEnviarCores,
  temConflitos,
  enviando = false,
  className,
}: CapturaListaSimplesProps) {
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
              <span className="truncate">Algumas cores têm conflitos com cores já cadastradas</span>
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
                Enviar para Gerenciar Cores
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Lista de capturas com animacao escalonada */}
      <div className="space-y-2 animate-stagger">
        {capturas.map((captura) => (
          <CapturaItemSimples
            key={captura.id}
            captura={captura}
            onExcluir={onExcluir}
          />
        ))}
      </div>

      {/* Dica */}
      <p className="text-xs text-gray-500 text-center pt-2">
        Após enviar, edite as cores em "Gerenciar Cores" para ver o preview no tecido e fazer ajustes
      </p>
    </div>
  );
}

/**
 * Item simplificado da lista de capturas
 */
function CapturaItemSimples({
  captura,
  onExcluir,
}: {
  captura: CapturaItem;
  onExcluir: (id: string) => void;
}) {
  const temConflito = captura.status === 'conflito';

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all duration-200 flex items-center gap-3',
        temConflito
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      {/* Swatch miniatura */}
      <div
        className="w-10 h-10 rounded-lg border-2 border-gray-300 flex-shrink-0 shadow-sm"
        style={{ backgroundColor: captura.hex }}
        title={captura.hex}
      />

      {/* Informações */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm truncate">
            {captura.nome}
          </span>
          {temConflito && (
            <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
              Conflito
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <span className="truncate max-w-[100px]">{captura.tecidoNome}</span>
          <span className="text-gray-300">•</span>
          <span className="font-mono">{captura.hex}</span>
        </div>
        
        {/* Alerta de conflito */}
        {temConflito && captura.corConflitoNome && (
          <div className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              Similar a "{captura.corConflitoNome}"
              {captura.deltaE !== undefined && ` (ΔE: ${captura.deltaE.toFixed(1)})`}
            </span>
          </div>
        )}
      </div>

      {/* Botão excluir */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 hover:bg-red-50 hover:text-red-600 transition-colors"
        onClick={() => onExcluir(captura.id)}
        title="Remover da lista"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
