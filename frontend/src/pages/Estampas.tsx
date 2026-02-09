import { useState, useMemo, useCallback } from 'react';
import { useEstampas } from '@/hooks/useEstampas';
import { useTecidos } from '@/hooks/useTecidos';
import { EstampasTable } from '@/components/Estampas/EstampasTable';
import { EstampaFormModal } from '@/components/Estampas/EstampaFormModal';
import { DeleteConfirmModal } from '@/components/Estampas/DeleteConfirmModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Grid3X3,
  List,
  Download,
  X,
} from 'lucide-react';
import { Estampa, CreateEstampaData, UpdateEstampaData } from '@/types/estampa.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { extrairNomeFamiliaEstampa } from '@/lib/firebase/estampas';

interface EstampasProps {
  onNavigateHome?: () => void;
}

type SortField = 'nome' | 'sku' | 'tecido' | 'data';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';
type GroupBy = 'none' | 'familia' | 'tecido';

export function Estampas({ onNavigateHome }: EstampasProps) {
  const { estampas, loading, createEstampa, createEstampasBatch, updateEstampa, deleteEstampa } = useEstampas();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { toast } = useToast();

  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEstampa, setEditingEstampa] = useState<Estampa | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [estampaToDelete, setEstampaToDelete] = useState<Estampa | null>(null);

  // Estados de filtro e ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTecido, setFilterTecido] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('data');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  // Filtrar apenas tecidos do tipo "estampado" para vincular
  const tecidosEstampados = tecidos.filter(t => t.tipo === 'estampado');

  // Tecidos únicos das estampas (para filtro)
  const tecidosComEstampas = useMemo(() => {
    const ids = new Set(estampas.map(e => e.tecidoBaseId));
    return tecidosEstampados.filter(t => ids.has(t.id));
  }, [estampas, tecidosEstampados]);

  // Filtrar e ordenar estampas
  const estampasFiltradas = useMemo(() => {
    let resultado = [...estampas];

    // Filtro por busca
    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase();
      resultado = resultado.filter(e =>
        e.nome.toLowerCase().includes(termo) ||
        e.sku?.toLowerCase().includes(termo) ||
        e.tecidoBaseNome?.toLowerCase().includes(termo)
      );
    }

    // Filtro por tecido
    if (filterTecido !== 'all') {
      resultado = resultado.filter(e => e.tecidoBaseId === filterTecido);
    }

    // Ordenação
    resultado.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'nome':
          comparison = (a.nome || '').localeCompare(b.nome || '');
          break;
        case 'sku':
          comparison = (a.sku || '').localeCompare(b.sku || '');
          break;
        case 'tecido':
          comparison = (a.tecidoBaseNome || '').localeCompare(b.tecidoBaseNome || '');
          break;
        case 'data':
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          comparison = aTime - bTime;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return resultado;
  }, [estampas, searchTerm, filterTecido, sortField, sortOrder]);

  // Agrupar estampas
  const estampasAgrupadas = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', estampas: estampasFiltradas }];
    }

    const grupos = new Map<string, Estampa[]>();

    estampasFiltradas.forEach(estampa => {
      let key: string;
      if (groupBy === 'familia') {
        key = extrairNomeFamiliaEstampa(estampa.nome) || '';
      } else {
        key = estampa.tecidoBaseNome || 'Sem tecido';
      }

      const lista = grupos.get(key) || [];
      lista.push(estampa);
      grupos.set(key, lista);
    });

    // Ordenar grupos por nome
    return Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, estampas]) => ({ key, label: key, estampas }));
  }, [estampasFiltradas, groupBy]);

  // Handlers
  const handleAddClick = () => {
    setEditingEstampa(null);
    setModalOpen(true);
  };

  const handleEditClick = (estampa: Estampa) => {
    setEditingEstampa(estampa);
    setModalOpen(true);
  };

  const handleDeleteClick = (estampa: Estampa) => {
    setEstampaToDelete(estampa);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!estampaToDelete) return;

    try {
      await deleteEstampa(estampaToDelete.id);
      setDeleteModalOpen(false);
      setEstampaToDelete(null);
    } catch (error) {
      // Erro já é tratado no hook
    }
  };

  const handleDuplicate = useCallback(async (estampa: Estampa) => {
    try {
      // Criar nome único para a cópia
      let novoNome = `${estampa.nome} (cópia)`;
      let contador = 2;
      
      // Verificar se já existe uma cópia
      while (estampas.some(e => e.nome.toLowerCase() === novoNome.toLowerCase())) {
        novoNome = `${estampa.nome} (cópia ${contador})`;
        contador++;
      }

      await createEstampa({
        nome: novoNome,
        tecidoBaseId: estampa.tecidoBaseId,
        descricao: estampa.descricao,
      });

      toast({
        title: 'Estampa duplicada!',
        description: `"${novoNome}" criada com sucesso.`,
      });
    } catch (error) {
      // Erro já é tratado no hook
    }
  }, [estampas, createEstampa, toast]);

  const handleUpdateNome = async (id: string, nome: string) => {
    await updateEstampa({ id, nome });
  };

  const handleUpdateSku = async (id: string, sku: string) => {
    await updateEstampa({ id, sku });
  };

  const handleSubmit = async (data: CreateEstampaData) => {
    try {
      if (editingEstampa) {
        const updateData: UpdateEstampaData = {
          id: editingEstampa.id,
          ...data,
        };
        await updateEstampa(updateData);
      } else {
        await createEstampa(data);
      }
      setModalOpen(false);
      setEditingEstampa(null);
    } catch (error) {
      throw error;
    }
  };

  // Exportar para CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['SKU', 'Nome', 'Família', 'Tecido Base', 'Descrição'];
    const rows = estampasFiltradas.map(e => [
      e.sku || '',
      e.nome,
      extrairNomeFamiliaEstampa(e.nome) || '',
      e.tecidoBaseNome || '',
      e.descricao || '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estampas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportado!',
      description: `${estampasFiltradas.length} estampas exportadas para CSV.`,
    });
  }, [estampasFiltradas, toast]);

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterTecido('all');
    setSortField('data');
    setSortOrder('desc');
    setGroupBy('none');
  };

  const hasActiveFilters = searchTerm || filterTecido !== 'all' || groupBy !== 'none';

  // Contadores
  const totalEstampas = estampas.length;
  const totalFiltradas = estampasFiltradas.length;
  const totalFamilias = new Set(estampas.map(e => extrairNomeFamiliaEstampa(e.nome) || '')).size;

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
          {/* Header com contador */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Estampas Cadastradas
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-500">
                  {totalEstampas} {totalEstampas === 1 ? 'estampa' : 'estampas'}
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-sm text-gray-500">
                  {totalFamilias} {totalFamilias === 1 ? 'família' : 'famílias'}
                </span>
                {hasActiveFilters && totalFiltradas !== totalEstampas && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-purple-600 font-medium">
                      {totalFiltradas} filtradas
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={estampasFiltradas.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button 
                onClick={handleAddClick} 
                disabled={loadingTecidos || tecidosEstampados.length === 0}
                title={tecidosEstampados.length === 0 ? 'Cadastre um tecido do tipo "Estampado" primeiro' : ''}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Aviso se não houver tecidos estampados */}
          {!loadingTecidos && tecidosEstampados.length === 0 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Atenção:</strong> Para adicionar estampas, primeiro cadastre um tecido do tipo "Estampado" na página de Tecidos.
              </p>
            </div>
          )}

          {/* Barra de filtros */}
          <div className="flex flex-col lg:flex-row gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, SKU ou tecido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtro por tecido */}
            <Select value={filterTecido} onValueChange={setFilterTecido}>
              <SelectTrigger className="w-full lg:w-48 bg-white">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Tecido base" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tecidos</SelectItem>
                {tecidosComEstampas.map(tecido => (
                  <SelectItem key={tecido.id} value={tecido.id}>
                    {tecido.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Agrupar por */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-full lg:w-44 bg-white">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="familia">Por família</SelectItem>
                <SelectItem value="tecido">Por tecido</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordenação */}
            <Select 
              value={`${sortField}-${sortOrder}`} 
              onValueChange={(v) => {
                const [field, order] = v.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-full lg:w-44 bg-white">
                <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data-desc">Mais recentes</SelectItem>
                <SelectItem value="data-asc">Mais antigas</SelectItem>
                <SelectItem value="nome-asc">Nome A-Z</SelectItem>
                <SelectItem value="nome-desc">Nome Z-A</SelectItem>
                <SelectItem value="sku-asc">SKU A-Z</SelectItem>
                <SelectItem value="sku-desc">SKU Z-A</SelectItem>
                <SelectItem value="tecido-asc">Tecido A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* Toggle de visualização */}
            <div className="flex gap-1 p-1 bg-white rounded-lg border">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'table' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600'
                )}
                title="Visualização em tabela"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600'
                )}
                title="Visualização em grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-gray-500"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Conteúdo */}
          {loading && estampas.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : estampasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {hasActiveFilters ? (
                <>
                  <p>Nenhuma estampa encontrada com os filtros aplicados.</p>
                  <Button
                    variant="link"
                    onClick={handleClearFilters}
                    className="mt-2"
                  >
                    Limpar filtros
                  </Button>
                </>
              ) : (
                <p>Nenhuma estampa cadastrada ainda.</p>
              )}
            </div>
          ) : (
            <EstampasTable
              estampasAgrupadas={estampasAgrupadas}
              viewMode={viewMode}
              groupBy={groupBy}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onDuplicate={handleDuplicate}
              onUpdateNome={handleUpdateNome}
              onUpdateSku={handleUpdateSku}
              loading={loading}
            />
          )}
        </div>
      </main>

      {/* Modal de formulário */}
      <EstampaFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        onSubmitBatch={createEstampasBatch}
        estampa={editingEstampa}
        tecidos={tecidosEstampados}
        loading={loading || loadingTecidos}
      />

      {/* Modal de confirmação de exclusão */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        estampa={estampaToDelete}
      />
    </div>
  );
}
