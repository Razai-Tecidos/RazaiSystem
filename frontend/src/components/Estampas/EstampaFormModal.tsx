import { useState, useEffect } from 'react';
import { Estampa, CreateEstampaData } from '@/types/estampa.types';
import { Tecido } from '@/types/tecido.types';
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

interface EstampaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateEstampaData) => Promise<void>;
  estampa?: Estampa | null;
  tecidos: Tecido[]; // Lista de tecidos disponíveis para seleção
  loading?: boolean;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function EstampaFormModal({
  open,
  onOpenChange,
  onSubmit,
  estampa,
  tecidos,
  loading,
}: EstampaFormModalProps) {
  const [nome, setNome] = useState('');
  const [tecidoBaseId, setTecidoBaseId] = useState('');
  const [imagem, setImagem] = useState<File | string>('');
  const [imagemPreview, setImagemPreview] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetar formulário quando modal abrir/fechar ou estampa mudar
  useEffect(() => {
    if (open) {
      if (estampa) {
        // Modo edição
        setNome(estampa.nome);
        setTecidoBaseId(estampa.tecidoBaseId);
        setImagem(estampa.imagem || '');
        setImagemPreview(estampa.imagem || '');
        setDescricao(estampa.descricao || '');
      } else {
        // Modo criação
        resetForm();
      }
      setErrors({});
    }
  }, [open, estampa]);

  const resetForm = () => {
    setNome('');
    setTecidoBaseId('');
    setImagem('');
    setImagemPreview('');
    setDescricao('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    } else if (nome.trim().split(/\s+/).length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 palavras (ex: "Jardim Pink")';
    }

    if (!tecidoBaseId) {
      newErrors.tecidoBaseId = 'Tecido base é obrigatório';
    }

    // Imagem é opcional, mas se fornecida, valida formato e tamanho
    if (imagem instanceof File) {
      if (!ALLOWED_IMAGE_TYPES.includes(imagem.type)) {
        newErrors.imagem = 'Formato de imagem inválido. Use JPG, PNG ou WEBP';
      }
      if (imagem.size > MAX_IMAGE_SIZE) {
        newErrors.imagem = 'Imagem muito grande. Tamanho máximo: 5MB';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          imagem: 'Formato de imagem inválido. Use JPG, PNG ou WEBP',
        }));
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setErrors((prev) => ({
          ...prev,
          imagem: 'Imagem muito grande. Tamanho máximo: 5MB',
        }));
        return;
      }

      setImagem(file);
      setImagemPreview(URL.createObjectURL(file));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.imagem;
        return newErrors;
      });
    }
  };

  const handleRemoveImage = () => {
    setImagem('');
    setImagemPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateEstampaData = {
        nome: nome.trim(),
        tecidoBaseId,
        imagem,
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

  // Extrair família do nome para exibição
  const familiaNome = nome.trim().split(/\s+/)[0] || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {estampa ? 'Editar Estampa' : 'Adicionar Estampa'}
          </DialogTitle>
          <DialogDescription>
            O SKU será gerado automaticamente baseado na primeira palavra do nome (família)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">
              Nome da Estampa <span className="text-red-500">*</span>
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
              placeholder="Ex: Jardim Pink, Floral Azul"
              className={cn(errors.nome && 'border-red-500')}
            />
            {familiaNome && (
              <p className="text-xs text-gray-500">
                Família: <span className="font-medium text-primary">{familiaNome}</span> 
                {' '}(SKU: {familiaNome.substring(0, 2).toUpperCase()}xxx)
              </p>
            )}
            {errors.nome && (
              <p className="text-sm text-red-500">{errors.nome}</p>
            )}
          </div>

          {/* Tecido Base */}
          <div className="space-y-2">
            <Label htmlFor="tecidoBase">
              Tecido Base <span className="text-red-500">*</span>
            </Label>
            <select
              id="tecidoBase"
              value={tecidoBaseId}
              onChange={(e) => {
                setTecidoBaseId(e.target.value);
                if (errors.tecidoBaseId) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.tecidoBaseId;
                    return newErrors;
                  });
                }
              }}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                errors.tecidoBaseId && 'border-red-500'
              )}
            >
              <option value="">Selecione um tecido estampado</option>
              {tecidos.map((tecido) => (
                <option key={tecido.id} value={tecido.id}>
                  {tecido.nome} ({tecido.sku})
                </option>
              ))}
            </select>
            {errors.tecidoBaseId && (
              <p className="text-sm text-red-500">{errors.tecidoBaseId}</p>
            )}
          </div>

          {/* Imagem */}
          <div className="space-y-2">
            <Label>
              Imagem da Estampa <span className="text-gray-400 text-xs font-normal">(opcional)</span>
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
                  className={cn(
                    'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50',
                    errors.imagem ? 'border-red-500' : 'border-gray-300'
                  )}
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
            {errors.imagem && (
              <p className="text-sm text-red-500">{errors.imagem}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional da estampa"
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
