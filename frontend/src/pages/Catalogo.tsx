import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useTecidos } from '@/hooks/useTecidos';
import { useEstampas } from '@/hooks/useEstampas';
import { useCatalogos } from '@/hooks/useCatalogos';
import { Tecido } from '@/types/tecido.types';
import { Estampa } from '@/types/estampa.types';
import { CatalogoPreview } from '@/components/Catalogo/CatalogoPreview';
import { CatalogoPdfDocument } from '@/components/Catalogo/CatalogoPdfDocument';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileDown, Link2, Copy, Check, Palette, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { agruparVinculosPorTecido } from '@/lib/firebase/catalogos';

interface CatalogoProps {
  onNavigateHome?: () => void;
}

// Tipo para agrupar estampas por tecido base (exportado para uso em componentes)
export interface TecidoComEstampas {
  tecido: Tecido;
  estampas: Estampa[];
}

interface CatalogoListItem {
  tecido: Tecido;
  totalCores: number;
  totalEstampas: number;
}

export function Catalogo({ onNavigateHome }: CatalogoProps) {
  const { vinculos, loading: loadingVinculos } = useCorTecido();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { estampas, loading: loadingEstampas } = useEstampas();
  const { createCatalogoLink, generating } = useCatalogos();
  const { toast } = useToast();

  const [selectedTecidoIds, setSelectedTecidoIds] = useState<Set<string>>(new Set());
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

  const catalogoListItems = useMemo<CatalogoListItem[]>(() => {
    const grouped = new Map<string, CatalogoListItem>();

    tecidosComVinculos.forEach(({ tecido, vinculos }) => {
      grouped.set(tecido.id, {
        tecido,
        totalCores: vinculos.length,
        totalEstampas: 0,
      });
    });

    tecidosComEstampas.forEach(({ tecido, estampas }) => {
      const existing = grouped.get(tecido.id);
      if (existing) {
        existing.totalEstampas = estampas.length;
      } else {
        grouped.set(tecido.id, {
          tecido,
          totalCores: 0,
          totalEstampas: estampas.length,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.tecido.nome.localeCompare(b.tecido.nome));
  }, [tecidosComVinculos, tecidosComEstampas]);

  // Tecidos selecionados com seus vínculos
  const selectedTecidosComVinculos = useMemo(
    () => tecidosComVinculos.filter((t) => selectedTecidoIds.has(t.tecido.id)),
    [tecidosComVinculos, selectedTecidoIds]
  );

  // Tecidos selecionados com suas estampas
  const selectedTecidosComEstampas = useMemo(
    () => tecidosComEstampas.filter((t) => selectedTecidoIds.has(t.tecido.id)),
    [tecidosComEstampas, selectedTecidoIds]
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

  const totalCoresDisponiveis = useMemo(
    () => catalogoListItems.reduce((acc, item) => acc + item.totalCores, 0),
    [catalogoListItems]
  );

  const totalEstampasDisponiveis = useMemo(
    () => catalogoListItems.reduce((acc, item) => acc + item.totalEstampas, 0),
    [catalogoListItems]
  );

  useEffect(() => {
    const validIds = new Set(catalogoListItems.map((item) => item.tecido.id));
    setSelectedTecidoIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [catalogoListItems]);

  // Toggle seleção de um tecido
  const handleToggleTecido = useCallback((id: string) => {
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

  // Selecionar todos da lista
  const handleSelectAll = useCallback(() => {
    setSelectedTecidoIds(new Set(catalogoListItems.map((item) => item.tecido.id)));
  }, [catalogoListItems]);

  // Desmarcar todos da lista
  const handleDeselectAll = useCallback(() => {
    setSelectedTecidoIds(new Set());
  }, []);

  const selectedCatalogoItemsCount = useMemo(
    () => catalogoListItems.filter((item) => selectedTecidoIds.has(item.tecido.id)).length,
    [catalogoListItems, selectedTecidoIds]
  );

  const allSelected = catalogoListItems.length > 0 && selectedCatalogoItemsCount === catalogoListItems.length;
  const someSelected = selectedCatalogoItemsCount > 0 && !allSelected;
  const hasSelection = selectedCatalogoItemsCount > 0;

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
    if (!url) return;

    setGeneratedLink(url);

    const shareData = {
      title: 'Catalogo Razai',
      text: 'Confira este catalogo',
      url,
    };

    const canUseNativeShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ url }));

    if (canUseNativeShare) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link criado!',
        description: 'Link copiado para a area de transferencia.',
      });
    } catch {
      toast({
        title: 'Link criado!',
        description: 'Copie o link no campo abaixo.',
      });
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
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Tecidos (liso + estampado) ({catalogoListItems.length})
                </h3>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border mb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                      onCheckedChange={() => {
                        if (allSelected || someSelected) {
                          handleDeselectAll();
                        } else {
                          handleSelectAll();
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {allSelected
                        ? 'Todos selecionados'
                        : someSelected
                        ? `${selectedCatalogoItemsCount} de ${catalogoListItems.length} tecidos`
                        : 'Selecionar todos'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 text-right">
                    <div>{totalCoresDisponiveis} cores</div>
                    <div>{totalEstampasDisponiveis} estampas</div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {catalogoListItems.map((item) => {
                    const isSelected = selectedTecidoIds.has(item.tecido.id);

                    return (
                      <div
                        key={item.tecido.id}
                        className={cn(
                          'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all',
                          isSelected
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-white hover:bg-gray-50 border-gray-200'
                        )}
                        onClick={() => handleToggleTecido(item.tecido.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleTecido(item.tecido.id)}
                          onClick={(event) => event.stopPropagation()}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 truncate">{item.tecido.nome}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                              {item.tecido.sku}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Palette className="h-3 w-3" />
                              {item.totalCores} {item.totalCores === 1 ? 'cor' : 'cores'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {item.totalEstampas} {item.totalEstampas === 1 ? 'estampa' : 'estampas'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
