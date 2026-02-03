import { useState } from 'react';
import { useCores } from '@/hooks/useCores';
import { CoresTable } from '@/components/Cores/CoresTable';
import { CorFormModal } from '@/components/Cores/CorFormModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Cor, CreateCorData, UpdateCorData } from '@/types/cor.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';

interface CoresProps {
  onNavigateHome?: () => void;
}

export function Cores({ onNavigateHome }: CoresProps) {
  const { cores, loading, error, createCor, updateCor, deleteCor } = useCores();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCor, setEditingCor] = useState<Cor | null>(null);

  const handleAddClick = () => {
    setEditingCor(null);
    setModalOpen(true);
  };

  const handleEditClick = (cor: Cor) => {
    setEditingCor(cor);
    setModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cor?')) {
      return;
    }

    try {
      await deleteCor(id);
    } catch (error) {
      // Erro já é tratado no hook
    }
  };

  const handleSubmit = async (data: CreateCorData) => {
    try {
      if (editingCor) {
        // Modo edição
        const updateData: UpdateCorData = {
          id: editingCor.id,
          ...data,
        };
        await updateCor(updateData);
      } else {
        // Modo criação
        await createCor(data);
      }
      setModalOpen(false);
      setEditingCor(null);
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
          { label: 'Cores' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Cores Cadastradas
            </h2>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Cor
            </Button>
          </div>

          {loading && cores.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-1">Erro ao carregar cores</h4>
                  <p className="text-sm text-red-800">{error}</p>
                  <p className="text-xs text-red-600 mt-2">
                    Verifique sua conexão e permissões do Firebase.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <CoresTable
              cores={cores}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              loading={loading}
            />
          )}
        </div>
      </main>

      <CorFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        cor={editingCor}
        loading={loading}
      />
    </div>
  );
}
