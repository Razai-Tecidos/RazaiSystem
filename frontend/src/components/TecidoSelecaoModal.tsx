import { useState, useEffect, useMemo, useRef } from 'react';
import { Tecido } from '@/types/tecido.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'razai_ultimos_tecidos';
const MAX_RECENTES = 5;

// Funções para gerenciar últimos tecidos usados
function getUltimosTecidosIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function salvarTecidoRecente(tecidoId: string): void {
  try {
    const atuais = getUltimosTecidosIds().filter(id => id !== tecidoId);
    const novos = [tecidoId, ...atuais].slice(0, MAX_RECENTES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novos));
  } catch {
    // Ignora erros de localStorage
  }
}

interface TecidoSelecaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelecionar: (tecido: Tecido) => void;
  tecidos: Tecido[];
  loading?: boolean;
}

/**
 * Modal para seleção de tecido
 * Lista simples sem busca para melhor experiência mobile
 * Mostra últimos tecidos usados primeiro
 */
export function TecidoSelecaoModal({
  open,
  onOpenChange,
  onSelecionar,
  tecidos,
  loading = false,
}: TecidoSelecaoModalProps) {
  const [tecidoSelecionadoId, setTecidoSelecionadoId] = useState<string | null>(null);
  const [ultimosIds, setUltimosIds] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar últimos tecidos quando modal abrir
  useEffect(() => {
    if (open) {
      setTecidoSelecionadoId(null);
      setUltimosIds(getUltimosTecidosIds());
    }

    // Cleanup do timeout ao fechar modal ou desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [open]);

  // Ordenar tecidos: recentes primeiro, depois alfabético
  const tecidosOrdenados = useMemo(() => {
    if (ultimosIds.length === 0) return tecidos;
    
    const recentes: Tecido[] = [];
    const outros: Tecido[] = [];
    
    tecidos.forEach(tecido => {
      if (ultimosIds.includes(tecido.id)) {
        recentes.push(tecido);
      } else {
        outros.push(tecido);
      }
    });
    
    // Ordenar recentes pela ordem de uso (mais recente primeiro)
    recentes.sort((a, b) => ultimosIds.indexOf(a.id) - ultimosIds.indexOf(b.id));
    
    // Ordenar outros alfabeticamente
    outros.sort((a, b) => a.nome.localeCompare(b.nome));
    
    return [...recentes, ...outros];
  }, [tecidos, ultimosIds]);

  // Seleciona e confirma direto ao clicar
  const handleSelecionar = (tecido: Tecido) => {
    setTecidoSelecionadoId(tecido.id);
    // Salvar como recente
    salvarTecidoRecente(tecido.id);

    // Limpar timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Pequeno delay para mostrar a seleção antes de fechar
    timeoutRef.current = setTimeout(() => {
      onSelecionar(tecido);
      onOpenChange(false);
      timeoutRef.current = null;
    }, 150);
  };

  // Verificar se um tecido é recente
  const isRecente = (tecidoId: string) => ultimosIds.includes(tecidoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[70vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-base sm:text-lg">Selecionar Tecido</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Toque no tecido para associar à cor
          </DialogDescription>
        </DialogHeader>

        {/* Lista de tecidos */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-3 flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="w-6 h-6 rounded-full" />
                </div>
              ))}
            </div>
          ) : tecidos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>Nenhum tecido cadastrado</p>
              <p className="text-xs mt-1">Cadastre tecidos antes de capturar cores</p>
            </div>
          ) : (
            <div className="divide-y">
              {tecidosOrdenados.map((tecido, index) => {
                const recente = isRecente(tecido.id);
                // Mostrar separador entre recentes e outros
                const mostrarSeparador = recente && 
                  index === ultimosIds.filter(id => tecidos.some(t => t.id === id)).length - 1 &&
                  tecidosOrdenados.length > index + 1;
                
                return (
                  <div key={tecido.id}>
                    <button
                      type="button"
                      onClick={() => handleSelecionar(tecido)}
                      className={cn(
                        'w-full p-3 flex items-center gap-3 active:bg-gray-100 transition-colors',
                        tecidoSelecionadoId === tecido.id && 'bg-blue-50',
                        recente && 'bg-amber-50/50'
                      )}
                    >
                      {/* Preview da imagem ou placeholder */}
                      <div className="flex-shrink-0 relative">
                        {tecido.imagemPadrao ? (
                          <img
                            src={tecido.imagemPadrao}
                            alt={tecido.nome}
                            className="w-12 h-12 object-cover rounded border border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded border border-gray-200 bg-gray-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        {/* Indicador de recente */}
                        {recente && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                            <Clock className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Informações */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {tecido.nome}
                        </div>
                        <div className="text-xs text-gray-500">{tecido.sku}</div>
                      </div>

                      {/* Check de seleção */}
                      <div className="flex-shrink-0">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                            tecidoSelecionadoId === tecido.id
                              ? 'border-blue-500 bg-blue-500 scale-110'
                              : 'border-gray-300'
                          )}
                        >
                          {tecidoSelecionadoId === tecido.id && (
                            <Check className="h-3.5 w-3.5 text-white" />
                          )}
                        </div>
                      </div>
                    </button>
                    
                    {/* Separador visual entre recentes e outros */}
                    {mostrarSeparador && (
                      <div className="px-3 py-1.5 bg-gray-100 text-xs text-gray-500 font-medium">
                        Outros tecidos
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer simples */}
        <div className="p-3 border-t bg-gray-50">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full"
            size="sm"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
