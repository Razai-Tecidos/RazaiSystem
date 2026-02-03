import { useState, useEffect, useCallback } from 'react';
import { Cor, CreateCorData } from '@/types/cor.types';
import { AjustesCor } from '@/types/captura.types';
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
import { Loader2, RotateCcw, ImageIcon, AlertCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hexToRgb } from '@/lib/colorUtils';
import { useTecidos } from '@/hooks/useTecidos';
import { useReinhardTingimento } from '@/hooks/useReinhardTingimento';
import { ref, getBlob, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';

interface CorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCorData) => Promise<void>;
  cor?: Cor | null;
  loading?: boolean;
}

export function CorFormModal({
  open,
  onOpenChange,
  onSubmit,
  cor,
  loading,
}: CorFormModalProps) {
  const [nome, setNome] = useState('');
  const [codigoHex, setCodigoHex] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Preview do tecido tingido
  const { tecidos } = useTecidos();
  const { aplicarTingimento } = useReinhardTingimento();
  const [imagemTingida, setImagemTingida] = useState<string>('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [erroPreview, setErroPreview] = useState<string>('');
  const [previewExpandido, setPreviewExpandido] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesCor>({
    hue: 0,
    saturation: 0,
    brightness: 0,
    contrast: 0,
  });
  const [mostrarPreview, setMostrarPreview] = useState(false);

  // Buscar imagem do tecido associado
  const tecidoAssociado = cor?.tecidoId 
    ? tecidos.find(t => t.id === cor.tecidoId) 
    : null;
  
  // Verificar se tem condições para preview
  const temTecidoAssociado = !!(cor?.tecidoId && tecidoAssociado?.imagemPadrao);
  const hexValido = codigoHex && /^#[0-9A-F]{6}$/i.test(codigoHex);
  const podePreview = temTecidoAssociado && hexValido;

  // Resetar formulário quando modal abrir/fechar ou cor mudar
  useEffect(() => {
    if (open) {
      if (cor) {
        // Modo edição
        setNome(cor.nome);
        setCodigoHex(cor.codigoHex || '');
      } else {
        // Modo criação
        resetForm();
      }
      setErrors({});
      setAjustes({ hue: 0, saturation: 0, brightness: 0, contrast: 0 });
      setMostrarPreview(false);
      setImagemTingida('');
      setErroPreview('');
      setPreviewExpandido(false);
    }
  }, [open, cor]);

  /**
   * Carrega imagem do Firebase Storage usando fetch com token de autenticação
   * ou via SDK quando possível
   */
  const carregarImagemFirebase = useCallback(async (imagemUrl: string): Promise<string> => {
    // Se for uma URL do Firebase Storage
    if (imagemUrl.includes('firebasestorage.googleapis.com') || imagemUrl.includes('storage.googleapis.com')) {
      try {
        // Tentar via SDK primeiro
        const urlObj = new URL(imagemUrl);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
        
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          const storageRef = ref(storage, storagePath);
          
          try {
            const blob = await getBlob(storageRef);
            return URL.createObjectURL(blob);
          } catch (sdkError) {
            console.warn('SDK getBlob falhou, tentando fetch com token:', sdkError);
            
            // Fallback: usar fetch com token de autenticação
            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            const user = auth.currentUser;
            
            if (user) {
              const token = await user.getIdToken();
              const response = await fetch(imagemUrl, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                const blob = await response.blob();
                return URL.createObjectURL(blob);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Erro ao carregar imagem do Firebase:', error);
      }
    }
    
    // Último fallback: usar a URL diretamente (pode falhar por CORS)
    return imagemUrl;
  }, []);


  // Aplicar tingimento quando preview for ativado ou ajustes mudarem
  useEffect(() => {
    if (!open || !mostrarPreview || !podePreview) {
      return;
    }

    const rgb = hexToRgb(codigoHex);
    if (!rgb || !tecidoAssociado?.imagemPadrao) {
      return;
    }

    let cancelado = false;
    setCarregandoPreview(true);
    setErroPreview('');

    let blobUrl: string | null = null;

    carregarImagemFirebase(tecidoAssociado.imagemPadrao)
      .then((urlLocal) => {
        if (urlLocal.startsWith('blob:')) {
          blobUrl = urlLocal;
        }

        // Aplica tingimento Reinhard (CIELAB)
        // Usa os defaults do hook (contrastBoost: 0.12)
        return aplicarTingimento(urlLocal, rgb, ajustes);
      })
      .then((dataURL) => {
        if (!cancelado) {
          setImagemTingida(dataURL);
          setCarregandoPreview(false);
        }
      })
      .catch((error) => {
        if (!cancelado) {
          console.error('Erro ao aplicar tingimento:', error);
          setErroPreview(error.message || 'Erro ao processar imagem');
          setCarregandoPreview(false);
        }
      })
      .finally(() => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [
    open,
    mostrarPreview,
    codigoHex,
    ajustes,
    tecidoAssociado?.imagemPadrao,
    podePreview,
    aplicarTingimento,
    carregarImagemFirebase,
  ]);

  const resetForm = () => {
    setNome('');
    setCodigoHex('');
    setErrors({});
    setAjustes({ hue: 0, saturation: 0, brightness: 0, contrast: 0 });
    setMostrarPreview(false);
    setImagemTingida('');
    setErroPreview('');
    setPreviewExpandido(false);
  };

  const handleResetarAjustes = () => {
    setAjustes({ hue: 0, saturation: 0, brightness: 0, contrast: 0 });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.trim().length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (codigoHex.trim() && !/^#[0-9A-F]{6}$/i.test(codigoHex.trim())) {
      newErrors.codigoHex = 'Código hexadecimal inválido. Use o formato #RRGGBB (ex: #FF5733)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let imagemTingidaUrl: string | undefined;

      // Se tem imagem tingida, faz upload para o Storage
      if (imagemTingida) {
        // Usa o ID da cor se existir, ou um timestamp único para novas cores
        const folderId = cor?.id || `new-${Date.now()}`;
        const storageRef = ref(storage, `cores/${folderId}/${Date.now()}-tingido.png`);
        // Remove o prefixo "data:image/png;base64," se existir
        const base64Data = imagemTingida.split(',')[1] || imagemTingida;
        await uploadString(storageRef, base64Data, 'base64', {
          contentType: 'image/png',
        });
        imagemTingidaUrl = await getDownloadURL(storageRef);
      }

      const data: CreateCorData = {
        nome: nome.trim(),
        codigoHex: codigoHex.trim() || undefined,
        imagemTingida: imagemTingidaUrl,
      };

      await onSubmit(data);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Erro já é tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!imagemTingida) return;
    
    const link = document.createElement('a');
    link.href = imagemTingida;
    link.download = `${cor?.sku || 'cor'}-${nome || 'tingido'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden",
          temTecidoAssociado ? "max-w-3xl" : "max-w-md"
        )}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">
              {cor ? 'Editar Cor' : 'Adicionar Cor'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {cor ? 'Edite as informações da cor' : 'Preencha os campos obrigatórios marcados com *'}
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className={cn(
            "space-y-4 pr-1",
            temTecidoAssociado && "sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0"
          )}>
            {/* Coluna esquerda: Formulário */}
            <div className="space-y-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errors.nome) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.nome;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder="Ex: Vermelho, Azul, Verde"
                  className={cn(errors.nome && 'border-red-500')}
                />
                {errors.nome && (
                  <p className="text-sm text-red-500">{errors.nome}</p>
                )}
              </div>

              {/* Código Hexadecimal */}
              <div className="space-y-2">
                <Label htmlFor="codigoHex">Código Hexadecimal</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="codigoHex"
                    type="text"
                    value={codigoHex}
                    onChange={(e) => {
                      let value = e.target.value.toUpperCase();
                      if (value && !value.startsWith('#')) {
                        value = '#' + value.replace(/#/g, '');
                      }
                      if (value.length > 7) {
                        value = value.slice(0, 7);
                      }
                      value = value.replace(/[^#0-9A-F]/gi, '');
                      setCodigoHex(value);
                      if (errors.codigoHex) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.codigoHex;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder="#FF5733"
                    className={cn(errors.codigoHex && 'border-red-500', 'font-mono')}
                    maxLength={7}
                  />
                  {hexValido && (
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: codigoHex }}
                      title={codigoHex}
                    />
                  )}
                </div>
                {errors.codigoHex && (
                  <p className="text-sm text-red-500">{errors.codigoHex}</p>
                )}
              </div>

              {/* Informações da Captura (readonly) */}
              {cor && (cor.lab || cor.tecidoNome) && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700">Informações da Captura</h3>

                  {cor.lab && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1.5">Valores LAB</div>
                      <div className="font-mono text-xs grid grid-cols-3 gap-2">
                        <span>L: {cor.lab.L.toFixed(2)}</span>
                        <span>a: {cor.lab.a.toFixed(2)}</span>
                        <span>b: {cor.lab.b.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {cor.tecidoNome && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Tecido Associado</div>
                      <div className="font-medium text-gray-900 text-sm">{cor.tecidoNome}</div>
                      {cor.tecidoSku && (
                        <div className="text-xs text-gray-500">SKU: {cor.tecidoSku}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Coluna direita: Preview do tecido tingido */}
            {temTecidoAssociado && (
              <div className="space-y-4 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-6">
                {!mostrarPreview ? (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMostrarPreview(true)}
                      className="w-full"
                      disabled={!hexValido}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Ver Preview no Tecido
                    </Button>
                    {!hexValido && (
                      <p className="text-xs text-gray-500 text-center">
                        Digite um código hexadecimal válido para ver o preview
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Preview Reinhard CIELAB */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Preview: {cor?.tecidoNome}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Método Reinhard (CIELAB) com preservação de textura
                      </p>
                      <div className="relative border rounded-lg overflow-hidden bg-gray-100 aspect-[4/3] flex items-center justify-center">
                        {carregandoPreview ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            <span className="text-xs text-gray-400">Processando...</span>
                          </div>
                        ) : erroPreview ? (
                          <div className="flex flex-col items-center gap-2 p-4 text-center">
                            <AlertCircle className="h-6 w-6 text-red-400" />
                            <span className="text-xs text-red-500">{erroPreview}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setErroPreview('');
                                setMostrarPreview(false);
                                setTimeout(() => setMostrarPreview(true), 100);
                              }}
                            >
                              Tentar novamente
                            </Button>
                          </div>
                        ) : imagemTingida ? (
                          <button
                            type="button"
                            onClick={() => setPreviewExpandido(true)}
                            className="w-full h-full"
                            aria-label="Ampliar preview"
                          >
                            <img
                              src={imagemTingida}
                              alt={`Preview de ${nome || 'cor'} em ${cor?.tecidoNome}`}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        ) : (
                          <div className="text-gray-400 text-sm">Aguardando...</div>
                        )}
                      </div>
                      
                      {/* Botão de download */}
                      {imagemTingida && !carregandoPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="w-full mt-2"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar imagem
                        </Button>
                      )}
                    </div>

                    {/* Sliders de ajuste */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Ajustes de Cor</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleResetarAjustes}
                          className="h-7 text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Resetar
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <Slider
                          label="Matiz"
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
                  </>
                )}
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 pt-4 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={isSubmitting || loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting || loading}
            onClick={handleSubmit}
            className="w-full sm:w-auto"
          >
            {(isSubmitting || loading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={previewExpandido}
        onOpenChange={setPreviewExpandido}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Preview ampliado (Reinhard CIELAB)
            </DialogTitle>
            <DialogDescription>
              {cor?.tecidoNome ? `Tecido: ${cor.tecidoNome}` : 'Preview do tecido'}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full h-[80vh]">
            {imagemTingida && (
              <img
                src={imagemTingida}
                alt={`Preview ampliado de ${nome || 'cor'}`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
