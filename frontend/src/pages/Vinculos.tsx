import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useCores } from '@/hooks/useCores';
import { useTecidos } from '@/hooks/useTecidos';
import { useReinhardML } from '@/hooks/useReinhardML';
import { CorTecido } from '@/types/cor.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { EmptyState } from '@/components/Layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Loader2, 
  Search, 
  Trash2, 
  Edit, 
  Link as LinkIcon,
  Image as ImageIcon,
  Download,
  Filter,
  Brain,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import { createZipFromImages } from '@/lib/zipUtils';
import ExcelJS from 'exceljs';
import { EditarVinculo } from './EditarVinculo';
import { updateCorDataInVinculos } from '@/lib/firebase/cor-tecido';
import { ImageLightbox } from '@/components/ui/image-lightbox';

interface VinculosProps {
  onNavigateHome?: () => void;
}

export function Vinculos({ onNavigateHome }: VinculosProps) {
  const { vinculos, loading, deleteVinculo, updateVinculo } = useCorTecido();
  const { cores, updateCor } = useCores();
  const { tecidos } = useTecidos();
  const { status: mlStatus, exampleCount, train, metadata } = useReinhardML();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTecido, setFiltroTecido] = useState<string | null>(null);
  const [filtroCor, setFiltroCor] = useState<string | null>(null);
  const [editingVinculoId, setEditingVinculoId] = useState<string | null>(null);
  const [showNovoVinculo, setShowNovoVinculo] = useState(false);
  // Estado para controle de expansão dos grupos por tecido
  const [expandedTecidos, setExpandedTecidos] = useState<Set<string>>(new Set());
  
  // Estado para edição inline de nome
  const [editingNomeVinculoId, setEditingNomeVinculoId] = useState<string | null>(null);
  const [editingNomeValue, setEditingNomeValue] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const nomeInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para edição inline de SKU da cor
  const [editingSkuVinculoId, setEditingSkuVinculoId] = useState<string | null>(null);
  const [editingSkuValue, setEditingSkuValue] = useState('');
  const [savingSku, setSavingSku] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para ConfirmDialog genérico
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  const showConfirm = useCallback((title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  }, []);

  // Estado para progresso da exportação XLSX
  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean;
    current: number;
    total: number;
    currentItem: string;
  } | null>(null);

  // Função para gerar SKUs das cores e vínculos que não têm
  const handleGerarSkus = async () => {
    // 1. Identificar cores sem SKU (que não são "Cor capturada")
    const coresSemSku = cores.filter(c => 
      !c.sku && 
      c.nome && 
      !c.nome.toLowerCase().startsWith('cor capturada')
    );
    
    // 2. Identificar vínculos sem SKU (que têm tecidoSku e corSku)
    const vinculosSemSku = vinculos.filter(v => !v.sku && v.tecidoSku && v.corSku);
    
    // 3. Identificar vínculos que faltam corSku (cor não tem SKU)
    const vinculosFaltandoCorSku = vinculos.filter(v => !v.corSku && v.tecidoSku);
    
    if (coresSemSku.length === 0 && vinculosSemSku.length === 0 && vinculosFaltandoCorSku.length === 0) {
      toast({
        title: 'Tudo em ordem!',
        description: 'Todas as cores e vínculos já têm SKU.',
      });
      return;
    }
    
    // Montar mensagem de confirmação
    const partes = [];
    if (coresSemSku.length > 0) partes.push(`${coresSemSku.length} cor(es)`);
    if (vinculosSemSku.length > 0 || vinculosFaltandoCorSku.length > 0) {
      const totalVinculos = new Set([
        ...vinculosSemSku.map(v => v.id),
        ...vinculosFaltandoCorSku.map(v => v.id)
      ]).size;
      partes.push(`${totalVinculos} vínculo(s)`);
    }
    
    showConfirm(
      'Gerar SKUs',
      `Gerar SKU para ${partes.join(' e ')}?`,
      () => executeGerarSkus(coresSemSku, vinculosSemSku, vinculosFaltandoCorSku)
    );
    return;
  };

  const executeGerarSkus = async (
    coresSemSku: typeof cores,
    _vinculosSemSku: typeof vinculos,
    _vinculosFaltandoCorSku: typeof vinculos
  ) => {
    
    let coresAtualizadas = 0;
    let vinculosAtualizados = 0;
    let falhas = 0;
    
    // Primeiro: gerar SKU para cores
    for (const cor of coresSemSku) {
      try {
        // updateCor do hook já gera SKU automaticamente quando o nome não é padrão
        await updateCor({ id: cor.id, nome: cor.nome });
        coresAtualizadas++;
      } catch (error) {
        console.error(`Erro ao gerar SKU para cor ${cor.nome}:`, error);
        falhas++;
      }
    }
    
    // Aguardar um pouco para os vínculos serem atualizados pelo hook
    if (coresAtualizadas > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Segundo: gerar SKU para vínculos (recarregar lista para pegar corSku atualizado)
    // Os vínculos já devem ter sido atualizados pelo updateCor, mas vamos verificar
    const vinculosAtuais = vinculos.filter(v => !v.sku && v.tecidoSku && v.corSku);
    
    for (const vinculo of vinculosAtuais) {
      try {
        const sku = `${vinculo.tecidoSku}-${vinculo.corSku}`;
        await updateVinculo({ id: vinculo.id, sku });
        vinculosAtualizados++;
      } catch (error) {
        console.error(`Erro ao gerar SKU para vínculo ${vinculo.id}:`, error);
        falhas++;
      }
    }
    
    // Mensagem de resultado
    const resultados = [];
    if (coresAtualizadas > 0) resultados.push(`${coresAtualizadas} cor(es)`);
    if (vinculosAtualizados > 0) resultados.push(`${vinculosAtualizados} vínculo(s)`);
    
    toast({
      title: 'SKUs gerados!',
      description: resultados.length > 0 
        ? `${resultados.join(' e ')} atualizado(s)${falhas > 0 ? `. ${falhas} falharam` : ''}.`
        : 'Nenhum item precisou de atualização.',
      variant: falhas > 0 ? 'destructive' : 'default',
    });
  };

  const handleTreinarML = async () => {
    if (exampleCount < 10) {
      toast({
        title: 'Poucos exemplos',
        description: `Você tem ${exampleCount} exemplos. São necessários pelo menos 10 para treinar o modelo.`,
        variant: 'destructive',
      });
      return;
    }
    
    try {
      toast({
        title: 'Treinamento iniciado',
        description: 'O modelo está sendo treinado. Isso pode levar alguns segundos...',
      });
      
      await train();
      
      toast({
        title: 'Treinamento concluído!',
        description: `Modelo treinado com ${exampleCount} exemplos.`,
      });
    } catch (error) {
      console.error('Erro ao treinar:', error);
      toast({
        title: 'Erro no treinamento',
        description: 'Não foi possível treinar o modelo. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Identificar vínculos com referências inválidas (cor ou tecido deletado)
  const vinculosComProblema = useMemo(() => {
    if (cores.length === 0 || tecidos.length === 0) return [];
    
    const coreIds = new Set(cores.map(c => c.id));
    const tecidoIds = new Set(tecidos.map(t => t.id));
    
    return vinculos.filter(v => {
      const corInvalida = !coreIds.has(v.corId);
      const tecidoInvalido = !tecidoIds.has(v.tecidoId);
      return corInvalida || tecidoInvalido;
    }).map(v => ({
      ...v,
      corInvalida: !coreIds.has(v.corId),
      tecidoInvalido: !tecidoIds.has(v.tecidoId),
    }));
  }, [vinculos, cores, tecidos]);

  // Filtrar vínculos
  const vinculosFiltrados = useMemo(() => {
    return vinculos.filter(v => {
      // Filtro de busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNomeCor = v.corNome?.toLowerCase().includes(term);
        const matchNomeTecido = v.tecidoNome?.toLowerCase().includes(term);
        const matchSkuCor = v.corSku?.toLowerCase().includes(term);
        const matchSkuTecido = v.tecidoSku?.toLowerCase().includes(term);
        if (!matchNomeCor && !matchNomeTecido && !matchSkuCor && !matchSkuTecido) {
          return false;
        }
      }
      
      // Filtro por tecido
      if (filtroTecido && v.tecidoId !== filtroTecido) {
        return false;
      }
      
      // Filtro por cor
      if (filtroCor && v.corId !== filtroCor) {
        return false;
      }
      
      return true;
    });
  }, [vinculos, searchTerm, filtroTecido, filtroCor]);

  // Agrupar vínculos filtrados por tecido
  const vinculosAgrupados = useMemo(() => {
    const grupos = new Map<string, CorTecido[]>();
    
    vinculosFiltrados.forEach(vinculo => {
      const tecidoId = vinculo.tecidoId;
      if (!grupos.has(tecidoId)) {
        grupos.set(tecidoId, []);
      }
      grupos.get(tecidoId)!.push(vinculo);
    });
    
    // Ordenar grupos por nome do tecido
    const gruposArray = Array.from(grupos.entries()).map(([tecidoId, vinculos]) => {
      const primeiroVinculo = vinculos[0];
      return {
        tecidoId,
        tecidoNome: primeiroVinculo.tecidoNome,
        tecidoSku: primeiroVinculo.tecidoSku,
        vinculos: vinculos.sort((a, b) => a.corNome.localeCompare(b.corNome)),
      };
    });
    
    return gruposArray.sort((a, b) => a.tecidoNome.localeCompare(b.tecidoNome));
  }, [vinculosFiltrados]);

  // Lista ordenada de todos os vínculos visíveis para navegação com Enter
  const vinculosOrdenados = useMemo(() => {
    const lista: CorTecido[] = [];
    vinculosAgrupados.forEach(grupo => {
      if (expandedTecidos.has(grupo.tecidoId)) {
        lista.push(...grupo.vinculos);
      }
    });
    return lista;
  }, [vinculosAgrupados, expandedTecidos]);

  // Focar no input quando começar a editar
  useEffect(() => {
    if (editingNomeVinculoId && nomeInputRef.current) {
      nomeInputRef.current.focus();
      nomeInputRef.current.select();
    }
  }, [editingNomeVinculoId]);

  // Iniciar edição de nome
  const startEditingNome = useCallback((vinculo: CorTecido) => {
    setEditingNomeVinculoId(vinculo.id);
    setEditingNomeValue(vinculo.corNome);
  }, []);

  // Cancelar edição
  const cancelEditingNome = useCallback(() => {
    setEditingNomeVinculoId(null);
    setEditingNomeValue('');
  }, []);

  // Salvar nome e opcionalmente ir para o próximo
  const saveNome = useCallback(async (goToNext: boolean = false) => {
    if (!editingNomeVinculoId) return;
    
    const vinculo = vinculos.find(v => v.id === editingNomeVinculoId);
    if (!vinculo) {
      cancelEditingNome();
      return;
    }
    
    const novoNome = editingNomeValue.trim();
    
    // Se não mudou ou está vazio, apenas cancelar
    if (novoNome === vinculo.corNome || novoNome === '') {
      if (goToNext) {
        // Ir para o próximo mesmo sem salvar
        const currentIndex = vinculosOrdenados.findIndex(v => v.id === editingNomeVinculoId);
        const nextVinculo = vinculosOrdenados[currentIndex + 1];
        if (nextVinculo) {
          startEditingNome(nextVinculo);
        } else {
          cancelEditingNome();
        }
      } else {
        cancelEditingNome();
      }
      return;
    }
    
    setSavingNome(true);
    try {
      // Usar updateCor do hook que já faz:
      // - Verificação de nome duplicado
      // - Geração de SKU se necessário
      // - Propagação para vínculos
      await updateCor({ id: vinculo.corId, nome: novoNome });
      
      if (goToNext) {
        // Ir para o próximo
        const currentIndex = vinculosOrdenados.findIndex(v => v.id === editingNomeVinculoId);
        const nextVinculo = vinculosOrdenados[currentIndex + 1];
        if (nextVinculo) {
          startEditingNome(nextVinculo);
        } else {
          cancelEditingNome();
          toast({
            title: 'Fim da lista',
            description: 'Você chegou ao último item visível.',
          });
        }
      } else {
        cancelEditingNome();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar nome:', error);
      // Se for erro de nome duplicado, manter input aberto para correção
      // (o toast já foi mostrado pelo hook)
      if (error?.message?.includes('Nome duplicado')) {
        setSavingNome(false);
        return;
      }
      // Para outros erros, o hook já mostra o toast
    } finally {
      setSavingNome(false);
    }
  }, [editingNomeVinculoId, editingNomeValue, vinculos, vinculosOrdenados, startEditingNome, cancelEditingNome, updateCor]);

  // Handler de teclas para o input de nome
  const handleNomeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNome(true); // Salvar e ir para próximo
    } else if (e.key === 'Escape') {
      cancelEditingNome();
    }
  }, [saveNome, cancelEditingNome]);

  // Focar no input de SKU quando começar a editar
  useEffect(() => {
    if (editingSkuVinculoId && skuInputRef.current) {
      skuInputRef.current.focus();
      skuInputRef.current.select();
    }
  }, [editingSkuVinculoId]);

  // Iniciar edição de SKU
  const startEditingSku = useCallback((vinculo: CorTecido) => {
    setEditingSkuVinculoId(vinculo.id);
    setEditingSkuValue(vinculo.corSku || '');
  }, []);

  // Cancelar edição de SKU
  const cancelEditingSku = useCallback(() => {
    setEditingSkuVinculoId(null);
    setEditingSkuValue('');
  }, []);

  // Salvar SKU e opcionalmente ir para o próximo
  const saveSku = useCallback(async (goToNext: boolean = false) => {
    if (!editingSkuVinculoId) return;
    
    const vinculo = vinculos.find(v => v.id === editingSkuVinculoId);
    if (!vinculo) {
      cancelEditingSku();
      return;
    }
    
    const novoSku = editingSkuValue.trim().toUpperCase();
    
    // Se não mudou, apenas cancelar ou ir para próximo
    if (novoSku === (vinculo.corSku || '')) {
      if (goToNext) {
        const currentIndex = vinculosOrdenados.findIndex(v => v.id === editingSkuVinculoId);
        const nextVinculo = vinculosOrdenados[currentIndex + 1];
        if (nextVinculo) {
          startEditingSku(nextVinculo);
        } else {
          cancelEditingSku();
        }
      } else {
        cancelEditingSku();
      }
      return;
    }
    
    setSavingSku(true);
    try {
      // Atualizar o SKU da cor em todos os vínculos que usam essa cor
      await updateCorDataInVinculos(vinculo.corId, { corSku: novoSku || undefined });
      
      // Também atualizar na collection de cores (usando o hook)
      await updateCor({ id: vinculo.corId, sku: novoSku || undefined });
      
      toast({
        title: 'SKU atualizado!',
        description: novoSku ? `SKU da cor: ${novoSku}` : 'SKU removido',
      });
      
      if (goToNext) {
        const currentIndex = vinculosOrdenados.findIndex(v => v.id === editingSkuVinculoId);
        const nextVinculo = vinculosOrdenados[currentIndex + 1];
        if (nextVinculo) {
          startEditingSku(nextVinculo);
        } else {
          cancelEditingSku();
          toast({
            title: 'Fim da lista',
            description: 'Você chegou ao último item visível.',
          });
        }
      } else {
        cancelEditingSku();
      }
    } catch (error) {
      console.error('Erro ao atualizar SKU:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar o novo SKU.',
        variant: 'destructive',
      });
    } finally {
      setSavingSku(false);
    }
  }, [editingSkuVinculoId, editingSkuValue, vinculos, vinculosOrdenados, startEditingSku, cancelEditingSku, toast]);

  // Handler de teclas para o input de SKU
  const handleSkuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSku(true); // Salvar e ir para próximo
    } else if (e.key === 'Escape') {
      cancelEditingSku();
    }
  }, [saveSku, cancelEditingSku]);

  // Função para alternar expansão de um tecido
  const toggleTecidoExpansion = (tecidoId: string) => {
    setExpandedTecidos(prev => {
      const novo = new Set(prev);
      if (novo.has(tecidoId)) {
        novo.delete(tecidoId);
      } else {
        novo.add(tecidoId);
      }
      return novo;
    });
  };

  // Todos os grupos começam fechados por padrão (não expandir automaticamente)

  // Funções para copiar dados para clipboard
  const handleCopiarSkus = async (vinculos: CorTecido[]) => {
    try {
      const skus = vinculos
        .map(v => v.sku)
        .filter(sku => sku && sku.trim() !== '');
      
      if (skus.length === 0) {
        toast({
          title: 'Nenhum SKU encontrado',
          description: 'Nenhum vínculo possui SKU para copiar.',
          variant: 'destructive',
        });
        return;
      }
      
      const texto = skus.join('\t');
      await navigator.clipboard.writeText(texto);
      
      toast({
        title: 'SKUs copiados!',
        description: `${skus.length} SKU(s) copiado(s) para a área de transferência.`,
      });
    } catch (error) {
      console.error('Erro ao copiar SKUs:', error);
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar os SKUs.',
        variant: 'destructive',
      });
    }
  };

  const handleCopiarHex = async (vinculos: CorTecido[]) => {
    try {
      const hexes = vinculos
        .map(v => v.corHex)
        .filter(hex => hex && hex.trim() !== '');
      
      if (hexes.length === 0) {
        toast({
          title: 'Nenhum HEX encontrado',
          description: 'Nenhum vínculo possui código HEX para copiar.',
          variant: 'destructive',
        });
        return;
      }
      
      const texto = hexes.join('\t');
      await navigator.clipboard.writeText(texto);
      
      toast({
        title: 'HEX copiados!',
        description: `${hexes.length} código(s) HEX copiado(s) para a área de transferência.`,
      });
    } catch (error) {
      console.error('Erro ao copiar HEX:', error);
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar os códigos HEX.',
        variant: 'destructive',
      });
    }
  };

  const handleCopiarNomes = async (vinculos: CorTecido[]) => {
    try {
      const nomes = vinculos
        .map(v => v.corNome)
        .filter(nome => nome && nome.trim() !== '');
      
      if (nomes.length === 0) {
        toast({
          title: 'Nenhum nome encontrado',
          description: 'Nenhum vínculo possui nome para copiar.',
          variant: 'destructive',
        });
        return;
      }
      
      const texto = nomes.join('\t');
      await navigator.clipboard.writeText(texto);
      
      toast({
        title: 'Nomes copiados!',
        description: `${nomes.length} nome(s) copiado(s) para a área de transferência.`,
      });
    } catch (error) {
      console.error('Erro ao copiar nomes:', error);
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar os nomes.',
        variant: 'destructive',
      });
    }
  };

  // Funções para download múltiplo em ZIP
  const handleDownloadPreview = async (grupo: { tecidoNome: string; vinculos: CorTecido[] }) => {
    try {
      const imagensComUrl = grupo.vinculos
        .filter(v => v.imagemTingida)
        .map(v => ({
          url: v.imagemTingida!,
          filename: `${v.corNome.replace(/[^a-zA-Z0-9]/g, '_')}_${grupo.tecidoNome.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        }));
      
      if (imagensComUrl.length === 0) {
        toast({
          title: 'Nenhuma imagem encontrada',
          description: 'Nenhum vínculo possui imagem preview para baixar.',
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Criando ZIP...',
        description: `Preparando ${imagensComUrl.length} imagem(ns) para download.`,
      });
      
      const zipFilename = `${grupo.tecidoNome.replace(/[^a-zA-Z0-9]/g, '_')}_previews.zip`;
      await createZipFromImages(imagensComUrl, zipFilename);
      
      toast({
        title: 'Download concluído!',
        description: `Arquivo ${zipFilename} baixado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao fazer download do preview:', error);
      toast({
        title: 'Erro no download',
        description: 'Não foi possível criar o arquivo ZIP.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteVinculo = (vinculo: CorTecido) => {
    showConfirm(
      'Excluir vínculo',
      `Remover vínculo "${vinculo.corNome}" + "${vinculo.tecidoNome}"?`,
      async () => {
        try {
          await deleteVinculo(vinculo.id);
        } catch (error) {
          console.error('Erro ao excluir vínculo:', error);
        }
      }
    );
  };

  // Função auxiliar para converter Blob para Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Função para exportar tabela como XLSX com imagens inseridas como mídia
  const handleExportarTabela = async () => {
    try {
      if (vinculosFiltrados.length === 0) {
        toast({
          title: 'Nenhum dado para exportar',
          description: 'Não há vínculos filtrados para exportar.',
          variant: 'destructive',
        });
        return;
      }

      // Contar total de imagens para progresso
      const totalImagens = vinculosFiltrados.reduce((acc, v) => {
        return acc + (v.imagemTingida ? 1 : 0);
      }, 0);
      let imagensProcessadas = 0;

      // Iniciar progresso visual
      setExportProgress({
        isExporting: true,
        current: 0,
        total: totalImagens,
        currentItem: 'Iniciando...',
      });

      // Criar workbook
      const workbook = new ExcelJS.Workbook();

      // Processar cada grupo de tecido
      for (const grupo of vinculosAgrupados) {
        // Criar worksheet para cada tecido
        const worksheet = workbook.addWorksheet(grupo.tecidoNome.substring(0, 31)); // Limite de 31 caracteres para nome da aba

        // Definir cabeçalhos com largura adequada para imagens
        worksheet.columns = [
          { header: 'SKU do Vínculo', key: 'sku', width: 15 },
          { header: 'SKU da Cor', key: 'corSku', width: 12 },
          { header: 'Nome da Cor', key: 'corNome', width: 20 },
          { header: 'HEX da Cor', key: 'corHex', width: 10 },
          { header: 'Imagem Preview', key: 'imagemPreview', width: 15 },
          { header: 'Data de Criação', key: 'dataCriacao', width: 15 },
          { header: 'Data de Atualização', key: 'dataAtualizacao', width: 15 },
        ];

        // Estilizar cabeçalho
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        // Processar cada vínculo do grupo
        for (let i = 0; i < grupo.vinculos.length; i++) {
          const vinculo = grupo.vinculos[i];
          const rowNumber = i + 2; // +2 porque linha 1 é cabeçalho

          const dataCriacao = vinculo.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || '-';
          const dataAtualizacao = vinculo.updatedAt?.toDate?.()?.toLocaleDateString('pt-BR') || '-';

          // Adicionar dados da linha usando array (células de imagem ficam vazias)
          const row = worksheet.addRow([
            vinculo.sku || '',
            vinculo.corSku || '',
            vinculo.corNome || '',
            vinculo.corHex || '',
            null, // Coluna E - vazia para imagem preview
            dataCriacao,
            dataAtualizacao,
          ]);

          // Definir altura da linha para 100px (aproximadamente 75 pontos)
          row.height = 75;

          // Adicionar imagem preview se existir
          if (vinculo.imagemTingida) {
            try {
              // Atualizar progresso
              setExportProgress(prev => prev ? {
                ...prev,
                current: imagensProcessadas,
                currentItem: `Preview: ${vinculo.corNome}`,
              } : null);
              
              const response = await fetch(vinculo.imagemTingida);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              
              const blob = await response.blob();
              const base64 = await blobToBase64(blob);
              const contentType = blob.type || 'image/png';
              const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : 'png';
              
              const imageId = workbook.addImage({
                base64: base64,
                extension: extension as 'png' | 'jpeg',
              });

              // Inserir imagem ancorada na célula E
              worksheet.addImage(imageId, {
                tl: { col: 4, row: rowNumber - 1 },
                ext: { width: 90, height: 90 },
              });
              
              imagensProcessadas++;
            } catch (error) {
              console.error(`Erro ao adicionar imagem preview para ${vinculo.id}:`, error);
              // Não colocar URL como fallback - deixar célula vazia
            }
          }
        }

        // Ajustar altura de todas as linhas de dados para 100px
        for (let i = 2; i <= grupo.vinculos.length + 1; i++) {
          worksheet.getRow(i).height = 75; // 75 pontos ≈ 100px
        }
      }

      // Atualizar progresso para finalização
      setExportProgress(prev => prev ? {
        ...prev,
        current: totalImagens,
        currentItem: 'Gerando arquivo...',
      } : null);

      // Gerar buffer do arquivo
      const buffer = await workbook.xlsx.writeBuffer();

      // Criar blob e fazer download
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vinculos_cor_tecido_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Limpar progresso
      setExportProgress(null);

      toast({
        title: 'Exportação concluída!',
        description: `Arquivo XLSX com ${vinculosAgrupados.length} tecido(s), ${vinculosFiltrados.length} vínculo(s) e ${imagensProcessadas} imagem(ns) baixado com sucesso.`,
      });
    } catch (error: any) {
      console.error('Erro ao exportar tabela:', error);
      setExportProgress(null);
      toast({
        title: 'Erro na exportação',
        description: error.message || 'Não foi possível exportar a tabela.',
        variant: 'destructive',
      });
    }
  };

  // Se estiver editando um vínculo
  if (editingVinculoId) {
    return (
      <EditarVinculo 
        vinculoId={editingVinculoId} 
        onNavigateBack={() => setEditingVinculoId(null)}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  // Se estiver criando novo vínculo
  if (showNovoVinculo) {
    return (
      <EditarVinculo 
        vinculoId={null}
        onNavigateBack={() => setShowNovoVinculo(false)}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay de progresso da exportação */}
      {exportProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileSpreadsheet className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Exportando XLSX</h3>
                <p className="text-sm text-gray-500">Processando imagens...</p>
              </div>
            </div>
            
            {/* Barra de progresso */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{exportProgress.currentItem}</span>
                <span className="font-medium text-gray-900">
                  {exportProgress.total > 0 
                    ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    width: exportProgress.total > 0 
                      ? `${(exportProgress.current / exportProgress.total) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
            </div>
            
            {/* Contador */}
            <div className="text-center text-sm text-gray-500">
              {exportProgress.current} de {exportProgress.total} imagens processadas
            </div>
          </div>
        </div>
      )}
      
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Vínculos Cor-Tecido' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        {/* Card de Status ML */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                mlStatus === 'ready' ? 'bg-green-100' :
                mlStatus === 'training' ? 'bg-yellow-100' :
                mlStatus === 'loading' ? 'bg-blue-100' :
                'bg-gray-100'
              }`}>
                <Brain className={`h-5 w-5 ${
                  mlStatus === 'ready' ? 'text-green-600' :
                  mlStatus === 'training' ? 'text-yellow-600' :
                  mlStatus === 'loading' ? 'text-blue-600' :
                  'text-gray-500'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Machine Learning</span>
                  {mlStatus === 'ready' && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" /> Pronto
                    </span>
                  )}
                  {mlStatus === 'training' && (
                    <span className="flex items-center gap-1 text-xs text-yellow-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Treinando...
                    </span>
                  )}
                  {mlStatus === 'loading' && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                    </span>
                  )}
                  {mlStatus === 'idle' && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <AlertCircle className="h-3 w-3" /> Aguardando dados
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {exampleCount} exemplo(s) de treinamento
                  {metadata?.lastLoss && ` • Loss: ${metadata.lastLoss.toFixed(4)}`}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTreinarML}
              disabled={mlStatus === 'training' || mlStatus === 'loading' || exampleCount < 10}
            >
              {mlStatus === 'training' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Treinando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Treinar Modelo
                </>
              )}
            </Button>
          </div>
          {exampleCount < 10 && (
            <p className="text-xs text-amber-600 mt-2">
              O modelo precisa de pelo menos 10 exemplos para treinar. Edite vínculos e salve ajustes para adicionar mais exemplos.
            </p>
          )}
        </div>

        {/* Botão para gerar SKUs */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gray-100">
                <LinkIcon className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <span className="font-medium text-gray-900">SKUs dos Vínculos</span>
                <p className="text-xs text-gray-500">
                  Gera SKUs no formato "TecidoSKU-CorSKU" para vínculos sem SKU
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGerarSkus}
            >
              Gerar SKUs
            </Button>
          </div>
        </div>

        {/* Card de Diagnóstico - Vínculos com Problemas */}
        {vinculosComProblema.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-900">
                      {vinculosComProblema.length} vínculo(s) com problema
                    </span>
                  </div>
                  <p className="text-sm text-red-700">
                    Estes vínculos referenciam cores ou tecidos que foram deletados
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                {vinculosComProblema.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-white p-3 rounded border border-red-200">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {v.corNome || 'Cor desconhecida'} + {v.tecidoNome || 'Tecido desconhecido'}
                      </span>
                      <span className="text-xs text-red-600">
                        {v.corInvalida && v.tecidoInvalido 
                          ? 'Cor e tecido não encontrados'
                          : v.corInvalida 
                            ? `Cor não encontrada (ID: ${v.corId})`
                            : `Tecido não encontrado (ID: ${v.tecidoId})`
                        }
                      </span>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        showConfirm(
                          'Deletar vínculo com problema',
                          `Deletar vínculo "${v.corNome} + ${v.tecidoNome}"?`,
                          () => deleteVinculo(v.id)
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Deletar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Vínculos Cor-Tecido
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gerencie as combinações de cores com tecidos e suas imagens tingidas
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportarTabela} variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar XLSX
              </Button>
              <Button onClick={() => setShowNovoVinculo(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Vínculo
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="space-y-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={filtroTecido || ''}
                onChange={(e) => setFiltroTecido(e.target.value || null)}
                className="h-11 px-3 rounded-md border border-input bg-background text-sm flex-1"
                aria-label="Filtrar por tecido"
              >
                <option value="">Todos os tecidos</option>
                {tecidos.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              
              <select
                value={filtroCor || ''}
                onChange={(e) => setFiltroCor(e.target.value || null)}
                className="h-11 px-3 rounded-md border border-input bg-background text-sm flex-1"
                aria-label="Filtrar por cor"
              >
                <option value="">Todas as cores</option>
                {cores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              
              {(filtroTecido || filtroCor || searchTerm) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => {
                    setFiltroTecido(null);
                    setFiltroCor(null);
                    setSearchTerm('');
                  }}
                >
                  <Filter className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Contagem */}
          <div className="mb-4 text-sm text-gray-500">
            {vinculosFiltrados.length} vínculo(s) encontrado(s)
          </div>

          {/* Loading */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded flex-1 max-w-xs" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : vinculosFiltrados.length === 0 ? (
            <EmptyState
              icon={<LinkIcon className="h-8 w-8" />}
              title="Nenhum vínculo encontrado"
              description="Crie um novo vínculo para associar uma cor a um tecido."
              action={
                <Button onClick={() => setShowNovoVinculo(true)} className="min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Vínculo
                </Button>
              }
            />
          ) : (
            /* Tabela */
            <div className="rounded-lg border overflow-hidden">
              <div className="scroll-smooth-x">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">Cor</TableHead>
                    <TableHead className="font-semibold">HEX</TableHead>
                    <TableHead className="font-semibold">Tecido</TableHead>
                    <TableHead className="font-semibold">Preview</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vinculosAgrupados.map((grupo) => {
                    const isExpanded = expandedTecidos.has(grupo.tecidoId);
                    
                    return (
                      <React.Fragment key={grupo.tecidoId}>
                        {/* Cabeçalho do grupo */}
                        <TableRow 
                          className="bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <TableCell colSpan={6} className="py-3">
                            <div className="flex items-center gap-3">
                              <div 
                                className={`transition-transform duration-200 cursor-pointer ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                onClick={() => toggleTecidoExpansion(grupo.tecidoId)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-600" />
                                )}
                              </div>
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => toggleTecidoExpansion(grupo.tecidoId)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {grupo.tecidoNome}
                                  </span>
                                  {grupo.tecidoSku && (
                                    <span className="font-mono text-sm text-gray-600">
                                      ({grupo.tecidoSku})
                                    </span>
                                  )}
                                  <span className="text-sm text-gray-500">
                                    - {grupo.vinculos.length} {grupo.vinculos.length === 1 ? 'cor' : 'cores'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleCopiarSkus(grupo.vinculos)}
                                  title="Copiar SKUs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  <span className="text-xs">SKUs</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleCopiarHex(grupo.vinculos)}
                                  title="Copiar HEX"
                                >
                                  <span className="text-xs font-bold">#</span>
                                  <span className="text-xs ml-1">HEX</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleCopiarNomes(grupo.vinculos)}
                                  title="Copiar Nomes"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Nomes</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleDownloadPreview(grupo)}
                                  title="Download Preview"
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Preview</span>
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Linhas de cores (visíveis quando expandido) */}
                        {isExpanded && grupo.vinculos.map((vinculo) => (
                          <TableRow key={vinculo.id} className="hover:bg-gray-50/50 bg-white">
                            <TableCell>
                              <span className="font-mono text-sm text-gray-700">
                                {vinculo.sku || '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {vinculo.corHex ? (
                                  <div
                                    className="w-8 h-8 rounded-md border-2 border-gray-200 shadow-sm"
                                    style={{ backgroundColor: vinculo.corHex }}
                                    title={vinculo.corHex}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-md border-2 border-dashed border-gray-300" />
                                )}
                                <div>
                                  {/* Edição inline do nome */}
                                  {editingNomeVinculoId === vinculo.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        ref={nomeInputRef}
                                        value={editingNomeValue}
                                        onChange={(e) => setEditingNomeValue(e.target.value)}
                                        onKeyDown={handleNomeKeyDown}
                                        onBlur={() => saveNome(false)}
                                        disabled={savingNome}
                                        className="h-7 text-sm py-0 px-2 w-40"
                                        placeholder="Nome da cor"
                                      />
                                      {savingNome ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                      ) : (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              saveNome(false);
                                            }}
                                            title="Salvar (Enter para próximo)"
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              cancelEditingNome();
                                            }}
                                            title="Cancelar (Esc)"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex items-center gap-1.5 group cursor-pointer"
                                      onClick={() => startEditingNome(vinculo)}
                                      title="Clique para editar o nome"
                                    >
                                      <span className="font-medium border-b border-dashed border-transparent hover:border-gray-400 transition-colors">
                                        {vinculo.corNome}
                                      </span>
                                      <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  )}
                                  {/* Edição inline do SKU da cor */}
                                  {editingSkuVinculoId === vinculo.id ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Input
                                        ref={skuInputRef}
                                        value={editingSkuValue}
                                        onChange={(e) => setEditingSkuValue(e.target.value.toUpperCase())}
                                        onKeyDown={handleSkuKeyDown}
                                        onBlur={() => saveSku(false)}
                                        disabled={savingSku}
                                        className="h-5 text-xs py-0 px-1.5 w-20 font-mono"
                                        placeholder="SKU"
                                      />
                                      {savingSku ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                      ) : (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              saveSku(false);
                                            }}
                                            title="Salvar (Enter para próximo)"
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              cancelEditingSku();
                                            }}
                                            title="Cancelar (Esc)"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex items-center gap-1 group/sku cursor-pointer mt-0.5"
                                      onClick={() => startEditingSku(vinculo)}
                                      title="Clique para editar o SKU da cor"
                                    >
                                      <span className="text-xs text-gray-500 border-b border-dashed border-transparent hover:border-gray-400 transition-colors font-mono">
                                        {vinculo.corSku || '+ SKU'}
                                      </span>
                                      <Pencil className="h-2.5 w-2.5 text-gray-400 opacity-0 group-hover/sku:opacity-100 transition-opacity" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {vinculo.corHex ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(vinculo.corHex!);
                                      toast({
                                        title: 'HEX copiado!',
                                        description: vinculo.corHex,
                                      });
                                    } catch (error) {
                                      console.error('Erro ao copiar:', error);
                                    }
                                  }}
                                  className="font-mono text-sm text-gray-700 hover:text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors cursor-pointer"
                                  title="Clique para copiar"
                                >
                                  {vinculo.corHex}
                                </button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{vinculo.tecidoNome}</div>
                                {vinculo.tecidoSku && (
                                  <div className="text-xs text-gray-500">{vinculo.tecidoSku}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {vinculo.imagemTingida ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxImage({
                                      url: vinculo.imagemTingida!,
                                      title: `${vinculo.corNome} em ${vinculo.tecidoNome}`,
                                      subtitle: `SKU ${vinculo.sku || 'sem SKU'}`,
                                    })
                                  }
                                  className="rounded-md focus:outline-none focus:ring-2 focus:ring-primary/60"
                                >
                                  <img
                                    src={vinculo.imagemTingida}
                                    alt={`${vinculo.corNome} em ${vinculo.tecidoNome}`}
                                    className="w-14 h-14 rounded-md border border-gray-200 shadow-sm object-cover hover:scale-110 transition-transform"
                                  />
                                </button>
                              ) : (
                                <div className="w-14 h-14 rounded-md border border-dashed border-gray-300 flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 text-gray-300" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingVinculoId(vinculo.id);
                                  }}
                                  title="Editar vínculo"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteVinculo(vinculo);
                                  }}
                                  title="Excluir vínculo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ConfirmDialog genérico */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Confirmar"
        variant="destructive"
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
      />

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
