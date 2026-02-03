import { useState, useEffect } from 'react';
import { CapturaItem, AjustesCor } from '@/types/captura.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useReinhardTingimento } from '@/hooks/useReinhardTingimento';
import { hexToRgb } from '@/lib/colorUtils';

interface CapturaEdicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captura: CapturaItem | null;
  onSalvar: (captura: CapturaItem, nome: string, ajustes: AjustesCor) => void;
  loading?: boolean;
}

/**
 * Modal de edição/visualização de captura
 * Mostra preview do tecido tingido com algoritmo de Reinhart
 * Permite ajustes finos de cor com sliders
 */
export function CapturaEdicaoModal({
  open,
  onOpenChange,
  captura,
  onSalvar,
  loading = false,
}: CapturaEdicaoModalProps) {
  const { aplicarTingimento } = useReinhardTingimento();
  const [imagemTingida, setImagemTingida] = useState<string>('');
  const [carregandoImagem, setCarregandoImagem] = useState(false);
  const [nome, setNome] = useState('');
  const [ajustes, setAjustes] = useState<AjustesCor>({
    hue: 0,
    saturation: 0,
    brightness: 0,
    contrast: 0,
  });

  // Resetar ajustes e nome quando captura mudar
  useEffect(() => {
    if (captura) {
      setNome(captura.nome);
      setAjustes(captura.ajustes || { hue: 0, saturation: 0, brightness: 0, contrast: 0 });
    }
  }, [captura]);

  // Aplicar tingimento quando captura ou ajustes mudarem
  useEffect(() => {
    if (!captura || !open) {
      setImagemTingida('');
      return;
    }

    const aplicar = async () => {
      setCarregandoImagem(true);
      try {
        const rgb = hexToRgb(captura.hex);
        if (!rgb) {
          setCarregandoImagem(false);
          return;
        }

        const dataURL = await aplicarTingimento(
          captura.tecidoImagemPadrao,
          rgb,
          ajustes,
          { saturationMultiplier: 1.0, detailAmount: 1.05 }
        );
        setImagemTingida(dataURL);
      } catch (error) {
        console.error('Erro ao aplicar tingimento:', error);
      } finally {
        setCarregandoImagem(false);
      }
    };

    aplicar();
  }, [captura, ajustes, open, aplicarTingimento]);

  const handleSalvar = () => {
    if (!captura || !nome.trim()) return;
    onSalvar(captura, nome.trim(), ajustes);
    onOpenChange(false);
  };

  const handleResetarAjustes = () => {
    setAjustes({ hue: 0, saturation: 0, brightness: 0, contrast: 0 });
  };

  if (!captura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg sm:text-xl pr-6 truncate">
            Editar Captura
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Visualize e ajuste a cor conforme necessário
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 -mx-4 sm:-mx-6 px-4 sm:px-6">
          {/* Campo de nome */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="nome-captura" className="text-sm">
              Nome da Cor <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nome-captura"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da cor capturada"
              className="w-full h-10 sm:h-9"
            />
          </div>

          {/* Preview do tecido tingido - menor em mobile */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Preview do Tecido Tingido</h3>
            <div className="relative border rounded-lg overflow-hidden bg-gray-100 aspect-[4/3] sm:aspect-video flex items-center justify-center transition-all duration-300">
              {carregandoImagem ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
                  <span className="text-xs text-gray-400">Processando...</span>
                </div>
              ) : imagemTingida ? (
                <img
                  src={imagemTingida}
                  alt={`${captura.nome} em ${captura.tecidoNome}`}
                  className="w-full h-full object-contain animate-fade-in"
                />
              ) : (
                <div className="text-gray-400 text-sm">Carregando preview...</div>
              )}
            </div>
          </div>

          {/* Sliders de ajuste - grid em tablet+ */}
          <div className="space-y-3 sm:space-y-4 border-t pt-3 sm:pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Ajustes de Cor</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetarAjustes}
                className="h-8 text-xs hover:bg-gray-100 transition-colors"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Resetar
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Slider
                label="Matiz (Hue)"
                value={ajustes.hue}
                onValueChange={(value) => setAjustes({ ...ajustes, hue: value })}
                min={-180}
                max={180}
                step={1}
              />

              <Slider
                label="Saturação"
                value={ajustes.saturation}
                onValueChange={(value) => setAjustes({ ...ajustes, saturation: value })}
                min={-100}
                max={100}
                step={1}
              />

              <Slider
                label="Brilho"
                value={ajustes.brightness}
                onValueChange={(value) => setAjustes({ ...ajustes, brightness: value })}
                min={-100}
                max={100}
                step={1}
              />

              <Slider
                label="Contraste"
                value={ajustes.contrast}
                onValueChange={(value) => setAjustes({ ...ajustes, contrast: value })}
                min={-100}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* Informações da cor - coluna unica em mobile */}
          <div className="space-y-3 border-t pt-3 sm:pt-4">
            <h3 className="text-sm font-semibold text-gray-700">Informações da Cor</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1.5">Valores LAB</div>
                <div className="font-mono text-xs sm:text-sm space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-gray-600">L:</span>
                    <span className="font-semibold">{captura.lab.L.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">a:</span>
                    <span className="font-semibold">{captura.lab.a.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">b:</span>
                    <span className="font-semibold">{captura.lab.b.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1.5">Código Hexadecimal</div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-sm flex-shrink-0 transition-transform hover:scale-105"
                    style={{ backgroundColor: captura.hex }}
                  />
                  <div>
                    <span className="font-mono text-sm font-semibold">{captura.hex}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{captura.tecidoNome}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta de conflito */}
            {captura.status === 'conflito' && captura.corConflitoNome && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2.5 animate-slide-up">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-yellow-900 text-sm mb-0.5">
                    Cor próxima de existente
                  </div>
                  <div className="text-xs sm:text-sm text-yellow-800">
                    Similar a <strong className="truncate">"{captura.corConflitoNome}"</strong>
                    {captura.deltaE !== undefined && (
                      <span className="ml-1">(ΔE: {captura.deltaE.toFixed(2)})</span>
                    )}
                  </div>
                  {captura.corConflitoHex && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div
                        className="w-5 h-5 rounded border border-yellow-300"
                        style={{ backgroundColor: captura.corConflitoHex }}
                      />
                      <span className="text-xs text-yellow-700 font-mono">
                        {captura.corConflitoHex}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer com botoes - empilhados em mobile */}
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-4 border-t mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto transition-all duration-200 active:scale-95"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvar} 
            disabled={loading || carregandoImagem || !nome.trim()}
            className="w-full sm:w-auto transition-all duration-200 active:scale-95"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
