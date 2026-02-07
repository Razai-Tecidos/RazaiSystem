import { useState } from 'react';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { EmptyState } from '@/components/Layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTamanhos } from '@/hooks/useTamanhos';
import { Tamanho, CreateTamanhoData } from '@/types/tamanho.types';
import { 
  Plus, 
  Loader2, 
  Edit, 
  Trash2, 
  GripVertical,
  Check,
  X,
  Ruler,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TamanhosProps {
  onNavigateHome?: () => void;
}

// Skeleton para loading
function TamanhoSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Card mobile para tamanho
function TamanhoCard({ 
  tamanho, 
  onEdit, 
  onDelete, 
  onToggleAtivo,
  deleting 
}: { 
  tamanho: Tamanho; 
  onEdit: (t: Tamanho) => void; 
  onDelete: (id: string) => void;
  onToggleAtivo: (t: Tamanho) => void;
  deleting: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Ruler className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900">{tamanho.nome}</h4>
              <p className="text-xs text-gray-500 font-mono">{tamanho.sku}</p>
              {tamanho.descricao && (
                <p className="text-xs text-gray-500 mt-1 truncate">{tamanho.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onToggleAtivo(tamanho)}
                className={cn(
                  "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium min-h-[32px]",
                  tamanho.ativo
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                )}
                aria-label={tamanho.ativo ? 'Desativar tamanho' : 'Ativar tamanho'}
              >
                {tamanho.ativo ? (
                  <><Check className="w-3 h-3 mr-1" />Ativo</>
                ) : (
                  <><X className="w-3 h-3 mr-1" />Inativo</>
                )}
              </button>
            </div>
          </div>
          <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 min-w-[44px]"
              onClick={() => onEdit(tamanho)}
              aria-label="Editar tamanho"
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 min-w-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(tamanho.id)}
              disabled={deleting}
              aria-label="Excluir tamanho"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Trash2 className="h-4 w-4 mr-1" />Excluir</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Tamanhos({ onNavigateHome }: TamanhosProps) {
  const { 
    tamanhos, 
    loading, 
    createTamanho, 
    updateTamanho, 
    deleteTamanho,
  } = useTamanhos();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTamanho, setEditingTamanho] = useState<Tamanho | null>(null);
  const [formData, setFormData] = useState<CreateTamanhoData>({ nome: '', descricao: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleOpenModal = (tamanho?: Tamanho) => {
    if (tamanho) {
      setEditingTamanho(tamanho);
      setFormData({ nome: tamanho.nome, descricao: tamanho.descricao || '' });
    } else {
      setEditingTamanho(null);
      setFormData({ nome: '', descricao: '' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTamanho(null);
    setFormData({ nome: '', descricao: '' });
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) return;

    setSaving(true);
    try {
      if (editingTamanho) {
        await updateTamanho(editingTamanho.id, formData);
      } else {
        await createTamanho(formData);
      }
      handleCloseModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    setDeleting(pendingDeleteId);
    await deleteTamanho(pendingDeleteId);
    setDeleting(null);
    setPendingDeleteId(null);
  };

  const handleToggleAtivo = async (tamanho: Tamanho) => {
    await updateTamanho(tamanho.id, { ativo: !tamanho.ativo });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Tamanhos' }
        ]}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Tamanhos</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Gerencie os tamanhos disponíveis para variações
              </p>
            </div>
            <Button onClick={() => handleOpenModal()} className="min-h-[44px] w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Tamanho
            </Button>
          </div>

          {/* Conteúdo */}
          {loading ? (
            <TamanhoSkeleton />
          ) : tamanhos.length === 0 ? (
            <EmptyState
              icon={<Ruler className="h-8 w-8" />}
              title="Nenhum tamanho cadastrado"
              description="Crie tamanhos para usar nas variações de produtos"
              action={
                <Button onClick={() => handleOpenModal()} className="min-h-[44px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Tamanho
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="md:hidden space-y-3 animate-stagger">
                {tamanhos.map(tamanho => (
                  <TamanhoCard
                    key={tamanho.id}
                    tamanho={tamanho}
                    onEdit={handleOpenModal}
                    onDelete={handleDelete}
                    onToggleAtivo={handleToggleAtivo}
                    deleting={deleting === tamanho.id}
                  />
                ))}
              </div>

              {/* Desktop: Tabela com scroll */}
              <div className="hidden md:block rounded-lg border overflow-hidden animate-fade-in">
                <div className="scroll-smooth-x">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">SKU</TableHead>
                        <TableHead className="font-semibold">Descrição</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tamanhos.map(tamanho => (
                        <TableRow key={tamanho.id} className="hover:bg-gray-50/50">
                          <TableCell>
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                          </TableCell>
                          <TableCell className="font-medium">{tamanho.nome}</TableCell>
                          <TableCell className="text-gray-500 font-mono text-sm">{tamanho.sku}</TableCell>
                          <TableCell className="text-gray-500">{tamanho.descricao || '-'}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleToggleAtivo(tamanho)}
                              className={cn(
                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium min-h-[32px]",
                                tamanho.ativo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              )}
                              aria-label={tamanho.ativo ? 'Desativar tamanho' : 'Ativar tamanho'}
                            >
                              {tamanho.ativo ? (
                                <><Check className="w-3 h-3 mr-1" />Ativo</>
                              ) : (
                                <><X className="w-3 h-3 mr-1" />Inativo</>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
                                onClick={() => handleOpenModal(tamanho)}
                                aria-label="Editar tamanho"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDelete(tamanho.id)}
                                disabled={deleting === tamanho.id}
                                aria-label="Excluir tamanho"
                              >
                                {deleting === tamanho.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTamanho ? 'Editar Tamanho' : 'Novo Tamanho'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: P, M, G, GG, 1,50m"
                className="min-h-[44px]"
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={formData.descricao || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional"
                className="min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseModal} className="min-h-[44px] w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={saving || !formData.nome.trim()}
              className="min-h-[44px] w-full sm:w-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingTamanho ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir tamanho"
        description="Tem certeza que deseja excluir este tamanho? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
