import { useState, useEffect } from 'react';
import { Tecido } from '@/types/tecido.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 */
export function TecidoSelecaoModal({
  open,
  onOpenChange,
  onSelecionar,
  tecidos,
  loading = false,
}: TecidoSelecaoModalProps) {
  const [tecidoSelecionadoId, setTecidoSelecionadoId] = useState<string | null>(null);

  // Resetar seleção quando modal abrir
  useEffect(() => {
    if (open) {
      setTecidoSelecionadoId(null);
    }
  }, [open]);

  // Seleciona e confirma direto ao clicar
  const handleSelecionar = (tecido: Tecido) => {
    setTecidoSelecionadoId(tecido.id);
    // Pequeno delay para mostrar a seleção antes de fechar
    setTimeout(() => {
      onSelecionar(tecido);
      onOpenChange(false);
    }, 150);
  };

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
            <div className="p-8 text-center text-gray-500">
              Carregando tecidos...
            </div>
          ) : tecidos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>Nenhum tecido cadastrado</p>
              <p className="text-xs mt-1">Cadastre tecidos antes de capturar cores</p>
            </div>
          ) : (
            <div className="divide-y">
              {tecidos.map((tecido) => (
                <button
                  key={tecido.id}
                  type="button"
                  onClick={() => handleSelecionar(tecido)}
                  className={cn(
                    'w-full p-3 flex items-center gap-3 active:bg-gray-100 transition-colors',
                    tecidoSelecionadoId === tecido.id && 'bg-blue-50'
                  )}
                >
                  {/* Preview da imagem ou placeholder */}
                  <div className="flex-shrink-0">
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
                  </div>

                  {/* Informações */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{tecido.nome}</div>
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
              ))}
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
