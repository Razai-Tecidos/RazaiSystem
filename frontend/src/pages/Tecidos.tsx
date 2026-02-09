import { useState, useEffect, useMemo } from 'react';
import { useTecidos } from '@/hooks/useTecidos';
import { TecidosTable } from '@/components/Tecidos/TecidosTable';
import { TecidoFormModal } from '@/components/Tecidos/TecidoFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Search } from 'lucide-react';
import { Tecido, CreateTecidoData, UpdateTecidoData, TipoTecido } from '@/types/tecido.types';
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

  // Busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoTecido | 'todos'>('todos');

  // Migração única: adicionar tipo 'liso' aos tecidos existentes
  useEffect(() => {
    const runMigration = async () => {
      const migrationKey = 'tecidos_tipo_migrated';
      if (localStorage.getItem(migrationKey)) return;
      
      try {
        const count = await migrateTecidosTipo();
        if (count > 0) {
          console.log(`Migração: ${count} tecidos atualizados para tipo 'liso'`);
          loadTecidos();
        }
        localStorage.setItem(migrationKey, 'true');
      } catch (error) {
        console.error('Erro na migração:', error);
      }
    };
    
    runMigration();
  }, [loadTecidos]);

  // Filtrar tecidos
  const filteredTecidos = useMemo(() => {
    let result = tecidos;

    // Filtro por tipo
    if (filterTipo !== 'todos') {
      result = result.filter(t => t.tipo === filterTipo);
    }

    // Busca por nome ou SKU
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(t =>
        t.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term) ||
        t.sku.toLowerCase().includes(term)
      );
    }

    return result;
  }, [tecidos, filterTipo, searchTerm]);

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
        const updateData: UpdateTecidoData = {
          id: editingTecido.id,
          ...data,
        };
        await updateTecido(updateData);
      } else {
        await createTecido(data);
      }
      setModalOpen(false);
      setEditingTecido(null);
    } catch (error) {
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
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Tecidos Cadastrados
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {tecidos.length} tecido{tecidos.length !== 1 ? 's' : ''} cadastrado{tecidos.length !== 1 ? 's' : ''}
                {filterTipo !== 'todos' || searchTerm.trim() ? ` (${filteredTecidos.length} exibido${filteredTecidos.length !== 1 ? 's' : ''})` : ''}
              </p>
            </div>
            <Button onClick={handleAddClick} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Tecido
            </Button>
          </div>

          {/* Busca e Filtro */}
          {tecidos.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {([
                  { value: 'todos', label: 'Todos' },
                  { value: 'liso', label: 'Lisos' },
                  { value: 'estampado', label: 'Estampados' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterTipo(opt.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      filterTipo === opt.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              tecidos={filteredTecidos}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onAdd={handleAddClick}
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
