import { useState, useEffect, useRef } from 'react';
import { CapturaItem } from '@/types/captura.types';
import { ReinhardConfig } from '@/hooks/useReinhardTingimento';
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
import { AlertCircle, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useReinhardTingimento } from '@/hooks/useReinhardTingimento';
import { useReinhardML } from '@/hooks/useReinhardML';
import { hexToRgb } from '@/lib/colorUtils';
import { calculateImageStats } from '@/lib/imageStats';
import { saveTrainingExample } from '@/lib/firebase/ml-training';
import { getTecidoById } from '@/lib/firebase/tecidos';
import { MLSuggestionBadge } from '@/components/ui/ml-suggestion-badge';

interface CapturaEdicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captura: CapturaItem | null;
  onSalvar: (captura: CapturaItem, nome: string) => void;
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
  const { predict, isReady, exampleCount } = useReinhardML();
  const [imagemTingida, setImagemTingida] = useState<string>('');
  const [carregandoImagem, setCarregandoImagem] = useState(false);
  const [nome, setNome] = useState('');
  const [configReinhard, setConfigReinhard] = useState<ReinhardConfig>({
    saturationMultiplier: 0.85,
    contrastBoost: 0.15,
    detailAmount: 1.15,
    darkenAmount: 5,
    shadowDesaturation: 0.6,
  });
  const [isMLSuggestion, setIsMLSuggestion] = useState(false);
  const [sugerindoAjustes, setSugerindoAjustes] = useState(false);
  
  // Cache da imagem original e debounce
  const imagemOriginalUrlCache = useRef<string>('');
  const imagemOriginalCache = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resetar nome e config quando captura mudar
  useEffect(() => {
    if (captura) {
      setNome(captura.nome);
      setConfigReinhard({
        saturationMultiplier: 0.85,
        contrastBoost: 0.15,
        detailAmount: 1.15,
        darkenAmount: 5,
        shadowDesaturation: 0.6,
      });
      setIsMLSuggestion(false);
    }
  }, [captura]);

  // Carregar imagem original uma vez e manter em cache
  useEffect(() => {
    if (!captura || !open || !captura.tecidoImagemPadrao) {
      // Limpar cache se não houver imagem
      if (imagemOriginalUrlCache.current) {
        URL.revokeObjectURL(imagemOriginalUrlCache.current);
        imagemOriginalUrlCache.current = '';
        imagemOriginalCache.current = '';
      }
      return;
    }

    // Se já temos a imagem em cache e é a mesma URL, não recarregar
    if (imagemOriginalCache.current === captura.tecidoImagemPadrao && imagemOriginalUrlCache.current) {
      return;
    }

    const carregarImagem = async () => {
      try {
        let urlLocal = captura.tecidoImagemPadrao;
        
        // Limpar URL anterior se existir
        if (imagemOriginalUrlCache.current) {
          URL.revokeObjectURL(imagemOriginalUrlCache.current);
        }

        // Se for URL do Firebase Storage, carregar blob
        if (urlLocal.includes('firebasestorage.googleapis.com') || urlLocal.includes('storage.googleapis.com')) {
          try {
            const { ref, getBlob } = await import('firebase/storage');
            const { storage } = await import('@/config/firebase');
            const urlObj = new URL(urlLocal);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
            
            if (pathMatch) {
              const storagePath = decodeURIComponent(pathMatch[1]);
              const storageRef = ref(storage, storagePath);
              
              try {
                const blob = await getBlob(storageRef);
                urlLocal = URL.createObjectURL(blob);
              } catch (sdkError) {
                console.warn('SDK getBlob falhou, tentando fetch com token:', sdkError);
                
                const { getAuth } = await import('firebase/auth');
                const auth = getAuth();
                const user = auth.currentUser;
                
                if (user) {
                  const token = await user.getIdToken();
                  const response = await fetch(urlLocal, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  
                  if (response.ok) {
                    const blob = await response.blob();
                    urlLocal = URL.createObjectURL(blob);
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Erro ao carregar imagem do Firebase:', error);
          }
        }

        // Atualizar cache
        imagemOriginalCache.current = captura.tecidoImagemPadrao;
        imagemOriginalUrlCache.current = urlLocal;
      } catch (error) {
        console.error('Erro ao carregar imagem:', error);
      }
    };

    carregarImagem();

    // Cleanup: revogar URL quando componente desmontar ou imagem mudar
    return () => {
      if (imagemOriginalUrlCache.current) {
        URL.revokeObjectURL(imagemOriginalUrlCache.current);
      }
    };
  }, [captura, open]);

  // Aplicar tingimento com debounce quando ajustes mudarem
  useEffect(() => {
    if (!captura || !open || !imagemOriginalUrlCache.current) {
      setImagemTingida('');
      return;
    }

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce de 300ms para evitar processamento excessivo
    debounceTimerRef.current = setTimeout(async () => {
      setCarregandoImagem(true);
      try {
        // Usar LAB diretamente se disponível (já compensado), senão converter de hex
        const corAlvo = captura.lab || (() => {
          const rgb = hexToRgb(captura.hex);
          if (!rgb) return null;
          return rgb;
        })();

        if (!corAlvo) {
          setCarregandoImagem(false);
          return;
        }

        const dataURL = await aplicarTingimento(
          imagemOriginalUrlCache.current,
          corAlvo,
          configReinhard
        );
        setImagemTingida(dataURL);
      } catch (error) {
        console.error('Erro ao aplicar tingimento:', error);
      } finally {
        setCarregandoImagem(false);
      }
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [captura, open, configReinhard, aplicarTingimento]);

  const handleSalvar = async () => {
    if (!captura || !nome.trim()) return;
    
    // Coletar dados para treinamento ML (em background, não bloqueia salvamento)
    collectTrainingData(captura, configReinhard).catch((error) => {
      console.error('Erro ao coletar dados de treinamento:', error);
      // Não mostrar erro ao usuário, é silencioso
    });
    
    onSalvar(captura, nome.trim());
    onOpenChange(false);
  };

  /**
   * Coleta dados de treinamento automaticamente quando usuário salva
   */
  const collectTrainingData = async (
    captura: CapturaItem,
    ajustes: ReinhardConfig
  ) => {
    try {
      // Buscar informações completas do tecido
      const tecido = await getTecidoById(captura.tecidoId);
      
      // Calcular estatísticas da imagem base
      const imagemStats = await calculateImageStats(captura.tecidoImagemPadrao);
      
      // Salvar exemplo de treinamento
      await saveTrainingExample({
        lab: captura.lab,
        tecidoTipo: tecido?.tipo || 'liso',
        tecidoComposicao: tecido?.composicao || '',
        imagemStats,
        ajustes,
      });
    } catch (error) {
      // Erro silencioso - não afeta experiência do usuário
      console.error('Erro ao coletar dados de treinamento:', error);
    }
  };

  /**
   * Sugere ajustes usando ML
   */
  const handleSugerirAjustes = async () => {
    if (!captura?.lab) return;
    
    setSugerindoAjustes(true);
    try {
      // Buscar informações do tecido
      const tecido = await getTecidoById(captura.tecidoId);
      
      // Calcular estatísticas da imagem
      const imagemStats = await calculateImageStats(captura.tecidoImagemPadrao);
      
      // Predizer ajustes
      const prediction = await predict(
        captura.lab,
        tecido?.tipo,
        tecido?.composicao,
        imagemStats
      );
      
      if (prediction?.ajustes) {
        setConfigReinhard(prediction.ajustes);
        setIsMLSuggestion(true);
      }
    } catch (error) {
      console.error('Erro ao sugerir ajustes:', error);
    } finally {
      setSugerindoAjustes(false);
    }
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

          {/* Ajustes do Algoritmo Reinhard */}
          <div className="space-y-3 border-t pt-3 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Ajustes do Algoritmo</h3>
                {isMLSuggestion && <MLSuggestionBadge />}
              </div>
              <div className="flex items-center gap-2">
                {isReady && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSugerirAjustes}
                    disabled={sugerindoAjustes || !captura?.lab}
                    className="h-8 text-xs"
                  >
                    {sugerindoAjustes ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Sugerindo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        Sugerir Ajustes
                      </>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfigReinhard({
                      saturationMultiplier: 0.85,
                      contrastBoost: 0.15,
                      detailAmount: 1.15,
                      darkenAmount: 5,
                      shadowDesaturation: 0.6,
                    });
                    setIsMLSuggestion(false);
                  }}
                  className="h-8 text-xs hover:bg-gray-100 transition-colors"
                >
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Resetar
                </Button>
              </div>
            </div>
            {isReady && exampleCount > 0 && (
              <p className="text-xs text-gray-500">
                Modelo treinado com {exampleCount} exemplos
              </p>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <Slider
                  label="Saturação"
                  value={configReinhard.saturationMultiplier || 0.85}
                  onValueChange={(value) => setConfigReinhard({ ...configReinhard, saturationMultiplier: value })}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                />
                <p className="text-xs text-gray-500 px-1">
                  <span className="font-medium">Aumentar:</span> Cores mais vibrantes e intensas
                  <br />
                  <span className="font-medium">Diminuir:</span> Cores mais suaves e neutras
                </p>
              </div>

              <div className="space-y-1">
                <Slider
                  label="Contraste"
                  value={configReinhard.contrastBoost || 0.15}
                  onValueChange={(value) => setConfigReinhard({ ...configReinhard, contrastBoost: value })}
                  min={0}
                  max={0.5}
                  step={0.01}
                />
                <p className="text-xs text-gray-500 px-1">
                  <span className="font-medium">Aumentar:</span> Maior diferença entre áreas claras e escuras
                  <br />
                  <span className="font-medium">Diminuir:</span> Imagem mais uniforme e suave
                </p>
              </div>

              <div className="space-y-1">
                <Slider
                  label="Detalhe/Textura"
                  value={configReinhard.detailAmount || 1.15}
                  onValueChange={(value) => setConfigReinhard({ ...configReinhard, detailAmount: value })}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                />
                <p className="text-xs text-gray-500 px-1">
                  <span className="font-medium">Aumentar:</span> Textura do tecido mais visível e detalhada
                  <br />
                  <span className="font-medium">Diminuir:</span> Superfície mais lisa e uniforme
                </p>
              </div>

              <div className="space-y-1">
                <Slider
                  label="Escurecimento"
                  value={configReinhard.darkenAmount || 5}
                  onValueChange={(value) => setConfigReinhard({ ...configReinhard, darkenAmount: value })}
                  min={0}
                  max={30}
                  step={1}
                />
                <p className="text-xs text-gray-500 px-1">
                  <span className="font-medium">Aumentar:</span> Imagem mais escura e sombria
                  <br />
                  <span className="font-medium">Diminuir:</span> Imagem mais clara e iluminada
                </p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Slider
                  label="Dessaturação de Sombras"
                  value={configReinhard.shadowDesaturation || 0.6}
                  onValueChange={(value) => setConfigReinhard({ ...configReinhard, shadowDesaturation: value })}
                  min={0}
                  max={1}
                  step={0.05}
                />
                <p className="text-xs text-gray-500 px-1">
                  <span className="font-medium">Aumentar:</span> Áreas escuras ficam mais acinzentadas
                  <br />
                  <span className="font-medium">Diminuir:</span> Áreas escuras mantêm mais cor
                </p>
              </div>
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
