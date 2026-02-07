import { useState, useEffect, useMemo } from 'react';
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
import { Upload, X, Loader2, ListPlus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormMode = 'individual' | 'lote';

interface EstampaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateEstampaData) => Promise<void>;
  onSubmitBatch?: (nomes: string[], tecidoBaseId: string) => Promise<void>;
  estampa?: Estampa | null;
  tecidos: Tecido[];
  loading?: boolean;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Chip minimalista de seleção de tecido
function TecidoChip({ 
  tecido, 
  selected, 
  onSelect 
}: { 
  tecido: Tecido; 
  selected: boolean; 
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
        'hover:scale-105 active:scale-95',
        selected 
          ? 'bg-pink-500 text-white shadow-sm' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      {tecido.nome}
    </button>
  );
}

// Validar nome de estampa (mínimo 2 palavras)
function validarNomeEstampa(nome: string): { valido: boolean; erro?: string } {
  const trimmed = nome.trim();
  if (!trimmed) return { valido: false, erro: 'Nome é obrigatório' };
  if (trimmed.length < 3) return { valido: false, erro: 'Nome muito curto' };
  if (trimmed.split(/\s+/).length < 2) return { valido: false, erro: 'Precisa de 2 palavras' };
  return { valido: true };
}

// Extrair família do nome
function extrairFamilia(nome: string): string {
  return nome.trim().split(/\s+/)[0] || '';
}

export function EstampaFormModal({
  open,
  onOpenChange,
  onSubmit,
  onSubmitBatch,
  estampa,
  tecidos,
  loading,
}: EstampaFormModalProps) {
  // Estados comuns
  const [mode, setMode] = useState<FormMode>('individual');
  const [tecidoBaseId, setTecidoBaseId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do modo individual
  const [nome, setNome] = useState('');
  const [imagem, setImagem] = useState<File | string>('');
  const [imagemPreview, setImagemPreview] = useState<string>('');
  const [descricao, setDescricao] = useState('');

  // Estados do modo lote
  const [nomesLote, setNomesLote] = useState('');

  // Parse dos nomes do lote
  const nomesParseados = useMemo(() => {
    if (!nomesLote.trim()) return [];
    
    // Separa por vírgula ou quebra de linha
    return nomesLote
      .split(/[,\n]/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }, [nomesLote]);

  // Validação do lote
  const loteValidacao = useMemo(() => {
    const validos: { nome: string; familia: string }[] = [];
    const invalidos: { nome: string; erro: string }[] = [];

    for (const nome of nomesParseados) {
      const resultado = validarNomeEstampa(nome);
      if (resultado.valido) {
        validos.push({ nome, familia: extrairFamilia(nome) });
      } else {
        invalidos.push({ nome, erro: resultado.erro || 'Inválido' });
      }
    }

    return { validos, invalidos };
  }, [nomesParseados]);

  // Resetar formulário quando modal abrir/fechar ou estampa mudar
  useEffect(() => {
    if (open) {
      if (estampa) {
        // Modo edição - sempre individual
        setMode('individual');
        setNome(estampa.nome);
        setTecidoBaseId(estampa.tecidoBaseId);
        setImagem(estampa.imagem || '');
        setImagemPreview(estampa.imagem || '');
        setDescricao(estampa.descricao || '');
      } else {
        // Modo criação
        resetForm();
        if (tecidos.length === 1) {
          setTecidoBaseId(tecidos[0].id);
        }
      }
      setErrors({});
    }
  }, [open, estampa, tecidos]);

  const resetForm = () => {
    setNome('');
    setTecidoBaseId('');
    setImagem('');
    setImagemPreview('');
    setDescricao('');
    setNomesLote('');
    setErrors({});
  };

  const validateFormIndividual = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nomeValidacao = validarNomeEstampa(nome);
    if (!nomeValidacao.valido) {
      newErrors.nome = nomeValidacao.erro || 'Nome inválido';
    }

    if (!tecidoBaseId) {
      newErrors.tecidoBaseId = 'Selecione um tecido base';
    }

    if (imagem instanceof File) {
      if (!ALLOWED_IMAGE_TYPES.includes(imagem.type)) {
        newErrors.imagem = 'Formato inválido. Use JPG, PNG ou WEBP';
      }
      if (imagem.size > MAX_IMAGE_SIZE) {
        newErrors.imagem = 'Máximo 5MB';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateFormLote = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!tecidoBaseId) {
      newErrors.tecidoBaseId = 'Selecione um tecido base';
    }

    if (loteValidacao.validos.length === 0) {
      newErrors.nomesLote = 'Adicione pelo menos um nome válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setErrors(prev => ({ ...prev, imagem: 'Formato inválido' }));
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setErrors(prev => ({ ...prev, imagem: 'Máximo 5MB' }));
        return;
      }
      setImagem(file);
      setImagemPreview(URL.createObjectURL(file));
      setErrors(prev => { const n = { ...prev }; delete n.imagem; return n; });
    }
  };

  const handleRemoveImage = () => {
    setImagem('');
    setImagemPreview('');
  };

  const handleSelectTecido = (id: string) => {
    setTecidoBaseId(id);
    if (errors.tecidoBaseId) {
      setErrors(prev => { const n = { ...prev }; delete n.tecidoBaseId; return n; });
    }
  };

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormIndividual()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        nome: nome.trim(),
        tecidoBaseId,
        imagem,
        descricao: descricao.trim() || undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch {
      // Erro tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormLote()) return;
    if (!onSubmitBatch) return;

    setIsSubmitting(true);
    try {
      const nomes = loteValidacao.validos.map(v => v.nome);
      await onSubmitBatch(nomes, tecidoBaseId);
      onOpenChange(false);
      resetForm();
    } catch {
      // Erro tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const familiaNome = extrairFamilia(nome);
  const isEditing = !!estampa;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
          <DialogTitle className="text-xl">
            {isEditing ? 'Editar Estampa' : 'Nova Estampa'}
          </DialogTitle>
          <DialogDescription>
            SKU gerado automaticamente pela primeira palavra do nome
          </DialogDescription>
        </DialogHeader>

        {/* Toggle de modo (apenas para criação) */}
        {!isEditing && onSubmitBatch && (
          <div className="flex-shrink-0 px-4 sm:px-6 pb-3">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  mode === 'individual' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setMode('lote')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  mode === 'lote' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ListPlus className="w-3.5 h-3.5" />
                Lote
              </button>
            </div>
          </div>
        )}

        <form onSubmit={mode === 'lote' ? handleSubmitLote : handleSubmitIndividual} className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 space-y-5 pb-4">
          {/* Tecido Base - Chips */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tecido Base <span className="text-red-500">*</span>
            </Label>
            
            {tecidos.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                Cadastre um tecido do tipo "Estampado" primeiro.
              </div>
            ) : (
              <div className={cn(
                'flex flex-wrap gap-2 p-2 rounded-lg border transition-colors',
                errors.tecidoBaseId ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/30'
              )}>
                {tecidos.map((tecido) => (
                  <TecidoChip
                    key={tecido.id}
                    tecido={tecido}
                    selected={tecidoBaseId === tecido.id}
                    onSelect={() => handleSelectTecido(tecido.id)}
                  />
                ))}
              </div>
            )}
            
            {errors.tecidoBaseId && (
              <p className="text-sm text-red-500">{errors.tecidoBaseId}</p>
            )}
          </div>

          {/* Modo Individual */}
          {mode === 'individual' && (
            <>
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errors.nome) {
                      setErrors(prev => { const n = { ...prev }; delete n.nome; return n; });
                    }
                  }}
                  placeholder="Ex: Jardim Pink, Floral Azul"
                  className={cn(errors.nome && 'border-red-500')}
                />
                {familiaNome && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Família:</span>
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full font-medium">
                      {familiaNome}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono text-xs">
                      {familiaNome.substring(0, 2).toUpperCase()}xxx
                    </span>
                  </div>
                )}
                {errors.nome && <p className="text-sm text-red-500">{errors.nome}</p>}
              </div>

              {/* Imagem */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Imagem <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </Label>
                {imagemPreview ? (
                  <div className="relative group">
                    <img
                      src={imagemPreview}
                      alt="Preview"
                      className="w-full h-36 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="imagem"
                    className={cn(
                      'flex flex-col items-center justify-center w-full h-24 rounded-lg cursor-pointer transition-all',
                      'border-2 border-dashed hover:border-pink-300 hover:bg-pink-50/50',
                      errors.imagem ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                    )}
                  >
                    <Upload className="w-5 h-5 mb-1 text-gray-400" />
                    <p className="text-sm text-gray-500">Clique para upload</p>
                    <input
                      id="imagem"
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
                {errors.imagem && <p className="text-sm text-red-500">{errors.imagem}</p>}
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="descricao" className="text-sm font-medium">
                  Descrição <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </>
          )}

          {/* Modo Lote */}
          {mode === 'lote' && (
            <>
              {/* Textarea para nomes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Nomes das Estampas <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={nomesLote}
                  onChange={(e) => {
                    setNomesLote(e.target.value);
                    if (errors.nomesLote) {
                      setErrors(prev => { const n = { ...prev }; delete n.nomesLote; return n; });
                    }
                  }}
                  placeholder={"Jardim Pink\nJardim Azul\nFloral Rosa\n\nOu separe por vírgula: Jardim Pink, Jardim Azul"}
                  rows={5}
                  className={cn(
                    'resize-none font-mono text-sm',
                    errors.nomesLote && 'border-red-500'
                  )}
                />
                <p className="text-xs text-gray-500">
                  Um nome por linha ou separados por vírgula. Cada nome precisa de 2 palavras.
                </p>
                {errors.nomesLote && <p className="text-sm text-red-500">{errors.nomesLote}</p>}
              </div>

              {/* Preview do lote */}
              {nomesParseados.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Preview ({loteValidacao.validos.length} válidos)
                  </Label>
                  <div className="max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-lg border space-y-1.5">
                    {loteValidacao.validos.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-14 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-mono text-xs text-center">
                          {item.familia.substring(0, 2).toUpperCase()}xxx
                        </span>
                        <span className="text-gray-700">{item.nome}</span>
                      </div>
                    ))}
                    {loteValidacao.invalidos.map((item, i) => (
                      <div key={`inv-${i}`} className="flex items-center gap-2 text-sm">
                        <span className="w-14 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs text-center">
                          erro
                        </span>
                        <span className="text-red-600 line-through">{item.nome}</span>
                        <span className="text-red-500 text-xs">({item.erro})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </form>

        <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
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
            type="button"
            onClick={mode === 'lote' ? handleSubmitLote : handleSubmitIndividual}
            disabled={
              isSubmitting || 
              loading || 
              tecidos.length === 0 ||
              (mode === 'lote' && loteValidacao.validos.length === 0)
            }
            className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto"
          >
            {(isSubmitting || loading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === 'lote' 
              ? `Criar ${loteValidacao.validos.length} Estampa${loteValidacao.validos.length !== 1 ? 's' : ''}`
              : isEditing ? 'Salvar' : 'Criar Estampa'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
