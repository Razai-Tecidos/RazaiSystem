import { useState, useEffect } from 'react';
import { LabColor } from '@/types/cor.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapturaCorFormProps {
  color: {
    lab: LabColor;
    hex: string;
  } | null;
  onSubmit: (nome: string) => Promise<void>;
  onDiscard: () => void;
  onNewCapture: () => void;
  loading?: boolean;
}

/**
 * Formulário de revisão após captura de cor
 * Permite editar nome antes de salvar
 */
export function CapturaCorForm({
  color,
  onSubmit,
  onDiscard,
  onNewCapture,
  loading,
}: CapturaCorFormProps) {
  const [nome, setNome] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetar nome quando nova cor for capturada
  useEffect(() => {
    if (color) {
      setNome('');
      setErrors({});
    }
  }, [color]);

  if (!color) {
    return null;
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar nome
    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.trim().length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 caracteres';
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
      await onSubmit(nome.trim());
      setNome('');
      setErrors({});
    } catch (error) {
      // Erro já é tratado no componente pai
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    setNome('');
    setErrors({});
    onDiscard();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Revisar e Salvar Cor
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="nome">
            Nome da Cor <span className="text-red-500">*</span>
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
            placeholder="Ex: Vermelho Escarlate, Azul Marinho"
            className={cn(errors.nome && 'border-red-500')}
            disabled={isSubmitting || loading}
          />
          {errors.nome && (
            <p className="text-sm text-red-500">{errors.nome}</p>
          )}
        </div>

        {/* Valores LAB (readonly) */}
        <div className="space-y-2">
          <Label>Valores LAB (somente leitura)</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Input
                value={`L: ${color.lab.L.toFixed(2)}`}
                readOnly
                className="bg-gray-50 font-mono text-sm"
              />
            </div>
            <div>
              <Input
                value={`a: ${color.lab.a.toFixed(2)}`}
                readOnly
                className="bg-gray-50 font-mono text-sm"
              />
            </div>
            <div>
              <Input
                value={`b: ${color.lab.b.toFixed(2)}`}
                readOnly
                className="bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Código Hexadecimal (readonly) */}
        <div className="space-y-2">
          <Label>Código Hexadecimal (somente leitura)</Label>
          <div className="flex items-center gap-2">
            <Input
              value={color.hex}
              readOnly
              className="bg-gray-50 font-mono"
            />
            <div
              className="w-12 h-12 rounded border-2 border-gray-300 flex-shrink-0"
              style={{ backgroundColor: color.hex }}
              title={color.hex}
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            Descartar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onNewCapture}
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            Nova Captura
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {(isSubmitting || loading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar Cor
          </Button>
        </div>
      </form>
    </div>
  );
}
