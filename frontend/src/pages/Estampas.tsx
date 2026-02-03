import { useState } from 'react';
import { useEstampas } from '@/hooks/useEstampas';
import { useTecidos } from '@/hooks/useTecidos';
import { EstampasTable } from '@/components/Estampas/EstampasTable';
import { EstampaFormModal } from '@/components/Estampas/EstampaFormModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Estampa, CreateEstampaData, UpdateEstampaData } from '@/types/estampa.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';

interface EstampasProps {
  onNavigateHome?: () => void;
}

export function Estampas({ onNavigateHome }: EstampasProps) {
  const { estampas, loading, createEstampa, updateEstampa, deleteEstampa } = useEstampas();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEstampa, setEditingEstampa] = useState<Estampa | null>(null);

  // Filtrar apenas tecidos do tipo "estampado" para vincular
  const tecidosEstampados = tecidos.filter(t => t.tipo === 'estampado');

  const handleAddClick = () => {
    setEditingEstampa(null);
    setModalOpen(true);
  };

  const handleEditClick = (estampa: Estampa) => {
    setEditingEstampa(estampa);
    setModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta estampa?')) {
      return;
    }

    try {
      await deleteEstampa(id);
    } catch (error) {
      // Erro já é tratado no hook
    }
  };

  const handleSubmit = async (data: CreateEstampaData) => {
    try {
      if (editingEstampa) {
        // Modo edição
        const updateData: UpdateEstampaData = {
          id: editingEstampa.id,
          ...data,
        };
        await updateEstampa(updateData);
      } else {
        // Modo criação
        await createEstampa(data);
      }
      setModalOpen(false);
      setEditingEstampa(null);
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
          { label: 'Estampas' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Estampas Cadastradas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Vincule estampas aos tecidos do tipo "Estampado"
              </p>
            </div>
            <Button 
              onClick={handleAddClick} 
              disabled={loadingTecidos || tecidosEstampados.length === 0}
              title={tecidosEstampados.length === 0 ? 'Cadastre um tecido do tipo "Estampado" primeiro' : ''}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Estampa
            </Button>
          </div>

          {/* Aviso se não houver tecidos estampados */}
          {!loadingTecidos && tecidosEstampados.length === 0 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Atenção:</strong> Para adicionar estampas, primeiro cadastre um tecido do tipo "Estampado" na página de Tecidos.
              </p>
            </div>
          )}

          {loading && estampas.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <EstampasTable
              estampas={estampas}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              loading={loading}
            />
          )}
        </div>
      </main>

      <EstampaFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        estampa={editingEstampa}
        tecidos={tecidosEstampados}
        loading={loading || loadingTecidos}
      />
    </div>
  );
}
