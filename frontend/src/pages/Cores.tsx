import { useState, useMemo } from 'react';
import { useCores } from '@/hooks/useCores';
import { useCorTecido } from '@/hooks/useCorTecido';
import { CoresTable } from '@/components/Cores/CoresTable';
import { CorFormModal } from '@/components/Cores/CorFormModal';
import { EditarCor } from './EditarCor';
import { EditarVinculo } from './EditarVinculo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Loader2, AlertTriangle, Copy, Merge, Check, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Cor, CreateCorData, UpdateCorData, CorTecido } from '@/types/cor.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { encontrarTodosConflitos, criarMapaConflitos, ParConflito } from '@/lib/deltaE';
import { cn } from '@/lib/utils';
import { useConfig } from '@/hooks/useConfig';

interface CoresProps {
  onNavigateHome?: () => void;
  onNavigateToVinculos?: () => void;
}

export function Cores({ onNavigateHome, onNavigateToVinculos }: CoresProps) {
  const { cores, loading, error, createCor, updateCor, deleteCor, mesclarCores } = useCores();
  const { vinculos, loading: loadingVinculos, contarVinculosPorCor } = useCorTecido();
  const { deltaELimiar, setDeltaELimiar, loading: loadingConfig, saving: savingConfig } = useConfig();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCor, setEditingCor] = useState<Cor | null>(null);
  const [editingCorId, setEditingCorId] = useState<string | null>(null);
  const [mesclando, setMesclando] = useState(false);
  const [conflitoParaMesclar, setConflitoParaMesclar] = useState<ParConflito | null>(null);
  const [corSelecionadaParaManter, setCorSelecionadaParaManter] = useState<'cor1' | 'cor2' | null>(null);
  const [editingVinculoId, setEditingVinculoId] = useState<string | null>(null);

  // Busca e confirmação de exclusão
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Calcular conflitos com base no limiar atual (do Firebase)
  const { conflitos, mapaConflitos } = useMemo(() => {
    const conflitos = encontrarTodosConflitos(cores, deltaELimiar);
    const mapaConflitos = criarMapaConflitos(conflitos);
    return { conflitos, mapaConflitos };
  }, [cores, deltaELimiar]);

  // Filtrar cores por busca
  const filteredCores = useMemo(() => {
    if (!searchTerm.trim()) return cores;

    const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cores.filter(cor =>
      cor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term) ||
      cor.sku?.toLowerCase().includes(term) ||
      cor.codigoHex?.toLowerCase().includes(term)
    );
  }, [cores, searchTerm]);

  const handleAddClick = () => {
    setEditingCor(null);
    setModalOpen(true);
  };

  const handleCopiarHexCapturadas = async () => {
    const coresCapturadas = cores.filter(cor => 
      cor.nome.toLowerCase().startsWith('cor capturada')
    );
    
    if (coresCapturadas.length === 0) {
      toast({
        title: 'Nenhuma cor encontrada',
        description: 'Não há cores com nome "Cor capturada..." para copiar.',
        variant: 'destructive',
      });
      return;
    }
    
    const hexCodes = coresCapturadas
      .map(cor => cor.codigoHex)
      .filter(Boolean)
      .join('\n');
    
    await navigator.clipboard.writeText(hexCodes);
    
    toast({
      title: 'Copiado!',
      description: `${coresCapturadas.length} código(s) HEX copiado(s) para a área de transferência.`,
    });
  };

  const handleCopiarNomesNomeadas = async () => {
    const coresNomeadas = cores.filter(cor => 
      !cor.nome.toLowerCase().startsWith('cor capturada')
    );
    
    if (coresNomeadas.length === 0) {
      toast({
        title: 'Nenhuma cor encontrada',
        description: 'Não há cores nomeadas (todas ainda são "Cor capturada...").',
        variant: 'destructive',
      });
      return;
    }
    
    const nomes = coresNomeadas
      .map(cor => cor.nome)
      .filter(Boolean)
      .join('\n');
    
    await navigator.clipboard.writeText(nomes);
    
    toast({
      title: 'Copiado!',
      description: `${coresNomeadas.length} nome(s) copiado(s) para a área de transferência.`,
    });
  };

  const handleEditClick = (cor: Cor) => {
    setEditingCorId(cor.id);
  };

  const handleNavigateBack = () => {
    setEditingCorId(null);
  };

  const handleNavigateToCor = (corId: string) => {
    setEditingCorId(corId);
  };

  const handleNavigateToVinculos = () => {
    if (onNavigateToVinculos) {
      onNavigateToVinculos();
      return;
    }

    if (onNavigateHome) {
      onNavigateHome();
    }
  };

  const handleEditVinculo = (vinculo: CorTecido) => {
    setEditingVinculoId(vinculo.id);
  };

  const handleUpdateNome = async (corId: string, novoNome: string) => {
    await updateCor({ id: corId, nome: novoNome });
  };

  const handleAbrirModalMesclar = (conflito: ParConflito) => {
    setConflitoParaMesclar(conflito);
    setCorSelecionadaParaManter(null);
  };

  const handleConfirmarMesclar = async () => {
    if (!conflitoParaMesclar || !corSelecionadaParaManter) return;

    const corManter = corSelecionadaParaManter === 'cor1' 
      ? conflitoParaMesclar.cor1 
      : conflitoParaMesclar.cor2;
    const corRemover = corSelecionadaParaManter === 'cor1' 
      ? conflitoParaMesclar.cor2 
      : conflitoParaMesclar.cor1;

    setMesclando(true);
    try {
      await mesclarCores(corRemover.id, corManter.id);
      setConflitoParaMesclar(null);
      setCorSelecionadaParaManter(null);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setMesclando(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    try {
      await deleteCor(pendingDeleteId);
    } catch (error) {
      // Erro já é tratado no hook
    }
    setPendingDeleteId(null);
  };

  const handleSubmit = async (data: CreateCorData) => {
    try {
      if (editingCor) {
        const updateData: UpdateCorData = {
          id: editingCor.id,
          ...data,
        };
        await updateCor(updateData);
      } else {
        await createCor(data);
      }
      setModalOpen(false);
      setEditingCor(null);
    } catch (error) {
      throw error;
    }
  };

  // Se estiver editando um vínculo, mostrar página de edição de vínculo
  if (editingVinculoId) {
    return (
      <EditarVinculo 
        vinculoId={editingVinculoId} 
        onNavigateBack={() => setEditingVinculoId(null)}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  // Se estiver editando uma cor, mostrar página de edição
  if (editingCorId) {
    return <EditarCor corId={editingCorId} onNavigateBack={handleNavigateBack} onNavigateToCor={handleNavigateToCor} />;
  }

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
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Cores Cadastradas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {cores.length} cor{cores.length !== 1 ? 'es' : ''} cadastrada{cores.length !== 1 ? 's' : ''}
                {searchTerm.trim() ? ` (${filteredCores.length} exibida${filteredCores.length !== 1 ? 's' : ''})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Controle de Limiar Delta E */}
              <div className="flex items-center gap-2">
                <Label htmlFor="limiarDeltaE" className="text-sm text-gray-600 whitespace-nowrap">
                  Limiar ΔE:
                </Label>
                <Input
                  id="limiarDeltaE"
                  type="number"
                  value={deltaELimiar}
                  onChange={(e) => setDeltaELimiar(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 3)))}
                  className="w-20 h-9"
                  min={0.1}
                  max={10}
                  step={0.5}
                  disabled={loadingConfig}
                />
                {savingConfig && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={handleCopiarHexCapturadas}
                title="Copiar HEX das cores capturadas (não nomeadas)"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar HEX
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCopiarNomesNomeadas}
                title="Copiar nomes das cores já nomeadas"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Nomes
              </Button>
              <Button onClick={handleAddClick} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Cor
              </Button>
            </div>
          </div>

          {/* Busca */}
          {cores.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, SKU ou HEX..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Alerta de conflitos */}
          {conflitos.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 mb-2">
                    {conflitos.length} {conflitos.length === 1 ? 'conflito' : 'conflitos'} de cores detectado{conflitos.length > 1 ? 's' : ''} (ΔE &lt; {deltaELimiar})
                  </h4>
                  <p className="text-xs text-amber-700 mb-3">
                    Clique em "Mesclar" para unificar cores duplicadas. Os vínculos serão movidos para a cor com mais vínculos.
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {conflitos.map((conflito, index) => {
                      const vinculos1 = contarVinculosPorCor(conflito.cor1.id);
                      const vinculos2 = contarVinculosPorCor(conflito.cor2.id);
                      return (
                        <div key={index} className="text-sm text-amber-800 flex items-center gap-2 flex-wrap bg-white/50 rounded-lg p-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className="w-5 h-5 rounded border-2 border-amber-300 flex-shrink-0"
                              style={{ backgroundColor: conflito.cor1.hex || '#ccc' }}
                            />
                            <div className="min-w-0">
                              <span className="font-medium truncate block">{conflito.cor1.nome}</span>
                              <span className="text-xs text-amber-600">{vinculos1} vínculo(s)</span>
                            </div>
                          </div>
                          <span className="text-amber-500 text-lg">↔</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className="w-5 h-5 rounded border-2 border-amber-300 flex-shrink-0"
                              style={{ backgroundColor: conflito.cor2.hex || '#ccc' }}
                            />
                            <div className="min-w-0">
                              <span className="font-medium truncate block">{conflito.cor2.nome}</span>
                              <span className="text-xs text-amber-600">{vinculos2} vínculo(s)</span>
                            </div>
                          </div>
                          <span className="text-amber-600 text-xs px-1.5 py-0.5 bg-amber-100 rounded">
                            ΔE = {conflito.deltaE.toFixed(2)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto h-7 text-xs bg-white hover:bg-amber-100 border-amber-300"
                            onClick={() => handleAbrirModalMesclar(conflito)}
                          >
                            <Merge className="h-3 w-3 mr-1" />
                            Mesclar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && cores.length === 0 ? (
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
              cores={filteredCores}
              vinculos={vinculos}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onUpdateNome={handleUpdateNome}
              onNavigateVinculos={handleNavigateToVinculos}
              onEditVinculo={handleEditVinculo}
              loading={loading || loadingVinculos}
              mapaConflitos={mapaConflitos}
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir cor"
        description="Tem certeza que deseja excluir esta cor? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Modal de Mesclar Cores */}
      <Dialog 
        open={conflitoParaMesclar !== null} 
        onOpenChange={(open) => !open && setConflitoParaMesclar(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mesclar Cores</DialogTitle>
            <DialogDescription>
              Escolha qual cor deseja manter. Os vínculos da outra cor serão movidos para a cor escolhida.
            </DialogDescription>
          </DialogHeader>

          {conflitoParaMesclar && (
            <div className="space-y-4 py-4">
              {/* Opção Cor 1 */}
              <button
                onClick={() => setCorSelecionadaParaManter('cor1')}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4",
                  corSelecionadaParaManter === 'cor1'
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: conflitoParaMesclar.cor1.hex || '#ccc' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{conflitoParaMesclar.cor1.nome}</span>
                    {corSelecionadaParaManter === 'cor1' && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {conflitoParaMesclar.cor1.hex}
                  </p>
                  <p className="text-xs text-gray-400">
                    {contarVinculosPorCor(conflitoParaMesclar.cor1.id)} vínculo(s) com tecidos
                  </p>
                </div>
              </button>

              {/* Opção Cor 2 */}
              <button
                onClick={() => setCorSelecionadaParaManter('cor2')}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4",
                  corSelecionadaParaManter === 'cor2'
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: conflitoParaMesclar.cor2.hex || '#ccc' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{conflitoParaMesclar.cor2.nome}</span>
                    {corSelecionadaParaManter === 'cor2' && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {conflitoParaMesclar.cor2.hex}
                  </p>
                  <p className="text-xs text-gray-400">
                    {contarVinculosPorCor(conflitoParaMesclar.cor2.id)} vínculo(s) com tecidos
                  </p>
                </div>
              </button>

              {/* Resumo da ação */}
              {corSelecionadaParaManter && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p>
                    <strong>
                      "{corSelecionadaParaManter === 'cor1' 
                        ? conflitoParaMesclar.cor1.nome 
                        : conflitoParaMesclar.cor2.nome}"
                    </strong>
                    {' '}será mantida.
                  </p>
                  <p className="mt-1">
                    <strong>
                      "{corSelecionadaParaManter === 'cor1' 
                        ? conflitoParaMesclar.cor2.nome 
                        : conflitoParaMesclar.cor1.nome}"
                    </strong>
                    {' '}será excluída e seus vínculos serão movidos.
                  </p>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConflitoParaMesclar(null)}
                  disabled={mesclando}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmarMesclar}
                  disabled={!corSelecionadaParaManter || mesclando}
                >
                  {mesclando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Mesclando...
                    </>
                  ) : (
                    <>
                      <Merge className="h-4 w-4 mr-2" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
