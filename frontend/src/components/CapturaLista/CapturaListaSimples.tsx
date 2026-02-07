import { useState } from 'react';
import { CapturaItem } from '@/types/captura.types';
import { AcaoConflito } from '@/hooks/useCapturaLista';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Send, Loader2, ListX, X, Link, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapturaListaSimplesProps {
  capturas: CapturaItem[];
  onExcluir: (id: string) => void;
  onLimparLista: () => void;
  onEnviarCores: (acoesConflito: Map<string, AcaoConflito>) => Promise<void>;
  temConflitos: boolean;
  enviando?: boolean;
  className?: string;
}

/**
 * Componente simplificado para exibir lista de capturas
 * Com opções para conflitos: usar cor existente ou criar nova
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
  // Estado para armazenar a ação escolhida para cada conflito
  const [acoesConflito, setAcoesConflito] = useState<Map<string, AcaoConflito>>(new Map());

  // Verifica se todos os conflitos têm uma ação definida
  const conflitosResolvidos = capturas
    .filter(c => c.status === 'conflito')
    .every(c => acoesConflito.has(c.id));

  const handleAcaoConflito = (capturaId: string, acao: AcaoConflito) => {
    setAcoesConflito(prev => {
      const next = new Map(prev);
      next.set(capturaId, acao);
      return next;
    });
  };

  const handleEnviar = () => {
    onEnviarCores(acoesConflito);
  };

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
          {temConflitos && !conflitosResolvidos && (
            <div className="flex items-center gap-2 mt-1 text-sm text-yellow-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Escolha uma ação para as cores com conflito antes de enviar</span>
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
            onClick={handleEnviar}
            disabled={enviando || capturas.length === 0 || (temConflitos && !conflitosResolvidos)}
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
            acaoSelecionada={acoesConflito.get(captura.id)}
            onSelecionarAcao={(acao) => handleAcaoConflito(captura.id, acao)}
          />
        ))}
      </div>

      {/* Dica */}
      <p className="text-xs text-gray-500 text-center pt-2">
        Após enviar, edite os vínculos em "Vínculos" para ver o preview no tecido e fazer ajustes
      </p>
    </div>
  );
}

/**
 * Item simplificado da lista de capturas
 * Com opções expandíveis para conflitos
 */
function CapturaItemSimples({
  captura,
  onExcluir,
  acaoSelecionada,
  onSelecionarAcao,
}: {
  captura: CapturaItem;
  onExcluir: (id: string) => void;
  acaoSelecionada?: AcaoConflito;
  onSelecionarAcao: (acao: AcaoConflito) => void;
}) {
  const temConflito = captura.status === 'conflito';
  const [expandido, setExpandido] = useState(temConflito);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200',
        temConflito
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      {/* Linha principal */}
      <div className="p-3 flex items-center gap-3">
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
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                acaoSelecionada === 'usar_existente'
                  ? "bg-blue-200 text-blue-800"
                  : acaoSelecionada === 'criar_nova'
                  ? "bg-purple-200 text-purple-800"
                  : "bg-yellow-200 text-yellow-800"
              )}>
                {acaoSelecionada === 'usar_existente' 
                  ? 'Só vincular' 
                  : acaoSelecionada === 'criar_nova'
                  ? 'Criar nova'
                  : 'Conflito'}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span className="truncate max-w-[100px]">{captura.tecidoNome}</span>
            <span className="text-gray-300">•</span>
            <span className="font-mono">{captura.hex}</span>
          </div>
          
          {/* Alerta de conflito resumido */}
          {temConflito && captura.corConflitoNome && !expandido && (
            <div className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                Similar a "{captura.corConflitoNome}"
                {captura.deltaE !== undefined && ` (ΔE: ${captura.deltaE.toFixed(1)})`}
              </span>
            </div>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {temConflito && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-yellow-100 text-yellow-700"
              onClick={() => setExpandido(!expandido)}
              title={expandido ? "Recolher opções" : "Ver opções"}
            >
              {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
            onClick={() => onExcluir(captura.id)}
            title="Remover da lista"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Painel expandido com opções de conflito */}
      {temConflito && expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-yellow-200">
          {/* Info sobre a cor existente */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded border border-yellow-100">
            <div
              className="w-8 h-8 rounded border-2 border-gray-300 flex-shrink-0"
              style={{ backgroundColor: captura.corConflitoHex }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                Cor existente: "{captura.corConflitoNome}"
              </p>
              <p className="text-xs text-gray-500">
                {captura.corConflitoHex} • ΔE: {captura.deltaE?.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Opções */}
          <div className="space-y-2">
            <button
              onClick={() => onSelecionarAcao('usar_existente')}
              className={cn(
                "w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-start gap-3",
                acaoSelecionada === 'usar_existente'
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                acaoSelecionada === 'usar_existente'
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
              )}>
                {acaoSelecionada === 'usar_existente' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm text-gray-900">Só vincular (não cria cor nova)</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Usa a cor existente "{captura.corConflitoNome}" e cria um vínculo com "{captura.tecidoNome}"
                </p>
              </div>
            </button>

            <button
              onClick={() => onSelecionarAcao('criar_nova')}
              className={cn(
                "w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-start gap-3",
                acaoSelecionada === 'criar_nova'
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/50"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                acaoSelecionada === 'criar_nova'
                  ? "border-purple-500 bg-purple-500"
                  : "border-gray-300"
              )}>
                {acaoSelecionada === 'criar_nova' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm text-gray-900">Criar cor duplicada</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cadastra "{captura.nome}" como cor separada (aparecerá como conflito na gestão de cores)
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
