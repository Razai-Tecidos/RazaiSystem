import { useState, useEffect } from 'react';
import { useTecidos } from '@/hooks/useTecidos';
import { TecidosTable } from '@/components/Tecidos/TecidosTable';
import { TecidoFormModal } from '@/components/Tecidos/TecidoFormModal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus } from 'lucide-react';
import { Tecido, CreateTecidoData, UpdateTecidoData } from '@/types/tecido.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { migrateTecidosTipo } from '@/lib/firebase/tecidos';

interface TecidosProps {
  onNavigateHome?: () => void;
}

export function Tecidos({ onNavigateHome }: TecidosProps) {
  const { tecidos, loading, createTecido, updateTecido, deleteTecido, loadTecidos } = useTecidos();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTecido, setEditingTecido] = useState<Tecido | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Migração única: adicionar tipo 'liso' aos tecidos existentes
  useEffect(() => {
    const runMigration = async () => {
      const migrationKey = 'tecidos_tipo_migrated';
      if (localStorage.getItem(migrationKey)) return;
      
      try {
        const count = await migrateTecidosTipo();
        if (count > 0) {
          console.log(`Migração: ${count} tecidos atualizados para tipo 'liso'`);
          loadTecidos(); // Recarrega a lista
        }
        localStorage.setItem(migrationKey, 'true');
      } catch (error) {
        console.error('Erro na migração:', error);
      }
    };
    
    runMigration();
  }, [loadTecidos]);

  const handleAddClick = () => {
    setEditingTecido(null);
    setModalOpen(true);
  };

  const handleEditClick = (tecido: Tecido) => {
    setEditingTecido(tecido);
    setModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    try {
      await deleteTecido(pendingDeleteId);
    } catch (error) {
      // Erro já é tratado no hook
    }
    setPendingDeleteId(null);
  };

  const handleSubmit = async (data: CreateTecidoData) => {
    try {
      if (editingTecido) {
        // Modo edição
        const updateData: UpdateTecidoData = {
          id: editingTecido.id,
          ...data,
        };
        await updateTecido(updateData);
      } else {
        // Modo criação
        await createTecido(data);
      }
      setModalOpen(false);
      setEditingTecido(null);
    } catch (error) {
      // Erro já é tratado no hook
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Tecidos' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Tecidos Cadastrados
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gerencie tecidos lisos e estampados
              </p>
            </div>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Tecido
            </Button>
          </div>

          {loading && tecidos.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-gray-200 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TecidosTable
              tecidos={tecidos}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              loading={loading}
            />
          )}
        </div>
      </main>

      <TecidoFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        tecido={editingTecido}
        loading={loading}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir tecido"
        description="Tem certeza que deseja excluir este tecido? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
