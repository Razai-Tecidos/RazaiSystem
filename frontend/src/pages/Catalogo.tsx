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
import {
  agruparVinculosPorTecido,
  CatalogoTecidoSnapshot,
  getCatalogoUrl,
  TecidoComVinculos,
} from '@/lib/firebase/catalogos';

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

const CATALOGO_PDF_MAX_DIMENSION = 640;
const CATALOGO_PDF_JPEG_QUALITY = 0.9;
const CATALOGO_PDF_COMPRESS_CONCURRENCY = 4;

function normalizeFileNameToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function loadImageForPdf(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

function compressImageForCatalogPdf(
  image: HTMLImageElement,
  maxDimension: number = CATALOGO_PDF_MAX_DIMENSION,
  quality: number = CATALOGO_PDF_JPEG_QUALITY
): string {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const maxSourceDimension = Math.max(sourceWidth, sourceHeight, 1);
  const scale = Math.min(1, maxDimension / maxSourceDimension);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel iniciar o canvas para o PDF');
  }

  // Alta qualidade de remapeamento no downscale para preservar nitidez.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function buildCatalogCompressedImageMap(
  tecidosComVinculos: TecidoComVinculos[],
  tecidosComEstampas: TecidoComEstampas[]
): Promise<Map<string, string>> {
  const uniqueUrls = Array.from(
    new Set(
      [
        ...tecidosComVinculos.flatMap(({ vinculos }) =>
          vinculos.map((vinculo) => vinculo.imagemGerada || vinculo.imagemTingida).filter(Boolean)
        ),
        ...tecidosComEstampas.flatMap(({ estampas }) => estampas.map((estampa) => estampa.imagem).filter(Boolean)),
      ].filter((url): url is string => Boolean(url))
    )
  );

  const compressedEntries = await mapWithConcurrency(
    uniqueUrls,
    CATALOGO_PDF_COMPRESS_CONCURRENCY,
    async (url): Promise<[string, string]> => {
      if (url.startsWith('data:image/')) {
        return [url, url];
      }
      try {
        const image = await loadImageForPdf(url);
        const compressed = compressImageForCatalogPdf(image);
        return [url, compressed];
      } catch (error) {
        console.warn('[catalogo-pdf] Falha ao otimizar imagem, mantendo original:', url, error);
        return [url, url];
      }
    }
  );

  return new Map(compressedEntries);
}

function applyCatalogImageMapToVinculos(
  tecidosComVinculos: TecidoComVinculos[],
  imageMap: Map<string, string>
): TecidoComVinculos[] {
  return tecidosComVinculos.map((item) => ({
    ...item,
    vinculos: item.vinculos.map((vinculo) => ({
      ...vinculo,
      imagemGerada: vinculo.imagemGerada ? imageMap.get(vinculo.imagemGerada) || vinculo.imagemGerada : vinculo.imagemGerada,
      imagemTingida: vinculo.imagemTingida ? imageMap.get(vinculo.imagemTingida) || vinculo.imagemTingida : vinculo.imagemTingida,
    })),
  }));
}

function applyCatalogImageMapToEstampas(
  tecidosComEstampas: TecidoComEstampas[],
  imageMap: Map<string, string>
): TecidoComEstampas[] {
  return tecidosComEstampas.map((item) => ({
    ...item,
    estampas: item.estampas.map((estampa) => ({
      ...estampa,
      imagem: estampa.imagem ? imageMap.get(estampa.imagem) || estampa.imagem : estampa.imagem,
    })),
  }));
}

export function Catalogo({ onNavigateHome }: CatalogoProps) {
  const { vinculos, loading: loadingVinculos } = useCorTecido();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { estampas, loading: loadingEstampas } = useEstampas();
  const {
    createCatalogoLink,
    generating,
    historyLoading,
    catalogosHistorico,
    loadCatalogosHistorico,
  } = useCatalogos();
  const { toast } = useToast();

  const [selectedTecidoIds, setSelectedTecidoIds] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const loading = loadingVinculos || loadingTecidos || loadingEstampas;

  useEffect(() => {
    void loadCatalogosHistorico();
  }, [loadCatalogosHistorico]);

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

  const selectedCatalogoItems = useMemo(
    () => catalogoListItems.filter((item) => selectedTecidoIds.has(item.tecido.id)),
    [catalogoListItems, selectedTecidoIds]
  );

  const selectedCatalogoItemsCount = selectedCatalogoItems.length;

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

  const generatePdfForTecidoIds = useCallback(
    async (tecidoIds: string[]) => {
      const uniqueIds = Array.from(new Set(tecidoIds));
      if (uniqueIds.length === 0) {
        toast({
          title: 'Atenção',
          description: 'Selecione pelo menos um tecido com cores ou estampas',
          variant: 'destructive',
        });
        return;
      }

      const selectedIdSet = new Set(uniqueIds);
      const tecidosVinculosSelecionados = tecidosComVinculos.filter((item) => selectedIdSet.has(item.tecido.id));
      const tecidosEstampasSelecionados = tecidosComEstampas.filter((item) => selectedIdSet.has(item.tecido.id));

      const totalCores = tecidosVinculosSelecionados.reduce((acc, item) => acc + item.vinculos.length, 0);
      const totalEstampas = tecidosEstampasSelecionados.reduce((acc, item) => acc + item.estampas.length, 0);
      if (totalCores === 0 && totalEstampas === 0) {
        toast({
          title: 'Atenção',
          description: 'Os tecidos selecionados não possuem itens para PDF',
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

        const imageMap = await buildCatalogCompressedImageMap(
          tecidosVinculosSelecionados,
          tecidosEstampasSelecionados
        );

        const tecidosComVinculosOtimizado = applyCatalogImageMapToVinculos(
          tecidosVinculosSelecionados,
          imageMap
        );
        const tecidosComEstampasOtimizado = applyCatalogImageMapToEstampas(
          tecidosEstampasSelecionados,
          imageMap
        );

        const blob = await pdf(
          <CatalogoPdfDocument
            tecidosComVinculos={tecidosComVinculosOtimizado}
            tecidosComEstampas={tecidosComEstampasOtimizado}
          />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;

        const link = document.createElement('a');
        link.href = url;

        const date = new Date().toISOString().split('T')[0];
        if (uniqueIds.length === 1) {
          const tecidoNome = catalogoListItems.find((item) => item.tecido.id === uniqueIds[0])?.tecido.nome || 'Tecido';
          link.download = `Cat\u00E1logo_Razai_${normalizeFileNameToken(tecidoNome)}_${date}.pdf`;
        } else {
          link.download = `Catalogo_Razai_Multi_${date}.pdf`;
        }

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
        if (totalCores > 0) partes.push(`${totalCores} cores`);
        if (totalEstampas > 0) partes.push(`${totalEstampas} estampas`);

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
    },
    [catalogoListItems, tecidosComEstampas, tecidosComVinculos, toast]
  );

  // Gerar PDF com a seleção atual
  const handleGeneratePdf = useCallback(async () => {
    await generatePdfForTecidoIds(Array.from(selectedTecidoIds));
  }, [generatePdfForTecidoIds, selectedTecidoIds]);

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

    const tecidosSnapshot: CatalogoTecidoSnapshot[] = selectedCatalogoItems.map((item) => ({
      tecidoId: item.tecido.id,
      tecidoNome: item.tecido.nome,
      tecidoSku: item.tecido.sku,
      totalCores: item.totalCores,
      totalEstampas: item.totalEstampas,
    }));

    const url = await createCatalogoLink(Array.from(selectedTecidoIds), {
      tecidosSnapshot,
      totalCoresSnapshot: tecidosSnapshot.reduce((acc, item) => acc + item.totalCores, 0),
      totalEstampasSnapshot: tecidosSnapshot.reduce((acc, item) => acc + item.totalEstampas, 0),
    });
    if (!url) return;

    setGeneratedLink(url);
    void loadCatalogosHistorico();

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
  }, [createCatalogoLink, loadCatalogosHistorico, selectedCatalogoItems, selectedTecidoIds, toast]);

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

  const historicoCatalogosView = useMemo(() => {
    return catalogosHistorico.map((catalogo) => {
      const snapshot = catalogo.tecidosSnapshot || [];
      const tecidoNomes =
        snapshot.length > 0
          ? snapshot.map((item) => item.tecidoNome)
          : catalogo.tecidoIds
              .map((tecidoId) => catalogoListItems.find((item) => item.tecido.id === tecidoId)?.tecido.nome)
              .filter((value): value is string => Boolean(value));

      const totalCores =
        typeof catalogo.totalCoresSnapshot === 'number'
          ? catalogo.totalCoresSnapshot
          : snapshot.reduce((acc, item) => acc + item.totalCores, 0);

      const totalEstampas =
        typeof catalogo.totalEstampasSnapshot === 'number'
          ? catalogo.totalEstampasSnapshot
          : snapshot.reduce((acc, item) => acc + item.totalEstampas, 0);

      const createdAt = catalogo.createdAt?.toDate?.();
      const expiresAt = catalogo.expiresAt?.toDate?.();
      const isExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

      return {
        id: catalogo.id,
        tecidoIds: catalogo.tecidoIds,
        tecidoNomes,
        totalCores,
        totalEstampas,
        createdAtLabel: createdAt
          ? createdAt.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Data indisponivel',
        isExpired,
        url: getCatalogoUrl(catalogo.id),
      };
    });
  }, [catalogoListItems, catalogosHistorico]);

  const handleUseHistoricoSelection = useCallback((tecidoIds: string[]) => {
    setSelectedTecidoIds(new Set(tecidoIds));
    toast({
      title: 'Selecao carregada',
      description: 'Os tecidos do catalogo foram aplicados na selecao atual.',
    });
  }, [toast]);

  const handleCopyHistoricoLink = useCallback(
    async (url: string, isExpired: boolean) => {
      if (isExpired) {
        toast({
          title: 'Link expirado',
          description: 'Esse catalogo expirou. Gere um novo link para compartilhar.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: 'Link copiado!',
          description: 'O link do historico foi copiado.',
        });
      } catch {
        toast({
          title: 'Erro',
          description: 'Nao foi possivel copiar o link do historico.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const handleDownloadHistoricoPdf = useCallback(
    async (tecidoIds: string[]) => {
      await generatePdfForTecidoIds(tecidoIds);
    },
    [generatePdfForTecidoIds]
  );

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

                {/* Historico de catalogos */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">Historico de catalogos</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void loadCatalogosHistorico()}
                      disabled={historyLoading}
                    >
                      {historyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Atualizar
                    </Button>
                  </div>

                  {historyLoading && historicoCatalogosView.length === 0 ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : historicoCatalogosView.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 border rounded-lg p-3">
                      Nenhum catalogo criado ainda.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {historicoCatalogosView.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {item.tecidoNomes.length > 0
                                  ? item.tecidoNomes.join(', ')
                                  : `${item.tecidoIds.length} tecido(s)`}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.createdAtLabel}
                                {item.isExpired ? ' . expirado' : ' . ativo'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.totalCores} cores . {item.totalEstampas} estampas
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUseHistoricoSelection(item.tecidoIds)}
                                title="Reusar selecao"
                              >
                                Usar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDownloadHistoricoPdf(item.tecidoIds)}
                                title="Baixar PDF desse catalogo"
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleCopyHistoricoLink(item.url, item.isExpired)}
                                title={item.isExpired ? 'Link expirado' : 'Copiar link'}
                                disabled={item.isExpired}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

