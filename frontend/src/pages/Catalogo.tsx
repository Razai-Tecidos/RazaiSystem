import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useTecidos } from '@/hooks/useTecidos';
import { useEstampas } from '@/hooks/useEstampas';
import { useCatalogos } from '@/hooks/useCatalogos';
import { Tecido } from '@/types/tecido.types';
import { Estampa } from '@/types/estampa.types';
import { TecidoCheckboxList } from '@/components/Catalogo/TecidoCheckboxList';
import { EstampaCheckboxList } from '@/components/Catalogo/EstampaCheckboxList';
import { CatalogoPreview } from '@/components/Catalogo/CatalogoPreview';
import { CatalogoPdfDocument } from '@/components/Catalogo/CatalogoPdfDocument';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown, Link2, Copy, Check, Palette, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { agruparVinculosPorTecido, TecidoComVinculos } from '@/lib/firebase/catalogos';

interface CatalogoProps {
  onNavigateHome?: () => void;
}

// Tipo para agrupar estampas por tecido base
export interface TecidoComEstampas {
  tecido: Tecido;
  estampas: Estampa[];
}

type TabType = 'cores' | 'estampas';

export function Catalogo({ onNavigateHome }: CatalogoProps) {
  const { vinculos, loading: loadingVinculos } = useCorTecido();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { estampas, loading: loadingEstampas } = useEstampas();
  const { createCatalogoLink, generating } = useCatalogos();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('cores');
  const [selectedTecidoIds, setSelectedTecidoIds] = useState<Set<string>>(new Set());
  const [selectedEstampaTecidoIds, setSelectedEstampaTecidoIds] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const loading = loadingVinculos || loadingTecidos || loadingEstampas;

  // Agrupa vínculos por tecido usando função extraída
  const tecidosComVinculos = useMemo(
    () => agruparVinculosPorTecido(vinculos, tecidos),
    [vinculos, tecidos]
  );

  // Agrupa estampas por tecido base
  const tecidosComEstampas = useMemo(() => {
    const grupos: TecidoComEstampas[] = [];
    
    // Agrupar estampas por tecidoBaseId
    const estampasPorTecido = new Map<string, Estampa[]>();
    estampas.forEach((estampa) => {
      const lista = estampasPorTecido.get(estampa.tecidoBaseId) || [];
      lista.push(estampa);
      estampasPorTecido.set(estampa.tecidoBaseId, lista);
    });

    // Criar grupos com dados do tecido
    tecidos.forEach((tecido) => {
      const estampasDoTecido = estampasPorTecido.get(tecido.id);
      if (estampasDoTecido && estampasDoTecido.length > 0) {
        grupos.push({
          tecido,
          estampas: estampasDoTecido.sort((a, b) => 
            (a.nome || '').localeCompare(b.nome || '')
          ),
        });
      }
    });

    return grupos.sort((a, b) => a.tecido.nome.localeCompare(b.tecido.nome));
  }, [estampas, tecidos]);

  // Tecidos selecionados com seus vínculos
  const selectedTecidosComVinculos = useMemo(
    () => tecidosComVinculos.filter((t) => selectedTecidoIds.has(t.tecido.id)),
    [tecidosComVinculos, selectedTecidoIds]
  );

  // Tecidos selecionados com suas estampas
  const selectedTecidosComEstampas = useMemo(
    () => tecidosComEstampas.filter((t) => selectedEstampaTecidoIds.has(t.tecido.id)),
    [tecidosComEstampas, selectedEstampaTecidoIds]
  );

  // Total de cores selecionadas
  const totalCoresSelecionadas = useMemo(
    () => selectedTecidosComVinculos.reduce((acc, t) => acc + t.vinculos.length, 0),
    [selectedTecidosComVinculos]
  );

  // Total de estampas selecionadas
  const totalEstampasSelecionadas = useMemo(
    () => selectedTecidosComEstampas.reduce((acc, t) => acc + t.estampas.length, 0),
    [selectedTecidosComEstampas]
  );

  // Toggle seleção de um tecido (cores)
  const handleToggleCor = useCallback((id: string) => {
    setSelectedTecidoIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Toggle seleção de um tecido (estampas)
  const handleToggleEstampa = useCallback((id: string) => {
    setSelectedEstampaTecidoIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Selecionar todos (cores)
  const handleSelectAllCores = useCallback(() => {
    setSelectedTecidoIds(new Set(tecidosComVinculos.map((t) => t.tecido.id)));
  }, [tecidosComVinculos]);

  // Desmarcar todos (cores)
  const handleDeselectAllCores = useCallback(() => {
    setSelectedTecidoIds(new Set());
  }, []);

  // Selecionar todos (estampas)
  const handleSelectAllEstampas = useCallback(() => {
    setSelectedEstampaTecidoIds(new Set(tecidosComEstampas.map((t) => t.tecido.id)));
  }, [tecidosComEstampas]);

  // Desmarcar todos (estampas)
  const handleDeselectAllEstampas = useCallback(() => {
    setSelectedEstampaTecidoIds(new Set());
  }, []);

  // Verificar se há algo selecionado
  const hasSelection = selectedTecidosComVinculos.length > 0 || selectedTecidosComEstampas.length > 0;

  // Cleanup do blob URL ao desmontar ou antes de criar novo
  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, []);

  // Gerar PDF
  const handleGeneratePdf = useCallback(async () => {
    if (!hasSelection) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos um tecido com cores ou estampas',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingPdf(true);

    try {
      // Revogar blob URL anterior se existir
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }

      const blob = await pdf(
        <CatalogoPdfDocument
          tecidosComVinculos={selectedTecidosComVinculos}
          tecidosComEstampas={selectedTecidosComEstampas}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      pdfBlobUrlRef.current = url;

      const link = document.createElement('a');
      link.href = url;

      const date = new Date().toISOString().split('T')[0];
      link.download = `catalogo_${date}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revogar URL após pequeno delay para garantir que o download iniciou
      setTimeout(() => {
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
          pdfBlobUrlRef.current = null;
        }
      }, 100);

      const partes = [];
      if (totalCoresSelecionadas > 0) partes.push(`${totalCoresSelecionadas} cores`);
      if (totalEstampasSelecionadas > 0) partes.push(`${totalEstampasSelecionadas} estampas`);

      toast({
        title: 'PDF gerado!',
        description: `Catálogo com ${partes.join(' e ')} baixado`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPdf(false);
    }
  }, [hasSelection, selectedTecidosComVinculos, selectedTecidosComEstampas, totalCoresSelecionadas, totalEstampasSelecionadas, toast]);

  // Criar link compartilhável
  const handleCreateLink = useCallback(async () => {
    if (selectedTecidoIds.size === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos um tecido com cores para criar o link',
        variant: 'destructive',
      });
      return;
    }

    const url = await createCatalogoLink(Array.from(selectedTecidoIds));
    if (url) {
      setGeneratedLink(url);
    }
  }, [createCatalogoLink, selectedTecidoIds, toast]);

  // Copiar link
  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'O link foi copiado para a área de transferência',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link',
        variant: 'destructive',
      });
    }
  }, [generatedLink, toast]);

  const hasContent = tecidosComVinculos.length > 0 || tecidosComEstampas.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />

      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Catálogo' },
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Gerar Catálogo
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecione cores e estampas para incluir no catálogo
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Skeleton da coluna esquerda */}
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Skeleton className="h-5 w-5" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skeleton da coluna direita */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-64 w-full" />
                <div className="flex gap-3 pt-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
            </div>
          ) : !hasContent ? (
            <div className="text-center py-12 text-gray-500">
              <p>Nenhum tecido com cores ou estampas cadastradas.</p>
              <p className="text-sm mt-1">
                Cadastre cores pela página de Vínculos ou estampas pela página de Estampas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna esquerda: Seleção */}
              <div>
                {/* Abas */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('cores')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                      activeTab === 'cores'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Palette className="h-4 w-4" />
                    Cores
                    {tecidosComVinculos.length > 0 && (
                      <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                        {tecidosComVinculos.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('estampas')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                      activeTab === 'estampas'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Estampas
                    {tecidosComEstampas.length > 0 && (
                      <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                        {tecidosComEstampas.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Conteúdo da aba */}
                {activeTab === 'cores' ? (
                  tecidosComVinculos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <Palette className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhum tecido com cores cadastradas</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Tecidos com cores ({tecidosComVinculos.length})
                      </h3>
                      <TecidoCheckboxList
                        tecidosComVinculos={tecidosComVinculos}
                        selectedIds={selectedTecidoIds}
                        onToggle={handleToggleCor}
                        onSelectAll={handleSelectAllCores}
                        onDeselectAll={handleDeselectAllCores}
                      />
                    </>
                  )
                ) : (
                  tecidosComEstampas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhum tecido com estampas cadastradas</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Tecidos com estampas ({tecidosComEstampas.length})
                      </h3>
                      <EstampaCheckboxList
                        tecidosComEstampas={tecidosComEstampas}
                        selectedIds={selectedEstampaTecidoIds}
                        onToggle={handleToggleEstampa}
                        onSelectAll={handleSelectAllEstampas}
                        onDeselectAll={handleDeselectAllEstampas}
                      />
                    </>
                  )
                )}
              </div>

              {/* Coluna direita: Preview e ações */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">
                  Preview do catálogo
                  {(totalCoresSelecionadas > 0 || totalEstampasSelecionadas > 0) && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({totalCoresSelecionadas > 0 && `${totalCoresSelecionadas} cores`}
                      {totalCoresSelecionadas > 0 && totalEstampasSelecionadas > 0 && ', '}
                      {totalEstampasSelecionadas > 0 && `${totalEstampasSelecionadas} estampas`})
                    </span>
                  )}
                </h3>
                
                <CatalogoPreview 
                  tecidosComVinculos={selectedTecidosComVinculos}
                  tecidosComEstampas={selectedTecidosComEstampas}
                />

                {/* Ações */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button
                    onClick={handleGeneratePdf}
                    disabled={!hasSelection || generatingPdf}
                    className="flex-1"
                  >
                    {generatingPdf ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Baixar PDF
                  </Button>

                  <Button
                    onClick={handleCreateLink}
                    disabled={selectedTecidosComVinculos.length === 0 || generating}
                    variant="outline"
                    className="flex-1"
                    title={selectedTecidosComVinculos.length === 0 ? 'Selecione cores para criar link' : ''}
                  >
                    {generating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    Criar Link
                  </Button>
                </div>

                {/* Link gerado */}
                {generatedLink && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      Link criado com sucesso! (válido por 7 dias)
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedLink}
                        readOnly
                        className="flex-1 text-sm px-3 py-2 bg-white border border-green-300 rounded-md text-gray-700"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
