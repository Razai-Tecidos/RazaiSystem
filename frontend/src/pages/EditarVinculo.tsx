import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useCores } from '@/hooks/useCores';
import { useTecidos } from '@/hooks/useTecidos';
import { useReinhardTingimento, ReinhardConfig } from '@/hooks/useReinhardTingimento';
import { useReinhardML } from '@/hooks/useReinhardML';
import { CorTecido, CreateCorTecidoData } from '@/types/cor.types';
import { ImageStats } from '@/types/ml.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { 
  getCorTecidoById,
  uploadImagemTingida,
} from '@/lib/firebase/cor-tecido';
import { 
  saveTrainingExample,
  deleteTrainingExamplesByCorId,
} from '@/lib/firebase/ml-training';
import { compressToMaxSize } from '@/lib/imageCompression';
import { 
  Loader2, 
  Save, 
  ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  AlertTriangle,
  Brain,
  Sparkles,
} from 'lucide-react';

/**
 * Calcula estatísticas de luminância de uma imagem
 */
async function calcularImageStats(imagemUrl: string): Promise<ImageStats> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve({
          meanLuminance: 50,
          stdLuminance: 15,
          meanContrast: 0.5,
          minLuminance: 0,
          maxLuminance: 100,
        });
        return;
      }
      
      // Reduzir para performance
      const maxSize = 100;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const luminances: number[] = [];
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminância relativa (ITU-R BT.709)
        const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 * 100;
        luminances.push(L);
      }
      
      const meanL = luminances.reduce((a, b) => a + b, 0) / luminances.length;
      const minL = Math.min(...luminances);
      const maxL = Math.max(...luminances);
      const variance = luminances.reduce((sum, l) => sum + Math.pow(l - meanL, 2), 0) / luminances.length;
      const stdL = Math.sqrt(variance);
      const contrast = (maxL - minL) / 100;
      
      resolve({
        meanLuminance: meanL,
        stdLuminance: stdL,
        meanContrast: contrast,
        minLuminance: minL,
        maxLuminance: maxL,
      });
    };
    
    img.onerror = () => {
      resolve({
        meanLuminance: 50,
        stdLuminance: 15,
        meanContrast: 0.5,
        minLuminance: 0,
        maxLuminance: 100,
      });
    };
    
    img.src = imagemUrl;
  });
}

interface EditarVinculoProps {
  vinculoId: string | null; // null = novo vínculo
  onNavigateBack: () => void;
  onNavigateHome?: () => void;
}

// Valores padrão para ajustes Reinhard
const DEFAULT_AJUSTES: ReinhardConfig = {
  saturationMultiplier: 0.85,
  contrastBoost: 0.15,
  detailAmount: 1.15,
  luminanceSCurve: 0,
  darkenAmount: 5,
  shadowDesaturation: 0.6,
  hueShift: 0,
};

export function EditarVinculo({ vinculoId, onNavigateBack, onNavigateHome }: EditarVinculoProps) {
  const { toast } = useToast();
  const { createVinculo, updateVinculo } = useCorTecido();
  const { cores, loading: loadingCores } = useCores();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { aplicarTingimento } = useReinhardTingimento();
  const { predict, isReady: mlReady, exampleCount, status: mlStatus } = useReinhardML();

  const [_vinculo, setVinculo] = useState<CorTecido | null>(null);
  const [loading, setLoading] = useState(!!vinculoId);
  const [saving, setSaving] = useState(false);
  const [processando, setProcessando] = useState(false);
  
  // Seleções
  const [selectedCorId, setSelectedCorId] = useState<string>('');
  const [selectedTecidoId, setSelectedTecidoId] = useState<string>('');
  
  // Imagem tingida e ajustes
  const [imagemTingida, setImagemTingida] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<ReinhardConfig>(DEFAULT_AJUSTES);
  const [imagemTecidoError, setImagemTecidoError] = useState(false);
  
  // ML sugestão
  const [mlSugestao, setMlSugestao] = useState<{ ajustes: ReinhardConfig; confidence: number } | null>(null);
  const [buscandoSugestao, setBuscandoSugestao] = useState(false);
  const [sugestaoAplicada, setSugestaoAplicada] = useState(false);
  
  // Debounce ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Cor e Tecido selecionados
  const selectedCor = useMemo(() => {
    const found = cores.find(c => c.id === selectedCorId) || null;
    if (selectedCorId && !found && cores.length > 0) {
      console.log('[EditarVinculo] COR NÃO ENCONTRADA! IDs disponíveis:', cores.map(c => c.id));
    }
    console.log('[EditarVinculo] selectedCor lookup:', { 
      selectedCorId, 
      coresLength: cores.length, 
      found: found?.nome || null 
    });
    return found;
  }, [cores, selectedCorId]);
  
  const selectedTecido = useMemo(() => {
    const found = tecidos.find(t => t.id === selectedTecidoId) || null;
    console.log('[EditarVinculo] selectedTecido lookup:', { 
      selectedTecidoId, 
      tecidosLength: tecidos.length, 
      found: found?.nome || null 
    });
    return found;
  }, [tecidos, selectedTecidoId]);

  // Carregar vínculo existente
  useEffect(() => {
    if (!vinculoId) {
      console.log('[EditarVinculo] Modo novo vínculo (vinculoId é null)');
      setLoading(false);
      return;
    }

    console.log('[EditarVinculo] Carregando vínculo:', vinculoId);
    setLoading(true);
    getCorTecidoById(vinculoId)
      .then((data) => {
        console.log('[EditarVinculo] Dados do vínculo:', data);
        if (data) {
          setVinculo(data);
          setSelectedCorId(data.corId);
          setSelectedTecidoId(data.tecidoId);
          console.log('[EditarVinculo] IDs setados:', { corId: data.corId, tecidoId: data.tecidoId });
          
          // Carregar ajustes salvos
          if (data.ajustesReinhard) {
            setAjustes(data.ajustesReinhard);
          }
          
          // Carregar imagem tingida salva
          if (data.imagemTingida) {
            setImagemTingida(data.imagemTingida);
          }
        } else {
          console.log('[EditarVinculo] Vínculo não encontrado!');
        }
      })
      .catch((err) => {
        console.error('[EditarVinculo] Erro ao carregar vínculo:', err);
      })
      .finally(() => setLoading(false));
  }, [vinculoId]);

  // Aplicar tingimento
  const processarTingimento = useCallback(async () => {
    console.log('[Tingimento] Verificando condições:', {
      temCor: !!selectedCor,
      temLab: !!selectedCor?.lab,
      temTecido: !!selectedTecido,
      temImagemPadrao: !!selectedTecido?.imagemPadrao,
      imagemPadraoUrl: selectedTecido?.imagemPadrao?.substring(0, 100),
    });
    
    if (!selectedCor?.lab || !selectedTecido?.imagemPadrao) {
      console.log('[Tingimento] Condições não atendidas, abortando');
      return;
    }
    
    setProcessando(true);
    try {
      console.log('[Tingimento] Iniciando processamento...');
      const resultado = await aplicarTingimento(
        selectedTecido.imagemPadrao,
        selectedCor.lab,
        ajustes
      );
      console.log('[Tingimento] Processamento concluído');
      setImagemTingida(resultado);
    } catch (error) {
      console.error('[Tingimento] Erro ao processar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar tingimento',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  }, [selectedCor, selectedTecido, ajustes, aplicarTingimento, toast]);

  // Aplicar tingimento quando seleções ou ajustes mudam (com debounce)
  useEffect(() => {
    if (!selectedCor?.lab || !selectedTecido?.imagemPadrao) return;
    
    // Debounce para evitar muitas chamadas
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      processarTingimento();
    }, 300);
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [selectedCor, selectedTecido, ajustes, processarTingimento]);

  const resetAjustes = () => {
    setAjustes(DEFAULT_AJUSTES);
    setSugestaoAplicada(false);
  };

  // Buscar sugestão do ML quando cor e tecido são selecionados
  useEffect(() => {
    const buscarSugestaoML = async () => {
      // Só buscar sugestão se ML estiver pronto e tiver cor/tecido selecionados
      if (!mlReady || !selectedCor?.lab || !selectedTecido) {
        setMlSugestao(null);
        return;
      }

      setBuscandoSugestao(true);
      try {
        // Calcular estatísticas da imagem do tecido
        let imagemStats: ImageStats | undefined;
        if (selectedTecido.imagemPadrao) {
          imagemStats = await calcularImageStats(selectedTecido.imagemPadrao);
        }

        // Buscar predição do ML (agora com tecidoNome e tecidoId para aprendizado específico)
        const predicao = await predict(
          selectedCor.lab,
          selectedTecido.tipo,
          selectedTecido.composicao,
          imagemStats,
          selectedTecido.nome,
          selectedTecido.id
        );

        if (predicao) {
          setMlSugestao({
            ajustes: predicao.ajustes,
            confidence: predicao.confidence ?? 0.5, // Default 50% se não informado
          });
          console.log('[ML] Sugestão recebida:', predicao);
        } else {
          setMlSugestao(null);
        }
      } catch (error) {
        console.error('[ML] Erro ao buscar sugestão:', error);
        setMlSugestao(null);
      } finally {
        setBuscandoSugestao(false);
      }
    };

    buscarSugestaoML();
  }, [vinculoId, mlReady, selectedCor, selectedTecido, predict]);

  // Aplicar sugestão do ML
  const aplicarSugestaoML = () => {
    if (mlSugestao) {
      setAjustes(mlSugestao.ajustes);
      setSugestaoAplicada(true);
      toast({
        title: 'Sugestão ML aplicada',
        description: `Ajustes sugeridos com ${Math.round(mlSugestao.confidence * 100)}% de confiança`,
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCorId || !selectedTecidoId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma cor e um tecido',
        variant: 'destructive',
      });
      return;
    }

    const cor = cores.find(c => c.id === selectedCorId);
    const tecido = tecidos.find(t => t.id === selectedTecidoId);
    
    if (!cor || !tecido) {
      toast({
        title: 'Erro',
        description: 'Cor ou tecido não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Preparar URL da imagem tingida
      let imagemTingidaUrl: string | undefined = undefined;
      
      // ID do vínculo (existente ou temporário para novo)
      const vinculoIdParaUpload = vinculoId || `temp_${Date.now()}`;
      
      // Se tiver imagem tingida, fazer upload ao Storage
      if (imagemTingida) {
        try {
          toast({
            title: 'Processando...',
            description: 'Comprimindo e enviando imagem...',
          });
          
          // Processar imagem tingida (PNG sem compressão)
          const tingidaBlob = await compressToMaxSize(imagemTingida);
          imagemTingidaUrl = await uploadImagemTingida(vinculoIdParaUpload, tingidaBlob);
          
          console.log('[EditarVinculo] Imagem enviada ao Storage:', imagemTingidaUrl);
        } catch (uploadError) {
          console.error('[EditarVinculo] Erro ao fazer upload da imagem:', uploadError);
          // Continuar com a URL base64 como fallback
          imagemTingidaUrl = imagemTingida;
        }
      }
      
      if (vinculoId) {
        // Atualizar vínculo existente
        await updateVinculo({
          id: vinculoId,
          imagemTingida: imagemTingidaUrl || undefined,
          ajustesReinhard: ajustes,
          // Atualizar dados denormalizados caso tenham mudado
          corNome: cor.nome,
          corHex: cor.codigoHex,
          corSku: cor.sku,
          tecidoNome: tecido.nome,
          tecidoSku: tecido.sku,
        });
        
        toast({
          title: 'Sucesso',
          description: 'Vínculo atualizado com sucesso!',
        });
      } else {
        // Criar novo vínculo
        const data: CreateCorTecidoData = {
          corId: cor.id,
          corNome: cor.nome,
          corHex: cor.codigoHex,
          corSku: cor.sku,
          tecidoId: tecido.id,
          tecidoNome: tecido.nome,
          tecidoSku: tecido.sku,
          imagemTingida: imagemTingidaUrl || undefined,
          ajustesReinhard: ajustes,
        };
        
        await createVinculo(data);
        
        toast({
          title: 'Sucesso',
          description: 'Vínculo criado com sucesso!',
        });
      }

      // Salvar exemplo de treinamento para ML (se tiver LAB e imagem do tecido)
      if (cor.lab && tecido.imagemPadrao) {
        try {
          // Calcular estatísticas da imagem base
          const imagemStats = await calcularImageStats(tecido.imagemPadrao);
          
          // Deletar exemplos anteriores desta cor (para evitar dados conflitantes)
          await deleteTrainingExamplesByCorId(cor.id);
          
          // Salvar novo exemplo (agora com tecidoId e tecidoNome para aprendizado específico)
          await saveTrainingExample({
            corId: cor.id,
            lab: cor.lab,
            tecidoId: tecido.id,
            tecidoNome: tecido.nome,
            tecidoTipo: tecido.tipo,
            tecidoComposicao: tecido.composicao,
            imagemStats,
            ajustes,
          });
          
          console.log('Exemplo de treinamento salvo para ML');
        } catch (mlError) {
          // Não falhar o salvamento principal se o ML falhar
          console.warn('Erro ao salvar exemplo de treinamento:', mlError);
        }
      }

      onNavigateBack();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar vínculo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingCores || loadingTecidos) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Vínculos', onClick: onNavigateBack },
          { label: vinculoId ? 'Editar Vínculo' : 'Novo Vínculo' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onNavigateBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              {vinculoId ? 'Editar Vínculo' : 'Novo Vínculo'}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seleções */}
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2">Seleção</h2>
              
              {/* Seleção de Cor */}
              <div className="space-y-2">
                <Label htmlFor="cor">Cor</Label>
                <select
                  id="cor"
                  value={selectedCorId}
                  onChange={(e) => setSelectedCorId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  disabled={!!vinculoId} // Não permite mudar cor em edição
                >
                  <option value="">Selecione uma cor...</option>
                  {cores.map(cor => (
                    <option key={cor.id} value={cor.id}>
                      {cor.nome} {cor.sku ? `(${cor.sku})` : ''}
                    </option>
                  ))}
                </select>
                
                {selectedCor && (
                  <div className="flex items-center gap-3 mt-2 p-3 bg-gray-50 rounded-md">
                    {selectedCor.codigoHex && (
                      <div
                        className="w-10 h-10 rounded-md border-2 border-gray-200 shadow-sm"
                        style={{ backgroundColor: selectedCor.codigoHex }}
                      />
                    )}
                    <div>
                      <div className="font-medium">{selectedCor.nome}</div>
                      {selectedCor.lab && (
                        <div className="text-xs text-gray-500">
                          LAB: {selectedCor.lab.L.toFixed(1)}, {selectedCor.lab.a.toFixed(1)}, {selectedCor.lab.b.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Seleção de Tecido */}
              <div className="space-y-2">
                <Label htmlFor="tecido">Tecido</Label>
                <select
                  id="tecido"
                  value={selectedTecidoId}
                  onChange={(e) => {
                    setSelectedTecidoId(e.target.value);
                    setImagemTecidoError(false);
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  disabled={!!vinculoId} // Não permite mudar tecido em edição
                >
                  <option value="">Selecione um tecido...</option>
                  {tecidos.map(tecido => (
                    <option key={tecido.id} value={tecido.id}>
                      {tecido.nome} {tecido.sku ? `(${tecido.sku})` : ''}
                    </option>
                  ))}
                </select>
                
                {selectedTecido && selectedTecido.imagemPadrao && (
                  <div className="mt-2">
                    {imagemTecidoError ? (
                      <div className="w-full max-w-[200px] h-[150px] rounded-md border border-amber-300 bg-amber-50 flex flex-col items-center justify-center gap-2 p-4">
                        <AlertTriangle className="h-8 w-8 text-amber-500" />
                        <p className="text-xs text-amber-700 text-center">
                          Erro ao carregar imagem. A URL pode ter expirado.
                        </p>
                        <p className="text-xs text-amber-600 text-center">
                          Edite o tecido para reenviar a imagem.
                        </p>
                      </div>
                    ) : (
                      <img
                        src={selectedTecido.imagemPadrao}
                        alt={selectedTecido.nome}
                        className="w-full max-w-[200px] rounded-md border border-gray-200 shadow-sm"
                        onError={() => setImagemTecidoError(true)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Preview da Imagem Tingida */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold border-b pb-2 mb-4">Preview</h2>
              
              <div className="aspect-square w-full max-w-[300px] mx-auto rounded-lg border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                {processando ? (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Processando...</p>
                  </div>
                ) : imagemTingida ? (
                  <img
                    src={imagemTingida}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">
                      Selecione cor e tecido para gerar preview
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sugestão ML */}
          {selectedCor && selectedTecido && (
            <div className={`rounded-lg shadow p-4 mt-6 ${
              mlSugestao ? 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200' : 'bg-white border border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    mlReady ? 'bg-purple-100' : 
                    mlStatus === 'loading' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Brain className={`h-5 w-5 ${
                      buscandoSugestao || mlStatus === 'loading' ? 'animate-pulse text-purple-500' :
                      mlReady ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">Sugestão ML</span>
                      {(buscandoSugestao || mlStatus === 'loading') && (
                        <span className="text-xs text-purple-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {mlStatus === 'loading' ? 'Carregando modelo...' : 'Analisando...'}
                        </span>
                      )}
                      {mlSugestao && !buscandoSugestao && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {Math.round(mlSugestao.confidence * 100)}% confiança
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {mlStatus === 'loading' ? (
                        'Carregando modelo de machine learning...'
                      ) : mlStatus === 'training' ? (
                        'Modelo em treinamento...'
                      ) : !mlReady ? (
                        exampleCount < 10 
                          ? `Modelo precisa de mais exemplos (${exampleCount}/10 mínimo)`
                          : `Modelo não treinado (${exampleCount} exemplos disponíveis)`
                      ) : mlSugestao ? (
                        sugestaoAplicada 
                          ? 'Sugestão aplicada aos ajustes' 
                          : `Baseado em ${exampleCount} exemplos de treinamento`
                      ) : (
                        `Modelo pronto (${exampleCount} exemplos) - analisando...`
                      )}
                    </p>
                  </div>
                </div>
                {mlSugestao && !sugestaoAplicada && (
                  <Button 
                    size="sm" 
                    onClick={aplicarSugestaoML}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Aplicar Sugestão
                  </Button>
                )}
                {mlSugestao && sugestaoAplicada && (
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    Aplicada
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ajustes Reinhard */}
          {selectedCor && selectedTecido && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h2 className="text-lg font-semibold">Ajustes de Cor</h2>
                <Button variant="ghost" size="sm" onClick={resetAjustes}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resetar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Saturação */}
                <Slider
                  label="Saturação"
                  value={ajustes.saturationMultiplier ?? 0.85}
                  onValueChange={(v) => setAjustes({ ...ajustes, saturationMultiplier: v })}
                  min={0.5}
                  max={1.5}
                  step={0.01}
                />

                {/* Contraste */}
                <Slider
                  label="Contraste"
                  value={ajustes.contrastBoost ?? 0.15}
                  onValueChange={(v) => setAjustes({ ...ajustes, contrastBoost: v })}
                  min={0}
                  max={0.5}
                  step={0.01}
                />

                {/* Detalhe */}
                <Slider
                  label="Detalhe"
                  value={ajustes.detailAmount ?? 1.15}
                  onValueChange={(v) => setAjustes({ ...ajustes, detailAmount: v })}
                  min={0.5}
                  max={2}
                  step={0.05}
                />

                {/* Escurecimento */}
                <Slider
                  label="Escurecimento"
                  value={ajustes.darkenAmount ?? 5}
                  onValueChange={(v) => setAjustes({ ...ajustes, darkenAmount: v })}
                  min={0}
                  max={30}
                  step={1}
                />

                {/* Matiz (Hue Shift) */}
                <Slider
                  label="Matiz"
                  value={ajustes.hueShift ?? 0}
                  onValueChange={(v) => setAjustes({ ...ajustes, hueShift: v })}
                  min={-60}
                  max={60}
                  step={1}
                />

                {/* Dessaturação de Sombras */}
                <Slider
                  label="Dessat. Sombras"
                  value={ajustes.shadowDesaturation ?? 0.6}
                  onValueChange={(v) => setAjustes({ ...ajustes, shadowDesaturation: v })}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onNavigateBack}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || !selectedCorId || !selectedTecidoId}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
