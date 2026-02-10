import { useState, useRef, useEffect, useCallback } from 'react';
import { Estampa } from '@/types/estampa.types';
import { EstampaWithStatus } from '@/hooks/useEstampas';
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
import {
  Edit,
  Trash2,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Link as LinkIcon,
  Check,
  X,
  Pencil,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstampaGrupo {
  key: string;
  label: string;
  estampas: EstampaWithStatus[];
}

interface EstampasTableProps {
  estampasAgrupadas: EstampaGrupo[];
  viewMode: 'table' | 'grid';
  groupBy: 'none' | 'familia' | 'tecido';
  onEdit: (estampa: EstampaWithStatus) => void;
  onDelete: (estampa: EstampaWithStatus) => void;
  onDuplicate: (estampa: EstampaWithStatus) => void;
  onUpdateNome: (id: string, nome: string) => Promise<void>;
  onUpdateSku: (id: string, sku: string) => Promise<void>;
  loading?: boolean;
}

// ============================================================================
// COMPONENTE CARD (para mobile e grid view)
// ============================================================================

function EstampaCard({
  estampa,
  onEdit,
  onDelete,
  onDuplicate,
  onStartEditingNome,
  isGridView = false,
}: {
  estampa: EstampaWithStatus;
  onEdit: (estampa: EstampaWithStatus) => void;
  onDelete: (estampa: EstampaWithStatus) => void;
  onDuplicate: (estampa: EstampaWithStatus) => void;
  onStartEditingNome: (estampa: EstampaWithStatus) => void;
  isGridView?: boolean;
}) {
  const isSaving = estampa._status === 'saving';
  const isDeleting = estampa._status === 'deleting';

  if (isGridView) {
    // Layout de grid - imagem maior
    return (
      <div
        className={cn(
          'bg-white rounded-lg border overflow-hidden transition-all duration-200 hover:shadow-md group',
          (isSaving || isDeleting) && 'opacity-50'
        )}
      >
        {/* Imagem grande */}
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative">
          {estampa.imagem ? (
            <img
              src={estampa.imagem}
              alt={estampa.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-gray-300" />
            </div>
          )}

          {/* Overlay com ações */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9"
              onClick={() => onEdit(estampa)}
              disabled={isSaving || isDeleting}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9"
              onClick={() => onDuplicate(estampa)}
              disabled={isSaving || isDeleting}
              title="Duplicar"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-9 w-9"
              onClick={() => onDelete(estampa)}
              disabled={isSaving || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              {estampa.sku || '-'}
            </span>
          </div>
          <h4
            className="font-semibold text-gray-900 truncate cursor-pointer hover:text-purple-600 transition-colors"
            onClick={() => onStartEditingNome(estampa)}
            title={estampa.nome}
          >
            {estampa.nome}
          </h4>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            Vinculo: {estampa.tecidoBaseNome || 'N/A'}
          </p>
        </div>
      </div>
    );
  }

  // Layout de card mobile
  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]',
        (isSaving || isDeleting) && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Imagem */}
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
          {estampa.imagem ? (
            <img
              src={estampa.imagem}
              alt={estampa.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {estampa.sku || '-'}
                </span>
              </div>
              <h4
                className="font-semibold text-gray-900 mt-1 truncate cursor-pointer hover:text-purple-600 transition-colors"
                onClick={() => onStartEditingNome(estampa)}
              >
                {estampa.nome}
              </h4>
            </div>

            {/* Ações */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDuplicate(estampa)}
                disabled={isSaving || isDeleting}
                title="Duplicar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(estampa)}
                disabled={isSaving || isDeleting}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-red-600"
                onClick={() => onDelete(estampa)}
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

          {/* Detalhes */}
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Vinculo:</span>
            <span className="font-medium text-gray-700 ml-1">
              {estampa.tecidoBaseNome || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function EstampasTable({
  estampasAgrupadas,
  viewMode,
  groupBy,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdateNome,
  onUpdateSku,
  loading,
}: EstampasTableProps) {
  // Estado para edição inline
  const [editingNomeId, setEditingNomeId] = useState<string | null>(null);
  const [editingNomeValue, setEditingNomeValue] = useState('');
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editingSkuValue, setEditingSkuValue] = useState('');
  const [saving, setSaving] = useState(false);
  const nomeInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Estado para grupos colapsados
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Todas as estampas flat
  const todasEstampas = estampasAgrupadas.flatMap(g => g.estampas);

  // Focar no input quando começar a editar
  useEffect(() => {
    if (editingNomeId && nomeInputRef.current) {
      nomeInputRef.current.focus();
      nomeInputRef.current.select();
    }
  }, [editingNomeId]);

  useEffect(() => {
    if (editingSkuId && skuInputRef.current) {
      skuInputRef.current.focus();
      skuInputRef.current.select();
    }
  }, [editingSkuId]);

  // Handlers de edição de nome
  const startEditingNome = useCallback((estampa: Estampa) => {
    setEditingNomeId(estampa.id);
    setEditingNomeValue(estampa.nome);
    setEditingSkuId(null);
  }, []);

  const cancelEditingNome = useCallback(() => {
    setEditingNomeId(null);
    setEditingNomeValue('');
  }, []);

  const saveNome = useCallback(
    async (goToNext: boolean = false) => {
      if (!editingNomeId) return;

      const estampa = todasEstampas.find((e) => e.id === editingNomeId);
      if (!estampa) {
        cancelEditingNome();
        return;
      }

      const novoNome = editingNomeValue.trim();

      if (novoNome === estampa.nome || novoNome === '') {
        if (goToNext) {
          const currentIndex = todasEstampas.findIndex((e) => e.id === editingNomeId);
          const nextEstampa = todasEstampas[currentIndex + 1];
          if (nextEstampa) {
            startEditingNome(nextEstampa);
          } else {
            cancelEditingNome();
          }
        } else {
          cancelEditingNome();
        }
        return;
      }

      setSaving(true);
      try {
        await onUpdateNome(editingNomeId, novoNome);

        if (goToNext) {
          const currentIndex = todasEstampas.findIndex((e) => e.id === editingNomeId);
          const nextEstampa = todasEstampas[currentIndex + 1];
          if (nextEstampa) {
            startEditingNome(nextEstampa);
          } else {
            cancelEditingNome();
          }
        } else {
          cancelEditingNome();
        }
      } catch (error) {
        console.error('Erro ao atualizar nome:', error);
      } finally {
        setSaving(false);
      }
    },
    [editingNomeId, editingNomeValue, todasEstampas, startEditingNome, cancelEditingNome, onUpdateNome]
  );

  // Handlers de edição de SKU
  const startEditingSku = useCallback((estampa: Estampa) => {
    setEditingSkuId(estampa.id);
    setEditingSkuValue(estampa.sku || '');
    setEditingNomeId(null);
  }, []);

  const cancelEditingSku = useCallback(() => {
    setEditingSkuId(null);
    setEditingSkuValue('');
  }, []);

  const saveSku = useCallback(
    async () => {
      if (!editingSkuId) return;

      const estampa = todasEstampas.find((e) => e.id === editingSkuId);
      if (!estampa) {
        cancelEditingSku();
        return;
      }

      const novoSku = editingSkuValue.trim().toUpperCase();

      if (novoSku === estampa.sku || novoSku === '') {
        cancelEditingSku();
        return;
      }

      setSaving(true);
      try {
        await onUpdateSku(editingSkuId, novoSku);
        cancelEditingSku();
      } catch (error) {
        console.error('Erro ao atualizar SKU:', error);
      } finally {
        setSaving(false);
      }
    },
    [editingSkuId, editingSkuValue, todasEstampas, cancelEditingSku, onUpdateSku]
  );

  // Handler de teclas
  const handleNomeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNome(true);
      } else if (e.key === 'Escape') {
        cancelEditingNome();
      }
    },
    [saveNome, cancelEditingNome]
  );

  const handleSkuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveSku();
      } else if (e.key === 'Escape') {
        cancelEditingSku();
      }
    },
    [saveSku, cancelEditingSku]
  );

  // Toggle grupo colapsado
  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // Estado vazio
  if (todasEstampas.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-gray-300" />
        </div>
        <p>Nenhuma estampa encontrada.</p>
      </div>
    );
  }

  // Renderizar grupos
  const renderGrupo = (grupo: EstampaGrupo) => {
    const isCollapsed = collapsedGroups.has(grupo.key);
    const showHeader = groupBy !== 'none' && grupo.label;

    return (
      <div key={grupo.key} className="mb-6 last:mb-0">
        {/* Header do grupo */}
        {showHeader && (
          <button
            onClick={() => toggleGroup(grupo.key)}
            className="flex items-center gap-2 w-full text-left mb-3 group"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
            <span className="font-semibold text-gray-700 group-hover:text-purple-600 transition-colors">
              {grupo.label}
            </span>
            <span className="text-sm text-gray-400">
              ({grupo.estampas.length})
            </span>
          </button>
        )}

        {/* Conteúdo do grupo */}
        {!isCollapsed && (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {grupo.estampas.map((estampa) => (
                  <EstampaCard
                    key={estampa.id}
                    estampa={estampa}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onStartEditingNome={startEditingNome}
                    isGridView
                  />
                ))}
              </div>
            )}

            {/* Table View - Mobile Cards */}
            {viewMode === 'table' && (
              <>
                <div className="md:hidden space-y-3">
                  {grupo.estampas.map((estampa) => (
                    <EstampaCard
                      key={estampa.id}
                      estampa={estampa}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      onStartEditingNome={startEditingNome}
                    />
                  ))}
                </div>

                {/* Table View - Desktop */}
                <div className="hidden md:block rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="font-semibold w-20">Preview</TableHead>
                        <TableHead className="font-semibold w-28">SKU</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">Vinculo</TableHead>
                        <TableHead className="text-right font-semibold w-36">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.estampas.map((estampa, index) => {
                        const isSaving = estampa._status === 'saving';
                        const isDeleting = estampa._status === 'deleting';
                        const isEditingNome = editingNomeId === estampa.id;
                        const isEditingSku = editingSkuId === estampa.id;

                        return (
                          <TableRow
                            key={estampa.id}
                            className={cn(
                              'transition-colors duration-150 hover:bg-gray-50/50',
                              (isSaving || isDeleting) && 'opacity-50'
                            )}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            {/* Preview */}
                            <TableCell>
                              {estampa.imagem ? (
                                <a
                                  href={estampa.imagem}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block w-12 h-12 rounded overflow-hidden border hover:opacity-80 transition-opacity relative group"
                                >
                                  <img
                                    src={estampa.imagem}
                                    alt={estampa.nome}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="h-4 w-4 text-white" />
                                  </div>
                                </a>
                              ) : (
                                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                            </TableCell>

                            {/* SKU - Editável */}
                            <TableCell>
                              {isEditingSku ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    ref={skuInputRef}
                                    value={editingSkuValue}
                                    onChange={(e) => setEditingSkuValue(e.target.value.toUpperCase())}
                                    onKeyDown={handleSkuKeyDown}
                                    onBlur={() => saveSku()}
                                    disabled={saving}
                                    className="h-7 text-sm py-0 px-2 w-24 font-mono"
                                    placeholder="SKU"
                                  />
                                  {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          saveSku();
                                        }}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          cancelEditingSku();
                                        }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 group cursor-pointer"
                                  onClick={() => startEditingSku(estampa)}
                                >
                                  {isSaving ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      {estampa.sku || '...'}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-purple-600 font-mono">
                                        {estampa.sku || '-'}
                                      </span>
                                      <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* Nome - Editável */}
                            <TableCell>
                              {isEditingNome ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    ref={nomeInputRef}
                                    value={editingNomeValue}
                                    onChange={(e) => setEditingNomeValue(e.target.value)}
                                    onKeyDown={handleNomeKeyDown}
                                    onBlur={() => saveNome(false)}
                                    disabled={saving}
                                    className="h-7 text-sm py-0 px-2 w-48"
                                    placeholder="Nome da estampa"
                                  />
                                  {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          saveNome(false);
                                        }}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          cancelEditingNome();
                                        }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 group cursor-pointer"
                                  onClick={() => startEditingNome(estampa)}
                                >
                                  <span className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                                    {estampa.nome}
                                  </span>
                                  <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </TableCell>

                            {/* Vinculo */}
                            <TableCell>
                              <div className="flex items-center gap-2 text-gray-600">
                                <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
                                <span>{estampa.tecidoBaseNome || 'N/A'}</span>
                              </div>
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                  onClick={() => onDuplicate(estampa)}
                                  disabled={isSaving || isDeleting}
                                  title="Duplicar"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                                  onClick={() => onEdit(estampa)}
                                  disabled={isSaving || isDeleting}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  onClick={() => onDelete(estampa)}
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
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return <div className="animate-fade-in">{estampasAgrupadas.map(renderGrupo)}</div>;
}
