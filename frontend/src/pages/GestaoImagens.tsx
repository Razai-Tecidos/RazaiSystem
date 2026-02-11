import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { auth } from '@/config/firebase';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { EmptyState } from '@/components/Layout/EmptyState';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useTecidos } from '@/hooks/useTecidos';
import { useToast } from '@/hooks/use-toast';
import { generateBrandOverlay } from '@/lib/brandOverlay';
import { buildMosaicOutputs, buildPremiumVinculoOutputs } from '@/lib/mosaicBuilder';
import {
  uploadImagemGerada,
  uploadImagemPremium,
  uploadImagemModelo,
} from '@/lib/firebase/cor-tecido';
import {
  createGestaoImagemMosaico,
  getLatestMosaicoByTecido,
  listMosaicosByTecido,
  uploadMosaicoImage,
} from '@/lib/firebase/gestao-imagens';
import { CorTecido } from '@/types/cor.types';
import { GestaoImagemMosaico, MosaicTemplateId } from '@/types/gestao-imagens.types';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';

interface GestaoImagensProps {
  onNavigateHome?: () => void;
}

type MosaicPreview = {
  squareUrl: string;
  portraitUrl: string;
};

type GroupedVinculos = {
  tecidoId: string;
  tecidoNome: string;
  vinculos: CorTecido[];
};

function buildGenerationFingerprint(vinculo: CorTecido): string {
  return `${vinculo.imagemTingida || ''}::${vinculo.corNome || ''}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

const MOSAIC_TEMPLATE_OPTIONS: Array<{ id: MosaicTemplateId; label: string; description: string }> = [
  { id: 'grid-2x2', label: 'Grid 2x2', description: 'Quatro blocos equilibrados para capas limpas.' },
  { id: 'hero-vertical', label: 'Hero Vertical', description: 'Imagem principal com dois apoios laterais.' },
  { id: 'triptych', label: 'Triptych', description: 'Tr\u00EAs colunas para destacar varia\u00E7\u00F5es.' },
];

export function GestaoImagens({ onNavigateHome }: GestaoImagensProps) {
  const { vinculos, loading, updateVinculo } = useCorTecido();
  const { tecidos } = useTecidos();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTecidoId, setSelectedTecidoId] = useState<string>('all');
  const [selectedForMosaic, setSelectedForMosaic] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState<MosaicTemplateId>('grid-2x2');
  const [mosaicPreview, setMosaicPreview] = useState<MosaicPreview | null>(null);
  const [mosaicos, setMosaicos] = useState<GestaoImagemMosaico[]>([]);
  const [loadingMosaicos, setLoadingMosaicos] = useState(false);
  const [generatingMosaic, setGeneratingMosaic] = useState(false);
  const [processingModelUploadId, setProcessingModelUploadId] = useState<string | null>(null);
  const [generatingPremiumIds, setGeneratingPremiumIds] = useState<Set<string>>(new Set());
  const [generatingPremiumTecidoIds, setGeneratingPremiumTecidoIds] = useState<Set<string>>(new Set());
  const [premiumProgressByTecido, setPremiumProgressByTecido] = useState<Record<string, { done: number; total: number }>>(
    {}
  );
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [regeneratingTecidoIds, setRegeneratingTecidoIds] = useState<Set<string>>(new Set());
  const [regenerationProgressByTecido, setRegenerationProgressByTecido] = useState<
    Record<string, { done: number; total: number }>
  >({});
  const [expandedTecidoIds, setExpandedTecidoIds] = useState<Set<string>>(new Set());
  const [openingLatestMosaicoTecidoIds, setOpeningLatestMosaicoTecidoIds] = useState<Set<string>>(new Set());

  const generatingIdsRef = useRef<Set<string>>(new Set());

  const searchTermNormalized = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const tecidosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    tecidos.forEach((tecido) => {
      map.set(tecido.id, tecido.nome);
    });
    vinculos.forEach((v) => {
      if (!map.has(v.tecidoId)) {
        map.set(v.tecidoId, v.tecidoNome);
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tecidos, vinculos]);

  const filteredVinculos = useMemo(() => {
    return vinculos.filter((v) => {
      if (selectedTecidoId !== 'all' && v.tecidoId !== selectedTecidoId) {
        return false;
      }
      if (!searchTermNormalized) return true;

      return (
        v.corNome.toLowerCase().includes(searchTermNormalized) ||
        v.tecidoNome.toLowerCase().includes(searchTermNormalized) ||
        (v.sku || '').toLowerCase().includes(searchTermNormalized)
      );
    });
  }, [vinculos, selectedTecidoId, searchTermNormalized]);

  const tecidoIdsWithMatchingVinculos = useMemo(
    () => new Set(filteredVinculos.map((vinculo) => vinculo.tecidoId)),
    [filteredVinculos]
  );

  const groupedVinculos = useMemo<GroupedVinculos[]>(() => {
    const groupedMap = new Map<string, GroupedVinculos>();

    tecidosDisponiveis.forEach((tecido) => {
      if (selectedTecidoId !== 'all' && tecido.id !== selectedTecidoId) {
        return;
      }

      if (searchTermNormalized) {
        const tecidoMatchesSearch = tecido.nome.toLowerCase().includes(searchTermNormalized);
        const hasMatchingVinculo = tecidoIdsWithMatchingVinculos.has(tecido.id);
        if (!tecidoMatchesSearch && !hasMatchingVinculo) {
          return;
        }
      }

      groupedMap.set(tecido.id, {
        tecidoId: tecido.id,
        tecidoNome: tecido.nome,
        vinculos: [],
      });
    });

    filteredVinculos.forEach((vinculo) => {
      const existing = groupedMap.get(vinculo.tecidoId);
      if (existing) {
        existing.vinculos.push(vinculo);
        return;
      }

      groupedMap.set(vinculo.tecidoId, {
        tecidoId: vinculo.tecidoId,
        tecidoNome: vinculo.tecidoNome,
        vinculos: [vinculo],
      });
    });

    return Array.from(groupedMap.values()).sort((a, b) => a.tecidoNome.localeCompare(b.tecidoNome));
  }, [filteredVinculos, searchTermNormalized, selectedTecidoId, tecidoIdsWithMatchingVinculos, tecidosDisponiveis]);

  const loadMosaicos = useCallback(async (tecidoId: string) => {
    try {
      setLoadingMosaicos(true);
      const data = await listMosaicosByTecido(tecidoId);
      setMosaicos(data);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao ler mosaicos.';
      toast({
        title: 'Erro',
        description: `Nao foi possivel carregar os mosaicos salvos. ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingMosaicos(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedTecidoId !== 'all') {
      loadMosaicos(selectedTecidoId);
      return;
    }
    setMosaicos([]);
  }, [selectedTecidoId, loadMosaicos]);

  useEffect(() => {
    setSelectedForMosaic((previous) => {
      const next = new Set<string>();
      const visibleIds = new Set(filteredVinculos.map((v) => v.id));
      previous.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [filteredVinculos]);

  const setGenerationStatus = useCallback((vinculoId: string, active: boolean) => {
    setGeneratingIds((previous) => {
      const next = new Set(previous);
      if (active) next.add(vinculoId);
      else next.delete(vinculoId);
      return next;
    });
  }, []);

  const generateForVinculo = useCallback(async (vinculo: CorTecido) => {
    if (!vinculo.imagemTingida) return;
    if (generatingIdsRef.current.has(vinculo.id)) return;

    generatingIdsRef.current.add(vinculo.id);
    setGenerationStatus(vinculo.id, true);

    try {
      const fingerprint = buildGenerationFingerprint(vinculo);
      const overlayDataUrl = await generateBrandOverlay(vinculo.imagemTingida, vinculo.corNome);
      const overlayBlob = await dataUrlToBlob(overlayDataUrl);
      const generatedUrl = await uploadImagemGerada(vinculo.id, overlayBlob);

      await updateVinculo({
        id: vinculo.id,
        imagemGerada: generatedUrl,
        imagemGeradaFingerprint: fingerprint,
        imagemGeradaAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('[GestaoImagens] Erro ao gerar imagem:', error);
      toast({
        title: 'Erro ao gerar imagem',
        description: `Falha ao gerar imagem de ${vinculo.corNome}.`,
        variant: 'destructive',
      });
    } finally {
      generatingIdsRef.current.delete(vinculo.id);
      setGenerationStatus(vinculo.id, false);
    }
  }, [setGenerationStatus, toast, updateVinculo]);

  useEffect(() => {
    const pending = vinculos.filter((v) => {
      if (!v.imagemTingida) return false;
      const currentFingerprint = buildGenerationFingerprint(v);
      return !v.imagemGerada || v.imagemGeradaFingerprint !== currentFingerprint;
    });

    if (pending.length === 0) return;
    let cancelled = false;

    const run = async () => {
      for (let index = 0; index < pending.length; index += 2) {
        if (cancelled) return;
        const chunk = pending.slice(index, index + 2);
        await Promise.all(chunk.map((vinculo) => generateForVinculo(vinculo)));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [vinculos, generateForVinculo]);

  const handleRegenerateByTecido = useCallback(async (tecidoId: string) => {
    if (regeneratingTecidoIds.has(tecidoId)) return;

    const eligible = filteredVinculos.filter((vinculo) => vinculo.tecidoId === tecidoId && vinculo.imagemTingida);
    if (eligible.length === 0) {
      toast({
        title: 'Nada para regenerar',
        description: 'Esse tecido nao possui vinculos com imagem base.',
      });
      return;
    }

    setRegeneratingTecidoIds((previous) => {
      const next = new Set(previous);
      next.add(tecidoId);
      return next;
    });
    setRegenerationProgressByTecido((previous) => ({
      ...previous,
      [tecidoId]: { done: 0, total: eligible.length },
    }));

    try {
      for (let index = 0; index < eligible.length; index += 2) {
        const chunk = eligible.slice(index, index + 2);
        await Promise.all(
          chunk.map(async (vinculo) => {
            await generateForVinculo(vinculo);
            setRegenerationProgressByTecido((previous) => {
              const current = previous[tecidoId];
              if (!current) return previous;
              return {
                ...previous,
                [tecidoId]: {
                  ...current,
                  done: Math.min(current.done + 1, current.total),
                },
              };
            });
          })
        );
      }

      toast({
        title: 'Regeneracao concluida',
        description: `${eligible.length} vinculo(s) processado(s) para este tecido.`,
      });
    } finally {
      setRegeneratingTecidoIds((previous) => {
        const next = new Set(previous);
        next.delete(tecidoId);
        return next;
      });
      setRegenerationProgressByTecido((previous) => {
        const next = { ...previous };
        delete next[tecidoId];
        return next;
      });
    }
  }, [filteredVinculos, generateForVinculo, regeneratingTecidoIds, toast]);

  const handleToggleSelectForMosaic = (vinculoId: string) => {
    setSelectedForMosaic((previous) => {
      const next = new Set(previous);
      if (next.has(vinculoId)) next.delete(vinculoId);
      else next.add(vinculoId);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedForMosaic((previous) => {
      const next = new Set(previous);
      filteredVinculos.forEach((v) => {
        if (v.imagemTingida) next.add(v.id);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedForMosaic(new Set());
  };

  const selectedMosaicVinculos = useMemo(
    () => vinculos.filter((v) => selectedForMosaic.has(v.id) && v.imagemTingida),
    [selectedForMosaic, vinculos]
  );

  const handleGenerateMosaic = async () => {
    if (selectedMosaicVinculos.length === 0) {
      toast({
        title: 'Selecao vazia',
        description: 'Selecione ao menos um vinculo com imagem original.',
        variant: 'destructive',
      });
      return;
    }

    const tecidoId = selectedMosaicVinculos[0].tecidoId;
    const tecidoNome = selectedMosaicVinculos[0].tecidoNome;
    const hasMixedTecido = selectedMosaicVinculos.some((v) => v.tecidoId !== tecidoId);
    if (hasMixedTecido) {
      toast({
        title: 'Selecao invalida',
        description: 'Selecione imagens de um unico tecido para gerar a capa.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGeneratingMosaic(true);
      const outputs = await buildMosaicOutputs({
        images: selectedMosaicVinculos.map((v) => v.imagemTingida!).filter(Boolean),
        tecidoNome,
        templateId,
      });

      if (mosaicPreview) {
        URL.revokeObjectURL(mosaicPreview.squareUrl);
        URL.revokeObjectURL(mosaicPreview.portraitUrl);
      }

      setMosaicPreview({
        squareUrl: outputs.squarePreviewUrl,
        portraitUrl: outputs.portraitPreviewUrl,
      });

      const mosaicId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(Math.random() * 100000)}`;

      const [squareUrl, portraitUrl] = await Promise.all([
        uploadMosaicoImage(tecidoId, mosaicId, outputs.squareBlob, 'square_1024.jpg'),
        uploadMosaicoImage(tecidoId, mosaicId, outputs.portraitBlob, 'portrait_1062x1416.jpg'),
      ]);

      await createGestaoImagemMosaico({
        tecidoId,
        tecidoNomeSnapshot: tecidoNome,
        templateId,
        sourcePolicy: 'original',
        selectedVinculoIds: selectedMosaicVinculos.map((v) => v.id),
        selectedImageUrls: selectedMosaicVinculos.map((v) => v.imagemTingida!).filter(Boolean),
        outputSquareUrl: squareUrl,
        outputPortraitUrl: portraitUrl,
        isDefaultForTecido: true,
        createdBy: auth.currentUser?.uid || 'unknown',
      });

      if (selectedTecidoId === tecidoId) {
        await loadMosaicos(tecidoId);
      }

      toast({
        title: 'Mosaico gerado',
        description: 'A capa foi criada e salva no Firebase como padrao deste tecido.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao gerar mosaico',
        description: 'Nao foi possivel gerar o mosaico com as imagens selecionadas.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingMosaic(false);
    }
  };

  const generatePremiumForVinculo = async (
    vinculo: CorTecido,
    options?: { showValidationToast?: boolean; showResultToast?: boolean }
  ): Promise<boolean> => {
    const showValidationToast = options?.showValidationToast ?? true;
    const showResultToast = options?.showResultToast ?? true;

    if (!vinculo.imagemTingida) {
      if (showValidationToast) {
        toast({
          title: 'Imagem base ausente',
          description: 'Esse vinculo nao possui imagem base para gerar o layout premium.',
          variant: 'destructive',
        });
      }
      return false;
    }

    if (!vinculo.imagemModelo) {
      if (showValidationToast) {
        toast({
          title: 'Foto de modelo obrigatoria',
          description: 'Envie uma foto de modelo para este vinculo antes de gerar o premium.',
          variant: 'destructive',
        });
      }
      return false;
    }

    if (generatingPremiumIds.has(vinculo.id)) return false;

    try {
      setGeneratingPremiumIds((previous) => {
        const next = new Set(previous);
        next.add(vinculo.id);
        return next;
      });

      const tecido = tecidos.find((item) => item.id === vinculo.tecidoId);
      const outputs = await buildPremiumVinculoOutputs({
        fabricImageUrl: vinculo.imagemTingida,
        modelImageUrl: vinculo.imagemModelo,
        tecidoNome: vinculo.tecidoNome,
        corNome: vinculo.corNome,
        tecidoLargura: tecido?.largura ?? null,
        tecidoComposicao: tecido?.composicao ?? null,
      });

      const [premiumSquareUrl, premiumPortraitUrl] = await Promise.all([
        uploadImagemPremium(vinculo.id, outputs.squareBlob, 'square'),
        uploadImagemPremium(vinculo.id, outputs.portraitBlob, 'portrait'),
      ]);

      await updateVinculo({
        id: vinculo.id,
        imagemPremiumSquare: premiumSquareUrl,
        imagemPremiumPortrait: premiumPortraitUrl,
        imagemPremiumAt: Timestamp.now(),
      });

      if (showResultToast) {
        toast({
          title: 'Premium gerado',
          description: `Layout premium salvo para ${vinculo.corNome}.`,
        });
      }
      return true;
    } catch (error) {
      console.error(error);
      if (showResultToast) {
        toast({
          title: 'Erro no premium',
          description: `Nao foi possivel gerar o premium de ${vinculo.corNome}.`,
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setGeneratingPremiumIds((previous) => {
        const next = new Set(previous);
        next.delete(vinculo.id);
        return next;
      });
    }
  };

  const handleGeneratePremiumByTecido = async (tecidoId: string) => {
    if (generatingPremiumTecidoIds.has(tecidoId)) return;

    const group = groupedVinculos.find((item) => item.tecidoId === tecidoId);
    if (!group) return;

    const eligibleVinculos = group.vinculos.filter((vinculo) => vinculo.imagemTingida && vinculo.imagemModelo);

    if (eligibleVinculos.length === 0) {
      toast({
        title: 'Sem itens elegiveis',
        description: 'Este tecido precisa de imagem base e foto de modelo para gerar premium.',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingPremiumTecidoIds((previous) => new Set(previous).add(tecidoId));
    setPremiumProgressByTecido((previous) => ({
      ...previous,
      [tecidoId]: { done: 0, total: eligibleVinculos.length },
    }));

    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < eligibleVinculos.length; index += 1) {
      const vinculo = eligibleVinculos[index];
      const success = await generatePremiumForVinculo(vinculo, {
        showValidationToast: false,
        showResultToast: false,
      });

      if (success) successCount += 1;
      else failedCount += 1;

      const done = index + 1;
      setPremiumProgressByTecido((previous) => ({
        ...previous,
        [tecidoId]: { done, total: eligibleVinculos.length },
      }));
    }

    setGeneratingPremiumTecidoIds((previous) => {
      const next = new Set(previous);
      next.delete(tecidoId);
      return next;
    });

    setPremiumProgressByTecido((previous) => {
      const next = { ...previous };
      delete next[tecidoId];
      return next;
    });

    if (failedCount === 0) {
      toast({
        title: 'Premium em lote concluido',
        description: `${successCount} layout(s) premium gerado(s) para ${group.tecidoNome}.`,
      });
    } else {
      toast({
        title: 'Premium em lote finalizado com falhas',
        description: `${successCount} gerado(s), ${failedCount} com erro em ${group.tecidoNome}.`,
        variant: 'destructive',
      });
    }
  };

  const handleModeloUpload = async (vinculo: CorTecido, file: File) => {
    try {
      setProcessingModelUploadId(vinculo.id);
      const modeloUrl = await uploadImagemModelo(vinculo.id, file);

      await updateVinculo({
        id: vinculo.id,
        imagemModelo: modeloUrl,
        imagemModeloAt: Timestamp.now(),
      });

      toast({
        title: 'Upload concluido',
        description: `Imagem de modelo salva para ${vinculo.corNome}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro no upload',
        description: 'Nao foi possivel enviar a imagem de modelo.',
        variant: 'destructive',
      });
    } finally {
      setProcessingModelUploadId(null);
    }
  };

  const openImagePreview = (url: string, title: string, subtitle?: string) => {
    setLightboxImage({ url, title, subtitle });
  };

  const toggleTecidoCollapsed = useCallback((tecidoId: string) => {
    setExpandedTecidoIds((previous) => {
      const next = new Set(previous);
      if (next.has(tecidoId)) next.delete(tecidoId);
      else next.add(tecidoId);
      return next;
    });
  }, []);

  const handleOpenLatestMosaicoByTecido = useCallback(async (tecidoId: string) => {
    setOpeningLatestMosaicoTecidoIds((previous) => {
      const next = new Set(previous);
      next.add(tecidoId);
      return next;
    });

    try {
      const latest = await getLatestMosaicoByTecido(tecidoId);
      if (!latest) {
        toast({
          title: 'Sem mosaico salvo',
          description: 'Ainda nao existe mosaico para este tecido.',
        });
        return;
      }

      window.open(latest.outputSquareUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel abrir o ultimo mosaico deste tecido.',
        variant: 'destructive',
      });
    } finally {
      setOpeningLatestMosaicoTecidoIds((previous) => {
        const next = new Set(previous);
        next.delete(tecidoId);
        return next;
      });
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />

      <main className="container mx-auto px-4 py-6 pb-20 md:pb-8">
        <div className="mb-6">
          <BreadcrumbNav
            items={[
              { label: 'Home', onClick: onNavigateHome },
              { label: 'Gestao de Imagens' },
            ]}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestao de Imagens</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gere imagens de variacao, envie foto de modelo e monte capas em mosaico para Shopee.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por cor, tecido ou SKU..."
                  className="pl-9"
                />
              </div>

              <Select value={selectedTecidoId} onValueChange={setSelectedTecidoId}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Filtrar por tecido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tecidos</SelectItem>
                  {tecidosDisponiveis.map((tecido) => (
                    <SelectItem key={tecido.id} value={tecido.id}>
                      {tecido.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : groupedVinculos.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="w-8 h-8" />}
            title="Nenhum tecido encontrado"
            description="Ajuste os filtros para visualizar os tecidos e vinculos na gestao de imagens."
          />
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                <div className="text-sm text-gray-600">
                  {filteredVinculos.length} vinculo(s) encontrado(s) - {selectedMosaicVinculos.length} selecionado(s) para mosaico
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAllVisible}>
                    Selecionar visiveis
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleClearSelection}>
                    Limpar selecao
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-5 mb-6">
              {groupedVinculos.map((group) => {
                const eligibleForTecido = group.vinculos.filter((vinculo) => vinculo.imagemTingida).length;
                const eligiblePremiumForTecido = group.vinculos.filter(
                  (vinculo) => vinculo.imagemTingida && vinculo.imagemModelo
                ).length;
                const isBatchRegenerating = regeneratingTecidoIds.has(group.tecidoId);
                const isBatchPremiumGenerating = generatingPremiumTecidoIds.has(group.tecidoId);
                const progress = regenerationProgressByTecido[group.tecidoId];
                const premiumProgress = premiumProgressByTecido[group.tecidoId];
                const isCollapsed = !expandedTecidoIds.has(group.tecidoId);
                const isOpeningLatest = openingLatestMosaicoTecidoIds.has(group.tecidoId);

                return (
                  <section
                    key={group.tecidoId}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                      <button
                        type="button"
                        onClick={() => toggleTecidoCollapsed(group.tecidoId)}
                        className="inline-flex items-center gap-2 text-sm rounded-md px-2 py-1 hover:bg-gray-100 transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-900">{group.tecidoNome}</span>
                        <span className="text-gray-600">{group.vinculos.length} vinculo(s)</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleOpenLatestMosaicoByTecido(group.tecidoId)}
                          disabled={isOpeningLatest}
                        >
                          {isOpeningLatest ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Abrindo ultimo mosaico
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver ultimo mosaico
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRegenerateByTecido(group.tecidoId)}
                          disabled={isBatchRegenerating || eligibleForTecido === 0}
                        >
                          {isBatchRegenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Regenerando {progress?.done ?? 0}/{progress?.total ?? eligibleForTecido}
                            </>
                          ) : (
                            'Regenerar todos deste tecido'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleGeneratePremiumByTecido(group.tecidoId)}
                          disabled={isBatchPremiumGenerating || eligiblePremiumForTecido === 0}
                        >
                          {isBatchPremiumGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Gerando premium {premiumProgress?.done ?? 0}/{premiumProgress?.total ?? eligiblePremiumForTecido}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Gerar premium deste tecido
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {!isCollapsed ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-14">Mosaico</TableHead>
                              <TableHead>Cor</TableHead>
                              <TableHead>Imagem Vinculo</TableHead>
                              <TableHead>Imagem Gerada</TableHead>
                              <TableHead>Foto Modelo</TableHead>
                              <TableHead>Premium</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.vinculos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6}>
                                  <p className="text-sm text-gray-500 py-6 text-center">
                                    Nenhum vinculo cadastrado para este tecido.
                                  </p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              group.vinculos.map((vinculo) => {
                                const isGenerating = generatingIds.has(vinculo.id);
                                const fingerprintOutdated =
                                  vinculo.imagemTingida &&
                                  vinculo.imagemGeradaFingerprint !== buildGenerationFingerprint(vinculo);

                                return (
                                  <TableRow key={vinculo.id}>
                                    <TableCell>
                                      <input
                                        type="checkbox"
                                        checked={selectedForMosaic.has(vinculo.id)}
                                        disabled={!vinculo.imagemTingida}
                                        onChange={() => handleToggleSelectForMosaic(vinculo.id)}
                                        className="h-4 w-4 rounded border-gray-300"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium text-gray-900">{vinculo.corNome}</div>
                                      <div className="text-xs text-gray-500">SKU {vinculo.sku || 'sem SKU'}</div>
                                    </TableCell>
                                    <TableCell>
                                      {vinculo.imagemTingida ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openImagePreview(
                                              vinculo.imagemTingida!,
                                              `${vinculo.corNome} em ${vinculo.tecidoNome}`
                                            )
                                          }
                                          className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md"
                                        >
                                          <img
                                            src={vinculo.imagemTingida}
                                            alt={vinculo.corNome}
                                            className="w-16 h-16 rounded-md border object-cover hover:scale-105 transition-transform"
                                          />
                                        </button>
                                      ) : (
                                        <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-gray-300">
                                          <ImageIcon className="w-5 h-5" />
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {vinculo.imagemGerada ? (
                                        <div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openImagePreview(
                                                vinculo.imagemGerada!,
                                                `Imagem gerada - ${vinculo.corNome}`,
                                                fingerprintOutdated
                                                  ? 'Versao desatualizada, sera regenerada automaticamente.'
                                                  : undefined
                                              )
                                            }
                                            className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md"
                                          >
                                            <img
                                              src={vinculo.imagemGerada}
                                              alt={`Gerada ${vinculo.corNome}`}
                                              className="w-16 h-16 rounded-md border object-cover hover:scale-105 transition-transform"
                                            />
                                          </button>
                                          {isGenerating ? (
                                            <div className="text-[11px] text-gray-500 mt-1 inline-flex items-center gap-1">
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              Atualizando
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-gray-300">
                                          {isGenerating ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                          ) : (
                                            <Sparkles className="w-5 h-5" />
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="group relative w-16 h-16">
                                        {vinculo.imagemModelo ? (
                                          <img
                                            src={vinculo.imagemModelo}
                                            alt={`Modelo ${vinculo.corNome}`}
                                            className="w-16 h-16 rounded-md border object-cover"
                                          />
                                        ) : (
                                          <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-gray-300 bg-gray-50">
                                            <Upload className="w-5 h-5" />
                                          </div>
                                        )}

                                        <div className="absolute inset-0 rounded-md bg-black/60 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                          <button
                                            type="button"
                                            title="Visualizar imagem 1:1"
                                            disabled={!vinculo.imagemModelo || processingModelUploadId === vinculo.id}
                                            onClick={() =>
                                              vinculo.imagemModelo
                                                ? openImagePreview(
                                                    vinculo.imagemModelo,
                                                    `Modelo - ${vinculo.corNome}`,
                                                    `Tecido ${vinculo.tecidoNome}`
                                                  )
                                                : undefined
                                            }
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            <Eye className="w-5 h-5" />
                                            <span className="sr-only">Visualizar imagem 1:1</span>
                                          </button>

                                          <label
                                            title={vinculo.imagemModelo ? 'Trocar modelo/imagem' : 'Enviar modelo/imagem'}
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-900 hover:bg-white cursor-pointer ${
                                              processingModelUploadId === vinculo.id ? 'pointer-events-none opacity-60' : ''
                                            }`}
                                          >
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="sr-only"
                                              disabled={processingModelUploadId === vinculo.id}
                                              onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (file) {
                                                  void handleModeloUpload(vinculo, file);
                                                }
                                                event.currentTarget.value = '';
                                              }}
                                            />
                                            {processingModelUploadId === vinculo.id ? (
                                              <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                              <Upload className="w-5 h-5" />
                                            )}
                                            <span className="sr-only">
                                              {vinculo.imagemModelo ? 'Trocar modelo/imagem' : 'Enviar modelo/imagem'}
                                            </span>
                                          </label>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {generatingPremiumIds.has(vinculo.id) ? (
                                        <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-gray-400 bg-gray-50">
                                          <Loader2 className="w-5 h-5 animate-spin" />
                                        </div>
                                      ) : vinculo.imagemPremiumSquare || vinculo.imagemPremiumPortrait ? (
                                        <div className="group relative w-16 h-16">
                                          <img
                                            src={vinculo.imagemPremiumSquare || vinculo.imagemPremiumPortrait || ''}
                                            alt={`Premium ${vinculo.corNome}`}
                                            className="w-16 h-16 rounded-md border object-cover"
                                          />

                                          <div className="absolute inset-0 rounded-md bg-black/60 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                            <button
                                              type="button"
                                              title="Visualizar imagem 1:1"
                                              disabled={!vinculo.imagemPremiumSquare}
                                              onClick={() =>
                                                vinculo.imagemPremiumSquare
                                                  ? openImagePreview(
                                                      vinculo.imagemPremiumSquare,
                                                      `Premium 1:1 - ${vinculo.corNome}`,
                                                      'Layout premium salvo no Firebase.'
                                                    )
                                                  : undefined
                                              }
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[10px] font-semibold leading-none text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                              1:1
                                              <span className="sr-only">Visualizar imagem 1:1</span>
                                            </button>

                                            <button
                                              type="button"
                                              title="Visualizar imagem 3:4"
                                              disabled={!vinculo.imagemPremiumPortrait}
                                              onClick={() =>
                                                vinculo.imagemPremiumPortrait
                                                  ? openImagePreview(
                                                      vinculo.imagemPremiumPortrait,
                                                      `Premium 3:4 - ${vinculo.corNome}`,
                                                      'Layout premium salvo no Firebase.'
                                                    )
                                                  : undefined
                                              }
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[10px] font-semibold leading-none text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                              3:4
                                              <span className="sr-only">Visualizar imagem 3:4</span>
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-gray-300">
                                          <Sparkles className="w-5 h-5" />
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Mosaico para capa Shopee</h2>
                <p className="text-sm text-gray-600">
                  Selecione imagens originais de um unico tecido e monte a capa em um dos templates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MOSAIC_TEMPLATE_OPTIONS.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      templateId === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{template.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerateMosaic} disabled={generatingMosaic || selectedMosaicVinculos.length === 0}>
                  {generatingMosaic ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando mosaico...
                    </>
                  ) : (
                    'Gerar e salvar mosaico'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = mosaicPreview?.squareUrl;
                    if (!url) return;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!mosaicPreview}
                >
                  Abrir preview 1:1
                </Button>
              </div>

              {mosaicPreview ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Saida 1:1 - 1024x1024</p>
                    <img src={mosaicPreview.squareUrl} alt="Mosaico quadrado" className="w-full rounded-md border" />
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Saida 3:4 - 1062x1416</p>
                    <img src={mosaicPreview.portraitUrl} alt="Mosaico vertical" className="w-full rounded-md border" />
                  </div>
                </div>
              ) : null}

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Mosaicos salvos</h3>
                  {loadingMosaicos ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : null}
                </div>
                {selectedTecidoId === 'all' ? (
                  <p className="text-xs text-gray-500">Selecione um tecido para listar os mosaicos salvos.</p>
                ) : mosaicos.length === 0 ? (
                  <p className="text-xs text-gray-500">Nenhum mosaico salvo para este tecido.</p>
                ) : (
                  <div className="space-y-2">
                    {mosaicos.map((mosaico) => (
                      <div key={mosaico.id} className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{mosaico.tecidoNomeSnapshot}</p>
                          <p className="text-xs text-gray-500">
                            Template {mosaico.templateId} {'\u2022'} {mosaico.selectedVinculoIds.length} imagem(ns)
                            {mosaico.isDefaultForTecido ? ' \u2022 Padrao do tecido' : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => window.open(mosaico.outputSquareUrl, '_blank', 'noopener,noreferrer')}>
                            Abrir 1:1
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(mosaico.outputPortraitUrl, '_blank', 'noopener,noreferrer')}>
                            Abrir 3:4
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await navigator.clipboard.writeText(mosaico.outputSquareUrl);
                              toast({
                                title: 'URL copiada',
                                description: 'URL da capa 1:1 copiada para uso no Shopee.',
                              });
                            }}
                          >
                            Copiar URL capa
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <ImageLightbox
        open={Boolean(lightboxImage)}
        onOpenChange={(open) => {
          if (!open) setLightboxImage(null);
        }}
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title || 'Preview'}
        subtitle={lightboxImage?.subtitle}
      />
    </div>
  );
}
