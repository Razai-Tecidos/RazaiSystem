import { useState, useEffect } from 'react';
import { useTecidos } from '@/hooks/useTecidos';
import { TecidosTable } from '@/components/Tecidos/TecidosTable';
import { TecidoFormModal } from '@/components/Tecidos/TecidoFormModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
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

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tecido?')) {
      return;
    }

    try {
      await deleteTecido(id);
    } catch (error) {
      // Erro já é tratado no hook
    }
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
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
    </div>
  );
}
