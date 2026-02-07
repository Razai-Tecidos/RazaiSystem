import { useState, useEffect, useMemo, useRef } from 'react';
import { Cor, CorTecido } from '@/types/cor.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, Loader2, Image as ImageIcon, AlertTriangle, Link as LinkIcon, Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConflitoCor {
  corId: string;
  corNome: string;
  deltaE: number;
}

interface CoresTableProps {
  cores: Cor[];
  vinculos?: CorTecido[]; // Lista de vínculos cor-tecido
  onEdit: (cor: Cor) => void;
  onDelete: (id: string) => void;
  onUpdateNome?: (corId: string, novoNome: string) => Promise<void>; // Atualiza nome inline
  onNavigateVinculos?: () => void; // Navega para página de vínculos
  onEditVinculo?: (vinculo: CorTecido) => void; // Edita um vínculo específico
  loading?: boolean;
  mapaConflitos?: Map<string, ConflitoCor[]>;
}

// Componente para edição inline do nome
function EditableNome({
  nome,
  corId,
  onSave,
  temConflito,
}: {
  nome: string;
  corId: string;
  onSave?: (corId: string, novoNome: string) => Promise<void>;
  temConflito?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nome);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(nome);
  }, [nome]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    if (!onSave || value.trim() === nome || value.trim() === '') {
      setEditing(false);
      setValue(nome);
      return;
    }

    setSaving(true);
    try {
      await onSave(corId, value.trim());
      setEditing(false);
    } catch (error: any) {
      // Se for erro de nome duplicado, manter o input aberto para correção
      if (error?.message?.includes('Nome duplicado')) {
        // Não reseta o valor, permite o usuário corrigir
        setSaving(false);
        return;
      }
      // Para outros erros, restaurar valor original
      setValue(nome);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(nome);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={saving}
          className="h-7 text-sm py-0 px-2 w-40"
        />
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      {temConflito && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
      <span 
        className={cn(
          "cursor-pointer hover:text-primary transition-colors",
          onSave && "border-b border-dashed border-transparent hover:border-gray-400"
        )}
        onClick={() => onSave && setEditing(true)}
        title={onSave ? "Clique para editar o nome" : undefined}
      >
        {nome}
      </span>
      {onSave && (
        <Pencil 
          className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" 
          onClick={() => setEditing(true)}
        />
      )}
    </div>
  );
}

// Componente para mostrar conflitos
function ConflitosIndicator({ conflitos }: { conflitos?: ConflitoCor[] }) {
  if (!conflitos || conflitos.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      <div className="text-xs text-amber-700">
        <span className="font-medium">Conflita com:</span>{' '}
        {conflitos.map((c, i) => (
          <span key={c.corId}>
            {c.corNome} <span className="text-amber-500">(ΔE={c.deltaE.toFixed(1)})</span>
            {i < conflitos.length - 1 && ', '}
          </span>
        ))}
      </div>
    </div>
  );
}

// Componente para mostrar vínculos resumidos
function VinculosInfo({ 
  vinculos, 
  onNavigateVinculos,
  onEditVinculo 
}: { 
  vinculos: CorTecido[]; 
  onNavigateVinculos?: () => void;
  onEditVinculo?: (vinculo: CorTecido) => void;
}) {
  if (vinculos.length === 0) {
    return (
      <span className="text-gray-400 text-sm">Nenhum vínculo</span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-sm font-medium text-blue-600">
          {vinculos.length} {vinculos.length === 1 ? 'tecido' : 'tecidos'}
        </span>
      </div>
      <div className="text-xs space-y-1">
        {vinculos.slice(0, 3).map((v) => (
          <button 
            key={v.id} 
            onClick={() => onEditVinculo?.(v)}
            className="flex items-center gap-1.5 w-full text-left hover:bg-gray-100 rounded px-1 py-0.5 transition-colors group"
            title={`Editar vínculo: ${v.corNome} + ${v.tecidoNome}`}
          >
            {/* Indicador de imagem */}
            {v.imagemTingida ? (
              <ImageIcon className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : (
              <ImageIcon className="h-3 w-3 text-gray-300 flex-shrink-0" />
            )}
            <span className="text-gray-600 group-hover:text-blue-600 truncate">
              {v.tecidoNome}
            </span>
            {v.tecidoSku && (
              <span className="text-gray-400">({v.tecidoSku})</span>
            )}
            <Edit className="h-3 w-3 text-gray-400 group-hover:text-blue-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
        {vinculos.length > 3 && (
          <button
            onClick={onNavigateVinculos}
            className="text-blue-500 hover:underline text-xs pl-1"
          >
            +{vinculos.length - 3} mais...
          </button>
        )}
      </div>
    </div>
  );
}

// Componente Card para mobile
function CorCard({ 
  cor, 
  vinculos,
  onEdit, 
  onDelete,
  onUpdateNome,
  onNavigateVinculos,
  onEditVinculo,
  conflitos 
}: { 
  cor: Cor; 
  vinculos: CorTecido[];
  onEdit: (cor: Cor) => void; 
  onDelete: (id: string) => void;
  onUpdateNome?: (corId: string, novoNome: string) => Promise<void>;
  onNavigateVinculos?: () => void;
  onEditVinculo?: (vinculo: CorTecido) => void;
  conflitos?: ConflitoCor[];
}) {
  const isSaving = (cor as any)._status === 'saving';
  const isDeleting = (cor as any)._status === 'deleting';
  const temConflito = conflitos && conflitos.length > 0;
  // Buscar o primeiro vínculo que tenha imagem
  const vinculoComImagem = vinculos.find(v => v.imagemTingida) || vinculos[0];

  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        (isSaving || isDeleting) && 'opacity-50',
        temConflito && 'border-amber-300 bg-amber-50/30'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Imagem tingida do primeiro vínculo com imagem ou swatch da cor */}
        {vinculoComImagem?.imagemTingida ? (
          <img
            src={vinculoComImagem.imagemTingida}
            alt={`${cor.nome} tingido`}
            className={cn(
              "w-14 h-14 rounded-lg border-2 flex-shrink-0 shadow-sm object-cover",
              temConflito ? 'border-amber-300' : 'border-gray-200'
            )}
          />
        ) : (
          <div
            className={cn(
              "w-14 h-14 rounded-lg border-2 flex-shrink-0 shadow-sm",
              temConflito ? 'border-amber-300' : 'border-gray-200'
            )}
            style={{ backgroundColor: cor.codigoHex || '#ccc' }}
          />
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                {temConflito && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                {cor.sku ? (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {cor.sku}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Sem SKU</span>
                )}
              </div>
              <div className="mt-1">
                <EditableNome
                  nome={cor.nome}
                  corId={cor.id}
                  onSave={onUpdateNome}
                  temConflito={false}
                />
              </div>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{cor.codigoHex || '-'}</p>
            </div>
            
            {/* Acoes */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(cor)}
                disabled={isSaving || isDeleting}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-red-600"
                onClick={() => onDelete(cor.id)}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Conflitos */}
          <ConflitosIndicator conflitos={conflitos} />
          
          {/* Vínculos */}
          {vinculos.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <VinculosInfo 
                vinculos={vinculos} 
                onNavigateVinculos={onNavigateVinculos}
                onEditVinculo={onEditVinculo}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CoresTable({
  cores,
  vinculos = [],
  onEdit,
  onDelete,
  onUpdateNome,
  onNavigateVinculos,
  onEditVinculo,
  loading,
  mapaConflitos,
}: CoresTableProps) {
  // Mapear vínculos por corId para acesso rápido
  const vinculosPorCor = useMemo(() => {
    const map = new Map<string, CorTecido[]>();
    for (const vinculo of vinculos) {
      const existentes = map.get(vinculo.corId) || [];
      existentes.push(vinculo);
      map.set(vinculo.corId, existentes);
    }
    return map;
  }, [vinculos]);

  if (cores.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <div className="w-8 h-8 rounded bg-gray-300" />
        </div>
        <p>Nenhuma cor cadastrada ainda.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3 animate-stagger">
        {cores.map((cor) => (
          <CorCard 
            key={cor.id} 
            cor={cor} 
            vinculos={vinculosPorCor.get(cor.id) || []}
            onEdit={onEdit} 
            onDelete={onDelete}
            onUpdateNome={onUpdateNome}
            onNavigateVinculos={onNavigateVinculos}
            onEditVinculo={onEditVinculo}
            conflitos={mapaConflitos?.get(cor.id)}
          />
        ))}
      </div>

      {/* Desktop: Tabela com scroll */}
      <div className="hidden md:block rounded-lg border overflow-hidden animate-fade-in">
        <div className="scroll-smooth-x">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Cor</TableHead>
                <TableHead className="font-semibold">Preview</TableHead>
                <TableHead className="font-semibold">Vínculos</TableHead>
                <TableHead className="font-semibold">Conflitos</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cores.map((cor, index) => {
                const isSaving = (cor as any)._status === 'saving';
                const isDeleting = (cor as any)._status === 'deleting';
                const conflitos = mapaConflitos?.get(cor.id);
                const temConflito = conflitos && conflitos.length > 0;
                const corVinculos = vinculosPorCor.get(cor.id) || [];
                // Buscar o primeiro vínculo que tenha imagem, ou o primeiro se nenhum tiver
                const vinculoComImagem = corVinculos.find(v => v.imagemTingida) || corVinculos[0];

                return (
                  <TableRow
                    key={cor.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-gray-50/50",
                      (isSaving || isDeleting) && 'opacity-50',
                      temConflito && 'bg-amber-50/50'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="font-medium">
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {cor.sku || '-'}
                        </span>
                      ) : cor.sku ? (
                        <span className="text-primary">{cor.sku}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <EditableNome
                        nome={cor.nome}
                        corId={cor.id}
                        onSave={onUpdateNome}
                        temConflito={temConflito}
                      />
                    </TableCell>
                    <TableCell>
                      {cor.codigoHex ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-md border-2 shadow-sm transition-transform hover:scale-110",
                              temConflito ? 'border-amber-300' : 'border-gray-200'
                            )}
                            style={{ backgroundColor: cor.codigoHex }}
                            title={cor.codigoHex}
                          />
                          <span className="font-mono text-xs text-gray-500">{cor.codigoHex}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vinculoComImagem?.imagemTingida ? (
                        <a 
                          href={vinculoComImagem.imagemTingida} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={vinculoComImagem.imagemTingida}
                            alt={`${cor.nome} tingido`}
                            className="w-12 h-12 rounded-md border border-gray-200 shadow-sm object-cover transition-transform hover:scale-110"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-md border border-dashed border-gray-300 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <VinculosInfo 
                        vinculos={corVinculos} 
                        onNavigateVinculos={onNavigateVinculos}
                        onEditVinculo={onEditVinculo}
                      />
                    </TableCell>
                    <TableCell>
                      {temConflito ? (
                        <div className="text-xs space-y-0.5 max-w-48">
                          {conflitos.map((c) => (
                            <div key={c.corId} className="text-amber-700">
                              <span className="font-medium">{c.corNome}</span>
                              <span className="text-amber-500 ml-1">(ΔE={c.deltaE.toFixed(1)})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => onEdit(cor)}
                          disabled={isSaving || isDeleting}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => onDelete(cor.id)}
                          disabled={isSaving || isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
