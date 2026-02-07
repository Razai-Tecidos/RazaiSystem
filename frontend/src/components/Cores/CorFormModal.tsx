import { useState, useEffect } from 'react';
import { Cor, CreateCorData } from '@/types/cor.types';
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
import { Loader2 } from 'lucide-react';
import { hexToRgb, rgbToLab } from '@/lib/colorUtils';

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
    }
  }, [open, cor]);

  const resetForm = () => {
    setNome('');
    setCodigoHex('');
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (codigoHex && !/^#[0-9A-Fa-f]{6}$/.test(codigoHex)) {
      newErrors.codigoHex = 'Formato inválido. Use #RRGGBB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    
    try {
      // Calcular LAB e RGB se tiver hex
      let lab = cor?.lab;
      let rgb = cor?.rgb;
      
      if (codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex)) {
        const converted = hexToRgb(codigoHex);
        if (converted) {
          rgb = converted;
          lab = rgbToLab(rgb);
        }
      }
      
      const data: CreateCorData = {
        nome: nome.trim(),
        codigoHex: codigoHex || undefined,
        lab,
        labOriginal: cor?.labOriginal,
        rgb: rgb || undefined,
      };
      
      await onSubmit(data);
      resetForm();
    } catch (error) {
      // Erro é tratado no componente pai
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = loading || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {cor ? 'Editar Cor' : 'Nova Cor'}
            </DialogTitle>
            <DialogDescription>
              {cor
                ? 'Edite as informações da cor.'
                : 'Preencha os dados para cadastrar uma nova cor.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Vermelho Bordô"
                disabled={isFormDisabled}
              />
              {errors.nome && (
                <p className="text-sm text-red-500">{errors.nome}</p>
              )}
            </div>

            {/* Código HEX */}
            <div className="space-y-2">
              <Label htmlFor="codigoHex">Código HEX</Label>
              <div className="flex gap-2">
                <Input
                  id="codigoHex"
                  value={codigoHex}
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase();
                    // Adicionar # automaticamente
                    if (val && !val.startsWith('#')) {
                      val = '#' + val;
                    }
                    setCodigoHex(val);
                  }}
                  placeholder="#FF0000"
                  disabled={isFormDisabled}
                  maxLength={7}
                  className="font-mono"
                />
                {codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex) && (
                  <div
                    className="w-10 h-10 rounded-md border-2 border-gray-200 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: codigoHex }}
                    title={codigoHex}
                  />
                )}
              </div>
              {errors.codigoHex && (
                <p className="text-sm text-red-500">{errors.codigoHex}</p>
              )}
              <p className="text-xs text-gray-500">
                Formato: #RRGGBB (ex: #FF5733)
              </p>
            </div>

            {/* Preview da Cor */}
            {codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview da Cor</h4>
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-lg border-2 border-gray-200 shadow-md"
                    style={{ backgroundColor: codigoHex }}
                  />
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">HEX:</span> {codigoHex}</p>
                    {(() => {
                      const rgb = hexToRgb(codigoHex);
                      if (rgb) {
                        const lab = rgbToLab(rgb);
                        return (
                          <>
                            <p><span className="font-medium">RGB:</span> {rgb.r}, {rgb.g}, {rgb.b}</p>
                            <p><span className="font-medium">LAB:</span> {lab.L.toFixed(1)}, {lab.a.toFixed(1)}, {lab.b.toFixed(1)}</p>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Info sobre Vínculos */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Para vincular esta cor a um tecido e gerar a imagem tingida, 
                acesse a página de <strong>Vínculos</strong> após criar a cor.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isFormDisabled}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isFormDisabled}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : cor ? (
                'Salvar'
              ) : (
                'Cadastrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
