import { useEffect, useMemo, useRef, useState } from 'react';
import { Tecido, CreateTecidoData, TipoTecido, GramaturaUnidade } from '@/types/tecido.types';
import { calculateTecidoMetricas } from '@/lib/tecidoMetrics';
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

function formatDecimalInput(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return value.toString().replace('.', ',');
}

function parseDecimalInput(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function formatDecimalOutput(value?: number, suffix: string = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(2).replace('.', ',')}${suffix}`;
}

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
  const [rendimentoPorKg, setRendimentoPorKg] = useState('');
  const [gramaturaValor, setGramaturaValor] = useState('');
  const [gramaturaUnidade, setGramaturaUnidade] = useState<GramaturaUnidade>('g_m2');
  const [imagemPadrao, setImagemPadrao] = useState<File | string>('');
  const [imagemPreview, setImagemPreview] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const larguraValue = parseDecimalInput(largura);
  const rendimentoValue = parseDecimalInput(rendimentoPorKg);
  const gramaturaValue = parseDecimalInput(gramaturaValor);

  const metricas = useMemo(
    () =>
      calculateTecidoMetricas({
        larguraMetros: larguraValue,
        rendimentoPorKg: rendimentoValue,
        gramaturaValor: gramaturaValue,
        gramaturaUnidade,
      }),
    [gramaturaUnidade, gramaturaValue, larguraValue, rendimentoValue]
  );

  // Detectar se o formulario tem dados preenchidos
  const hasUnsavedChanges = () => {
    if (tecido) {
      return (
        nome !== tecido.nome ||
        tipo !== (tecido.tipo || 'liso') ||
        largura !== tecido.largura.toString().replace('.', ',') ||
        composicao !== (tecido.composicao || '') ||
        rendimentoPorKg !== formatDecimalInput(tecido.rendimentoPorKg) ||
        gramaturaValor !== formatDecimalInput(tecido.gramaturaValor) ||
        gramaturaUnidade !== (tecido.gramaturaUnidade || 'g_m2') ||
        descricao !== (tecido.descricao || '') ||
        imagemPadrao instanceof File
      );
    }

    return !!(
      nome.trim() ||
      largura.trim() ||
      composicao.trim() ||
      rendimentoPorKg.trim() ||
      gramaturaValor.trim() ||
      descricao.trim() ||
      imagemPadrao
    );
  };

  // Interceptar fechamento do modal
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges() && !isSubmitting) {
      setShowDiscardConfirm(true);
      return;
    }
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const confirmDiscard = () => {
    setShowDiscardConfirm(false);
    resetForm();
    onOpenChange(false);
  };

  // Resetar formulario quando modal abrir/fechar ou tecido mudar
  useEffect(() => {
    if (!open) {
      return;
    }

    if (tecido) {
      setNome(tecido.nome);
      setTipo(tecido.tipo || 'liso');
      setLargura(tecido.largura.toString().replace('.', ','));
      setComposicao(tecido.composicao || '');
      setRendimentoPorKg(formatDecimalInput(tecido.rendimentoPorKg));
      setGramaturaValor(formatDecimalInput(tecido.gramaturaValor));
      setGramaturaUnidade(tecido.gramaturaUnidade || 'g_m2');
      setImagemPadrao(tecido.imagemPadrao || '');
      setImagemPreview(tecido.imagemPadrao || '');
      setDescricao(tecido.descricao || '');
    } else {
      resetForm();
    }
    setErrors({});
  }, [open, tecido]);

  const resetForm = () => {
    setNome('');
    setTipo('liso');
    setLargura('');
    setComposicao('');
    setRendimentoPorKg('');
    setGramaturaValor('');
    setGramaturaUnidade('g_m2');
    setImagemPadrao('');
    setImagemPreview('');
    setDescricao('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome e obrigatorio';
    } else if (nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!largura.trim()) {
      newErrors.largura = 'Largura e obrigatoria';
    } else if (typeof larguraValue !== 'number' || larguraValue <= 0) {
      newErrors.largura = 'Largura deve ser um numero positivo';
    }

    if (!composicao.trim()) {
      newErrors.composicao = 'Composicao e obrigatoria';
    }

    if (rendimentoPorKg.trim() && (typeof rendimentoValue !== 'number' || rendimentoValue <= 0)) {
      newErrors.rendimentoPorKg = 'Rendimento por kg deve ser um numero positivo';
    }

    if (gramaturaValor.trim() && (typeof gramaturaValue !== 'number' || gramaturaValue <= 0)) {
      newErrors.gramaturaValor = 'Gramatura deve ser um numero positivo';
    }

    if (tipo === 'liso') {
      if (!imagemPadrao) {
        newErrors.imagemPadrao = 'Imagem e obrigatoria para tecidos lisos';
      } else if (imagemPadrao instanceof File) {
        if (!ALLOWED_IMAGE_TYPES.includes(imagemPadrao.type)) {
          newErrors.imagemPadrao = 'Formato invalido. Use JPG, PNG ou WEBP';
        }
        if (imagemPadrao.size > MAX_IMAGE_SIZE) {
          newErrors.imagemPadrao = 'Imagem muito grande. Tamanho maximo: 5MB';
        }
      }
    } else if (imagemPadrao instanceof File) {
      if (!ALLOWED_IMAGE_TYPES.includes(imagemPadrao.type)) {
        newErrors.imagemPadrao = 'Formato invalido. Use JPG, PNG ou WEBP';
      }
      if (imagemPadrao.size > MAX_IMAGE_SIZE) {
        newErrors.imagemPadrao = 'Imagem muito grande. Tamanho maximo: 5MB';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, imagemPadrao: 'Formato invalido. Use JPG, PNG ou WEBP' }));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setErrors((prev) => ({ ...prev, imagemPadrao: 'Imagem muito grande. Tamanho maximo: 5MB' }));
      return;
    }

    setImagemPadrao(file);
    setImagemPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.imagemPadrao;
      return next;
    });
  };

  const handleRemoveImage = () => {
    setImagemPadrao('');
    setImagemPreview('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.imagemPadrao;
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, imagemPadrao: 'Formato invalido. Use JPG, PNG ou WEBP' }));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setErrors((prev) => ({ ...prev, imagemPadrao: 'Imagem muito grande. Tamanho maximo: 5MB' }));
      return;
    }

    setImagemPadrao(file);
    setImagemPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.imagemPadrao;
      return next;
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
        largura: Number(larguraValue),
        composicao: composicao.trim(),
        rendimentoPorKg: rendimentoValue,
        gramaturaValor: gramaturaValue,
        gramaturaUnidade: gramaturaValue ? gramaturaUnidade : undefined,
        imagemPadrao,
        descricao: descricao.trim() || undefined,
      };

      await onSubmit(data);
      onOpenChange(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
            <DialogTitle>{tecido ? 'Editar Tecido' : 'Adicionar Tecido'}</DialogTitle>
            <DialogDescription>Preencha os campos obrigatorios marcados com *</DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 space-y-4 pb-4">
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
                      const next = { ...prev };
                      delete next.nome;
                      return next;
                    });
                  }
                }}
                placeholder="Ex: Viscolinho Premium"
                className={cn(errors.nome && 'border-red-500')}
              />
              {errors.nome && <p className="text-sm text-red-500">{errors.nome}</p>}
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="largura">
                Largura (m) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="largura"
                type="text"
                value={largura}
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d,.-]/g, '');
                  const parts = value.split(/[,.]/);
                  if (parts.length > 2) {
                    value = parts[0] + ',' + parts.slice(1).join('');
                  }
                  setLargura(value);
                  if (errors.largura) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.largura;
                      return next;
                    });
                  }
                }}
                placeholder="Ex: 1,60"
                className={cn(errors.largura && 'border-red-500')}
              />
              {errors.largura && <p className="text-sm text-red-500">{errors.largura}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rendimentoPorKg">Rendimento por kg (m/kg)</Label>
                <Input
                  id="rendimentoPorKg"
                  type="text"
                  value={rendimentoPorKg}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^\d,.-]/g, '');
                    const parts = value.split(/[,.]/);
                    if (parts.length > 2) {
                      value = parts[0] + ',' + parts.slice(1).join('');
                    }
                    setRendimentoPorKg(value);
                    if (errors.rendimentoPorKg) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.rendimentoPorKg;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ex: 4,5"
                  className={cn(errors.rendimentoPorKg && 'border-red-500')}
                />
                {errors.rendimentoPorKg && <p className="text-sm text-red-500">{errors.rendimentoPorKg}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gramaturaValor">Gramatura base</Label>
                <div className="flex gap-2">
                  <Input
                    id="gramaturaValor"
                    type="text"
                    value={gramaturaValor}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d,.-]/g, '');
                      const parts = value.split(/[,.]/);
                      if (parts.length > 2) {
                        value = parts[0] + ',' + parts.slice(1).join('');
                      }
                      setGramaturaValor(value);
                      if (errors.gramaturaValor) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.gramaturaValor;
                          return next;
                        });
                      }
                    }}
                    placeholder="Ex: 123,46"
                    className={cn(errors.gramaturaValor && 'border-red-500')}
                  />
                  <select
                    value={gramaturaUnidade}
                    onChange={(e) => setGramaturaUnidade(e.target.value as GramaturaUnidade)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="g_m2">g/m2</option>
                    <option value="g_m_linear">g/m linear</option>
                  </select>
                </div>
                {errors.gramaturaValor && <p className="text-sm text-red-500">{errors.gramaturaValor}</p>}
              </div>
            </div>

            {metricas.source !== 'none' && (
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Metricas calculadas</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700">
                  <div>
                    <p className="text-xs text-slate-500">Rendimento</p>
                    <p className="font-medium">{formatDecimalOutput(metricas.rendimentoPorKg, ' m/kg')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Gramatura (g/m2)</p>
                    <p className="font-medium">{formatDecimalOutput(metricas.gramaturaGm2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Peso linear (g/m)</p>
                    <p className="font-medium">{formatDecimalOutput(metricas.gramaturaGmLinear)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="composicao">
                Composicao <span className="text-red-500">*</span>
              </Label>
              <Input
                id="composicao"
                value={composicao}
                onChange={(e) => {
                  setComposicao(e.target.value);
                  if (errors.composicao) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.composicao;
                      return next;
                    });
                  }
                }}
                placeholder="Ex: Algodao 60%, Poliester 40%"
                className={cn(errors.composicao && 'border-red-500')}
              />
              {errors.composicao && <p className="text-sm text-red-500">{errors.composicao}</p>}
            </div>

            <div className="space-y-2">
              <Label>
                Imagem Padrao{' '}
                {tipo === 'liso' ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                )}
              </Label>
              {imagemPreview ? (
                <div className="relative">
                  <img src={imagemPreview} alt="Preview" className="w-full h-48 object-cover rounded-md border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={handleRemoveImage}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-center w-full"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <label
                    htmlFor="imagem"
                    className={cn(
                      'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                      isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className={cn('w-8 h-8 mb-2', isDragging ? 'text-primary' : 'text-gray-400')} />
                      <p className="mb-2 text-sm text-gray-500">{isDragging ? 'Solte a imagem aqui' : 'Clique ou arraste para upload'}</p>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP ate 5MB</p>
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
              {errors.imagemPadrao && <p className="text-sm text-red-500">{errors.imagemPadrao}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descricao opcional do tecido"
                rows={3}
              />
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting || loading} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="button" disabled={isSubmitting || loading} className="w-full sm:w-auto" onClick={() => formRef.current?.requestSubmit()}>
              {(isSubmitting || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descartar alteracoes?</DialogTitle>
            <DialogDescription>Voce tem dados nao salvos. Deseja descartar as alteracoes?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Continuar editando
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

