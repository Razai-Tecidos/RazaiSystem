import { useState, useEffect } from 'react';
import { Tecido, CreateTecidoData, TipoTecido } from '@/types/tecido.types';
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
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TecidoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTecidoData) => Promise<void>;
  tecido?: Tecido | null;
  loading?: boolean;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function TecidoFormModal({
  open,
  onOpenChange,
  onSubmit,
  tecido,
  loading,
}: TecidoFormModalProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoTecido>('liso');
  const [largura, setLargura] = useState('');
  const [composicao, setComposicao] = useState<string>('');
  const [imagemPadrao, setImagemPadrao] = useState<File | string>('');
  const [imagemPreview, setImagemPreview] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetar formulário quando modal abrir/fechar ou tecido mudar
  useEffect(() => {
    if (open) {
      if (tecido) {
        // Modo edição
        setNome(tecido.nome);
        setTipo(tecido.tipo || 'liso');
        // Converte ponto para vírgula ao exibir (padrão brasileiro)
        setLargura(tecido.largura.toString().replace('.', ','));
        // Compatibilidade: se composicao for array, converter para string
        if (Array.isArray(tecido.composicao)) {
          setComposicao((tecido.composicao as any).map((item: any) => item.nome).join(', ') || '');
        } else {
          setComposicao(tecido.composicao || '');
        }
        setImagemPadrao(tecido.imagemPadrao || '');
        setImagemPreview(tecido.imagemPadrao || '');
        setDescricao(tecido.descricao || '');
      } else {
        // Modo criação
        resetForm();
      }
      setErrors({});
    }
  }, [open, tecido]);

  const resetForm = () => {
    setNome('');
    setTipo('liso');
    setLargura('');
    setComposicao('');
    setImagemPadrao('');
    setImagemPreview('');
    setDescricao('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar nome
    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }

    // Validar largura (converte vírgula para ponto)
    if (!largura.trim()) {
      newErrors.largura = 'Largura é obrigatória';
    } else {
      // Converte vírgula para ponto para validação numérica
      const larguraNormalized = largura.replace(',', '.');
      const larguraNum = Number(larguraNormalized);
      if (isNaN(larguraNum) || larguraNum <= 0) {
        newErrors.largura = 'Largura deve ser um número positivo';
      }
    }

    // Validar composição
    // Campo de texto livre - apenas valida se está preenchido
    if (!composicao.trim()) {
      newErrors.composicao = 'Composição é obrigatória';
    }

    // Validar imagem (obrigatória apenas para tecidos lisos)
    if (tipo === 'liso') {
      if (!imagemPadrao) {
        newErrors.imagemPadrao = 'Imagem é obrigatória para tecidos lisos';
      } else if (imagemPadrao instanceof File) {
        if (!ALLOWED_IMAGE_TYPES.includes(imagemPadrao.type)) {
          newErrors.imagemPadrao =
            'Formato de imagem inválido. Use JPG, PNG ou WEBP';
        }
        if (imagemPadrao.size > MAX_IMAGE_SIZE) {
          newErrors.imagemPadrao =
            'Imagem muito grande. Tamanho máximo: 5MB';
        }
      }
    } else if (imagemPadrao instanceof File) {
      // Para estampado, validar apenas se uma imagem foi fornecida
      if (!ALLOWED_IMAGE_TYPES.includes(imagemPadrao.type)) {
        newErrors.imagemPadrao =
          'Formato de imagem inválido. Use JPG, PNG ou WEBP';
      }
      if (imagemPadrao.size > MAX_IMAGE_SIZE) {
        newErrors.imagemPadrao =
          'Imagem muito grande. Tamanho máximo: 5MB';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          imagemPadrao:
            'Formato de imagem inválido. Use JPG, PNG ou WEBP',
        }));
        return;
      }

      // Validar tamanho
      if (file.size > MAX_IMAGE_SIZE) {
        setErrors((prev) => ({
          ...prev,
          imagemPadrao: 'Imagem muito grande. Tamanho máximo: 5MB',
        }));
        return;
      }

      setImagemPadrao(file);
      setImagemPreview(URL.createObjectURL(file));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.imagemPadrao;
        return newErrors;
      });
    }
  };

  const handleRemoveImage = () => {
    setImagemPadrao('');
    setImagemPreview('');
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.imagemPadrao;
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateTecidoData = {
        nome: nome.trim(),
        tipo,
        // Converte vírgula para ponto ao salvar (padrão brasileiro)
        largura: Number(largura.replace(',', '.')),
        composicao: composicao.trim(),
        imagemPadrao,
        descricao: descricao.trim() || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tecido ? 'Editar Tecido' : 'Adicionar Tecido'}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos obrigatórios marcados com *
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Ex: Tecido de Algodão"
              className={cn(errors.nome && 'border-red-500')}
            />
            {errors.nome && (
              <p className="text-sm text-red-500">{errors.nome}</p>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>
              Tipo <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="liso"
                  checked={tipo === 'liso'}
                  onChange={() => setTipo('liso')}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm">Liso</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="estampado"
                  checked={tipo === 'estampado'}
                  onChange={() => setTipo('estampado')}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm">Estampado</span>
              </label>
            </div>
          </div>

          {/* Largura */}
          <div className="space-y-2">
            <Label htmlFor="largura">
              Largura (m) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="largura"
              type="text"
              value={largura}
              onChange={(e) => {
                // Aceita vírgula ou ponto como separador decimal (padrão brasileiro)
                let value = e.target.value.replace(/[^\d,.-]/g, '');
                // Permite apenas uma vírgula ou ponto
                const parts = value.split(/[,.]/);
                if (parts.length > 2) {
                  value = parts[0] + ',' + parts.slice(1).join('');
                }
                setLargura(value);
                if (errors.largura) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.largura;
                    return newErrors;
                  });
                }
              }}
              placeholder="Ex: 1,50"
              className={cn(errors.largura && 'border-red-500')}
            />
            {errors.largura && (
              <p className="text-sm text-red-500">{errors.largura}</p>
            )}
          </div>

          {/* Composição */}
          <div className="space-y-2">
            <Label htmlFor="composicao">
              Composição <span className="text-red-500">*</span>
            </Label>
            <Input
              id="composicao"
              value={composicao}
              onChange={(e) => {
                setComposicao(e.target.value);
                if (errors.composicao) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.composicao;
                    return newErrors;
                  });
                }
              }}
              placeholder="Ex: Algodão 60%, Poliester 40%"
              className={cn(errors.composicao && 'border-red-500')}
            />
            {errors.composicao && (
              <p className="text-sm text-red-500">{errors.composicao}</p>
            )}
          </div>

          {/* Imagem */}
          <div className="space-y-2">
            <Label>
              Imagem Padrão {tipo === 'liso' ? (
                <span className="text-red-500">*</span>
              ) : (
                <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              )}
            </Label>
            {imagemPreview ? (
              <div className="relative">
                <img
                  src={imagemPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="imagem"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      Clique para fazer upload
                    </p>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, WEBP até 5MB
                    </p>
                  </div>
                  <input
                    id="imagem"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            )}
            {errors.imagemPadrao && (
              <p className="text-sm text-red-500">{errors.imagemPadrao}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional do tecido"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={isSubmitting || loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              {(isSubmitting || loading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
