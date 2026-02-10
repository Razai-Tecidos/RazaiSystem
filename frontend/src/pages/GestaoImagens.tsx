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
import { useToast } from '@/hooks/use-toast';
import { generateBrandOverlay } from '@/lib/brandOverlay';
import { buildMosaicOutputs } from '@/lib/mosaicBuilder';
import {
  uploadImagemGerada,
  uploadImagemModelo,
} from '@/lib/firebase/cor-tecido';
import {
  createGestaoImagemMosaico,
  listMosaicosByTecido,
  uploadMosaicoImage,
} from '@/lib/firebase/gestao-imagens';
import { CorTecido } from '@/types/cor.types';
import { GestaoImagemMosaico, MosaicTemplateId } from '@/types/gestao-imagens.types';
import {
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
  { id: 'triptych', label: 'Triptych', description: 'TrÃªs colunas para destacar variacoes.' },
];

export function GestaoImagens({ onNavigateHome }: GestaoImagensProps) {
  const { vinculos, loading, updateVinculo } = useCorTecido();
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

  const generatingIdsRef = useRef<Set<string>>(new Set());

  const tecidosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    vinculos.forEach((v) => {
      if (!map.has(v.tecidoId)) {
        map.set(v.tecidoId, v.tecidoNome);
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [vinculos]);

  const filteredVinculos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return vinculos.filter((v) => {
      if (!term) return true;

      return (
        v.corNome.toLowerCase().includes(term) ||
        v.tecidoNome.toLowerCase().includes(term) ||
        (v.sku || '').toLowerCase().includes(term)
      );
    });
  }, [vinculos, searchTerm]);

  const groupedVinculos = useMemo<GroupedVinculos[]>(() => {
    const groupedMap = new Map<string, GroupedVinculos>();

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
  }, [filteredVinculos]);

  const loadMosaicos = useCallback(async (tecidoId: string) => {
    try {
      setLoadingMosaicos(true);
      const data = await listMosaicosByTecido(tecidoId);
      setMosaicos(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os mosaicos salvos.',
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
        if (v.imagemGerada) next.add(v.id);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedForMosaic(new Set());
  };

  const selectedMosaicVinculos = useMemo(
    () => vinculos.filter((v) => selectedForMosaic.has(v.id) && v.imagemGerada),
    [selectedForMosaic, vinculos]
  );

  const handleGenerateMosaic = async () => {
    if (selectedMosaicVinculos.length === 0) {
      toast({
        title: 'Selecao vazia',
        description: 'Selecione ao menos um vinculo com imagem gerada.',
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
        images: selectedMosaicVinculos.map((v) => v.imagemGerada!).filter(Boolean),
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
        sourcePolicy: 'gerada',
        selectedVinculoIds: selectedMosaicVinculos.map((v) => v.id),
        selectedImageUrls: selectedMosaicVinculos.map((v) => v.imagemGerada!).filter(Boolean),
        outputSquareUrl: squareUrl,
        outputPortraitUrl: portraitUrl,
        createdBy: auth.currentUser?.uid || 'unknown',
      });

      if (selectedTecidoId !== tecidoId) {
        setSelectedTecidoId(tecidoId);
      } else {
        await loadMosaicos(tecidoId);
      }

      toast({
        title: 'Mosaico gerado',
        description: 'A capa foi criada e salva no Firebase.',
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
        ) : filteredVinculos.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="w-8 h-8" />}
            title="Nenhum vinculo encontrado"
            description="Ajuste os filtros ou cadastre imagens nos vinculos para iniciar a gestao."
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
                const isBatchRegenerating = regeneratingTecidoIds.has(group.tecidoId);
                const progress = regenerationProgressByTecido[group.tecidoId];

                return (
                  <section
                    key={group.tecidoId}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{group.tecidoNome}</span>
                        <span className="text-gray-600 ml-2">{group.vinculos.length} vinculo(s)</span>
                      </div>
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
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-14">Mosaico</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Imagem Vinculo</TableHead>
                            <TableHead>Imagem Gerada</TableHead>
                            <TableHead>Foto Modelo</TableHead>
                            <TableHead className="w-48">Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.vinculos.map((vinculo) => {
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
                                    disabled={!vinculo.imagemGerada}
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
                                        className="w-14 h-14 rounded-md border object-cover hover:scale-105 transition-transform"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-14 h-14 rounded-md border border-dashed flex items-center justify-center text-gray-300">
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
                                          className="w-14 h-14 rounded-md border object-cover hover:scale-105 transition-transform"
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
                                    <div className="w-14 h-14 rounded-md border border-dashed flex items-center justify-center text-gray-300">
                                      {isGenerating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-5 h-5" />
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {vinculo.imagemModelo ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openImagePreview(
                                          vinculo.imagemModelo!,
                                          `Modelo - ${vinculo.corNome}`,
                                          `Tecido ${vinculo.tecidoNome}`
                                        )
                                      }
                                      className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md"
                                    >
                                      <img
                                        src={vinculo.imagemModelo}
                                        alt={`Modelo ${vinculo.corNome}`}
                                        className="w-14 h-14 rounded-md border object-cover hover:scale-105 transition-transform"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-14 h-14 rounded-md border border-dashed flex items-center justify-center text-gray-300">
                                      <Upload className="w-5 h-5" />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <label className="inline-flex">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="sr-only"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void handleModeloUpload(vinculo, file);
                                        }
                                        event.currentTarget.value = '';
                                      }}
                                    />
                                    <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 h-8 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground">
                                      {processingModelUploadId === vinculo.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                          Enviando...
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-4 h-4 mr-1" />
                                          {vinculo.imagemModelo ? 'Trocar modelo' : 'Upload modelo'}
                                        </>
                                      )}
                                    </span>
                                  </label>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Mosaico para capa Shopee</h2>
                <p className="text-sm text-gray-600">
                  Selecione imagens geradas de um unico tecido e monte a capa em um dos templates.
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
                            Template {mosaico.templateId} â€¢ {mosaico.selectedVinculoIds.length} imagem(ns)
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
