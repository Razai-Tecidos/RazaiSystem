import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useTecidos } from '@/hooks/useTecidos';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useTamanhos } from '@/hooks/useTamanhos';
import { useShopeeCategories } from '@/hooks/useShopeeCategories';
import { useShopeeProducts } from '@/hooks/useShopeeProducts';
import { useShopee } from '@/hooks/useShopee';
import { Tecido } from '@/types/tecido.types';
import { ShopeeCategory, CreateShopeeProductData, ShopeeProduct, ProductAttributeValue, ExtendedDescription, WholesaleTier } from '@/types/shopee-product.types';
import { CategoryAttributes } from '@/components/Shopee/CategoryAttributes';
import { BrandSelector } from '@/components/Shopee/BrandSelector';
import { ShippingConfig } from '@/components/Shopee/ShippingConfig';
import { ExtendedDescriptionEditor } from '@/components/Shopee/ExtendedDescriptionEditor';
import { WholesaleConfig } from '@/components/Shopee/WholesaleConfig';
import { SizeChartSelector } from '@/components/Shopee/SizeChartSelector';
import { AdPreview } from '@/components/Shopee/AdPreview';
import { generateBrandOverlay } from '@/lib/brandOverlay';
import { FieldHint } from '@/components/Shopee/FieldHint';
import { FiscalInfo } from '@/components/Shopee/FiscalInfo';
import { 
  Loader2, 
  Save, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  ImageIcon,
  Package,
  Palette,
  Ruler,
  DollarSign,
  AlertCircle,
  Eye,
  Search,
  CheckCircle2,
  XCircle,
  Upload,
  X,
} from 'lucide-react';

interface CriarAnuncioShopeeProps {
  onNavigateHome?: () => void;
  onNavigateToAnuncios?: () => void;
  draftId?: string;
}

type Step = 'tecido' | 'cores' | 'configuracoes' | 'preview';

interface CorConfig {
  cor_id: string;
  cor_nome: string;
  cor_hex?: string;
  imagem_url?: string;
  estoque: number;
  selected: boolean;
}

export function CriarAnuncioShopee({ 
  onNavigateHome, 
  onNavigateToAnuncios,
  draftId 
}: CriarAnuncioShopeeProps) {
  const { toast } = useToast();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { vinculos, getVinculosByTecido } = useCorTecido();
  const { tamanhos, loading: loadingTamanhos } = useTamanhos();
  const { 
    loading: loadingCategories, 
    error: categoriesError,
    loadCategories,
    getRootCategories,
    getChildCategories,
  } = useShopeeCategories();
  const { 
    createProduct, 
    updateProduct, 
    publishProduct,
    getDefaultValues,
    getProduct,
    saving,
    publishing,
  } = useShopeeProducts();
  const { shops } = useShopee();

  // Estado do formulário
  const [currentStep, setCurrentStep] = useState<Step>('tecido');
  const [selectedTecido, setSelectedTecido] = useState<Tecido | null>(null);
  const [coresConfig, setCoresConfig] = useState<CorConfig[]>([]);
  const [selectedTamanhos, setSelectedTamanhos] = useState<string[]>([]);
  const [precoUnico, setPrecoUnico] = useState<number>(0);
  const [precosPorTamanho, setPrecosPorTamanho] = useState<Record<string, number>>({});
  const [estoquePadrao, setEstoquePadrao] = useState<number>(100);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string>('');
  const [peso, setPeso] = useState<number>(0.3);
  const [dimensoes, setDimensoes] = useState({ comprimento: 30, largura: 30, altura: 10 });
  const [descricaoCustomizada, setDescricaoCustomizada] = useState<string>('');
  const [usarImagensPublicas, setUsarImagensPublicas] = useState<boolean>(true);
  const [imagensPrincipais, setImagensPrincipais] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [productId, setProductId] = useState<string | null>(draftId?.startsWith('duplicate_') ? null : draftId || null);
  
  // Novos campos opcionais
  const [atributos, setAtributos] = useState<ProductAttributeValue[]>([]);
  const [brandId, setBrandId] = useState<number | undefined>(0);
  const [brandNome, setBrandNome] = useState<string>('');
  const [logisticInfo, setLogisticInfo] = useState<Array<{ logistic_id: number; enabled: boolean; shipping_fee?: number; is_free?: boolean }>>([]);
  const [extendedDescEnabled, setExtendedDescEnabled] = useState(false);
  const [extendedDescription, setExtendedDescription] = useState<ExtendedDescription | undefined>(undefined);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>([]);
  const [sizeChartId, setSizeChartId] = useState<number | undefined>(undefined);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [overlayImages, setOverlayImages] = useState<Record<string, string>>({});

  // Informações fiscais
  const [ncmPadrao, setNcmPadrao] = useState<string>('58013600');
  
  // Busca de categoria
  const [categorySearchTerm, setCategorySearchTerm] = useState<string>('');
  
  // Validação inline
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Estado de navegação de categorias
  const [categoryPath, setCategoryPath] = useState<ShopeeCategory[]>([]);

  // Shop selecionada
  const selectedShop = shops[0];

  // Carrega categorias quando shop está disponível (silencioso na carga inicial)
  useEffect(() => {
    if (selectedShop?.shopId) {
      loadCategories(selectedShop.shopId, false, true);
    }
  }, [selectedShop?.shopId, loadCategories]);

  // Carrega rascunho ou duplicação se draftId fornecido
  useEffect(() => {
    if (draftId) {
      if (draftId.startsWith('duplicate_')) {
        const originalId = draftId.replace('duplicate_', '');
        loadDraftForDuplicate(originalId);
      } else {
        loadDraft(draftId);
      }
    }
  }, [draftId]);

  // Carrega valores padrão quando tecido é selecionado
  useEffect(() => {
    if (selectedTecido) {
      loadDefaultValues();
    }
  }, [selectedTecido]);

  const loadDraft = async (id: string) => {
    const product = await getProduct(id);
    if (product) {
      populateFromProduct(product, id);
    }
  };

  const loadDraftForDuplicate = async (originalId: string) => {
    const product = await getProduct(originalId);
    if (product) {
      // Carrega dados mas NÃO define productId (cria como novo)
      populateFromProduct(product, null);
    }
  };

  const populateFromProduct = async (product: ShopeeProduct, id: string | null) => {
    // Preenche formulário com dados do produto
    const tecido = tecidos.find(t => t.id === product.tecido_id);
    if (tecido) {
      setSelectedTecido(tecido);
      await getVinculosByTecido(tecido.id);
    }
    setPrecoUnico(product.preco_base);
    setEstoquePadrao(product.estoque_padrao);
    setCategoriaId(product.categoria_id);
    setCategoriaNome(product.categoria_nome || '');
    setPeso(product.peso);
    setDimensoes(product.dimensoes);
    setDescricaoCustomizada(product.descricao_customizada || '');
    setUsarImagensPublicas(product.usar_imagens_publicas);
    if (product.imagens_principais && product.imagens_principais.length > 0) {
      setImagensPrincipais(product.imagens_principais);
    }
    if (id) {
      setProductId(id);
    }
    
    // Configura cores (deduplica por cor_id)
    const coresMap = new Map<string, CorConfig>();
    product.modelos.forEach(m => {
      if (m.cor_id && !coresMap.has(m.cor_id)) {
        coresMap.set(m.cor_id, {
          cor_id: m.cor_id,
          cor_nome: m.cor_nome || '',
          imagem_url: m.imagem_url,
          estoque: m.estoque,
          selected: true,
        });
      }
    });
    setCoresConfig(Array.from(coresMap.values()));
    
    // Configura tamanhos
    const tamanhoIds = product.tier_variations
      .find(t => t.tier_name === 'Tamanho')?.options
      .map((_, i) => product.modelos.find(m => m.tier_index[1] === i)?.tamanho_id)
      .filter(Boolean) as string[] || [];
    setSelectedTamanhos(tamanhoIds);
  };

  const loadDefaultValues = async () => {
    const defaults = await getDefaultValues(selectedTecido?.largura);
    if (defaults) {
      if (defaults.preco_base) setPrecoUnico(defaults.preco_base);
      if (defaults.estoque_padrao) setEstoquePadrao(defaults.estoque_padrao);
      if (defaults.categoria_id) setCategoriaId(defaults.categoria_id);
      if (defaults.categoria_nome) setCategoriaNome(defaults.categoria_nome);
      setPeso(defaults.peso);
      setDimensoes(defaults.dimensoes);
      setUsarImagensPublicas(defaults.usar_imagens_publicas);
      if (defaults.descricao_template) setDescricaoCustomizada(defaults.descricao_template);
      if (defaults.ncm_padrao) setNcmPadrao(defaults.ncm_padrao);
    }
  };

  // Quando tecido é selecionado, carrega vínculos
  const handleTecidoSelect = async (tecidoId: string) => {
    const tecido = tecidos.find(t => t.id === tecidoId);
    if (tecido) {
      setSelectedTecido(tecido);
      await getVinculosByTecido(tecidoId);
      
      // Atualiza largura nas dimensões
      if (tecido.largura) {
        setDimensoes(prev => ({
          ...prev,
          largura: Math.round(tecido.largura! * 100),
        }));
      }
    }
  };

  // Quando vínculos são carregados, configura cores filtrando pelo tecido selecionado
  useEffect(() => {
    if (vinculos.length > 0 && selectedTecido && !productId && coresConfig.length === 0) {
      const vinculosDoTecido = vinculos.filter(v => v.tecidoId === selectedTecido.id);
      const cores = vinculosDoTecido.map(v => ({
        cor_id: v.corId,
        cor_nome: v.corNome,
        cor_hex: v.corHex,
        imagem_url: v.imagemTingida,
        estoque: estoquePadrao,
        selected: false,
      }));
      setCoresConfig(cores);
    }
  }, [vinculos, selectedTecido, productId, estoquePadrao, coresConfig.length]);

  // Toggle seleção de cor
  const toggleCorSelection = (corId: string) => {
    setCoresConfig(prev => prev.map(c => 
      c.cor_id === corId ? { ...c, selected: !c.selected } : c
    ));
  };

  // Atualiza estoque de uma cor
  const updateCorEstoque = (corId: string, value: number) => {
    setCoresConfig(prev => prev.map(c => 
      c.cor_id === corId ? { ...c, estoque: value } : c
    ));
  };

  // Atualiza preço de um tamanho
  const updatePrecoTamanho = (tamanhoId: string, value: number) => {
    setPrecosPorTamanho(prev => ({ ...prev, [tamanhoId]: value }));
  };

  // Toggle seleção de tamanho
  const toggleTamanhoSelection = (tamanhoId: string) => {
    setSelectedTamanhos(prev => 
      prev.includes(tamanhoId) 
        ? prev.filter(id => id !== tamanhoId)
        : [...prev, tamanhoId]
    );
  };

  // Navegação de categorias
  const handleCategorySelect = (category: ShopeeCategory) => {
    if (category.has_children) {
      setCategoryPath(prev => [...prev, category]);
    } else {
      setCategoriaId(category.id);
      setCategoriaNome(category.display_name);
    }
  };

  const handleCategoryBack = () => {
    setCategoryPath(prev => prev.slice(0, -1));
  };

  // Categorias atuais para exibir
  const currentCategories = categoryPath.length === 0
    ? getRootCategories()
    : getChildCategories(categoryPath[categoryPath.length - 1].id);

  // Preço efetivo: se tem tamanhos, todos precisam ter preço; se não, usa precoUnico
  const temPrecoValido = selectedTamanhos.length > 0
    ? selectedTamanhos.every(id => (precosPorTamanho[id] || 0) > 0)
    : precoUnico > 0;

  // Preço mínimo (para exibição)
  const precoMinimo = selectedTamanhos.length > 0
    ? Math.min(...selectedTamanhos.map(id => precosPorTamanho[id] || 0).filter(p => p > 0), Infinity)
    : precoUnico;

  // Preço base para a API (o menor preço ou preço único)
  const precoBaseParaApi = selectedTamanhos.length > 0
    ? (precoMinimo === Infinity ? 0 : precoMinimo)
    : precoUnico;

  // Validação de etapas
  const canProceedFromTecido = selectedTecido !== null;
  const canProceedFromCores = coresConfig.some(c => c.selected);
  const canProceedFromConfiguracoes = 
    temPrecoValido && 
    categoriaId !== null && 
    peso > 0 && 
    dimensoes.comprimento > 0 && 
    dimensoes.largura > 0 && 
    dimensoes.altura > 0;

  // Navegação entre etapas
  const goToNextStep = () => {
    const steps: Step[] = ['tecido', 'cores', 'configuracoes', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const steps: Step[] = ['tecido', 'cores', 'configuracoes', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Salvar rascunho
  const handleSaveDraft = async () => {
    if (!selectedShop || !selectedTecido) {
      toast({
        title: 'Erro',
        description: 'Selecione uma loja e um tecido',
        variant: 'destructive',
      });
      return;
    }

    const selectedCores = coresConfig.filter(c => c.selected);
    if (selectedCores.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos uma cor',
        variant: 'destructive',
      });
      return;
    }

    const data: CreateShopeeProductData = {
      shop_id: selectedShop.shopId,
      tecido_id: selectedTecido.id,
      cores: selectedCores.map(c => ({
        cor_id: c.cor_id,
        estoque: c.estoque || estoquePadrao,
      })),
      tamanhos: selectedTamanhos.length > 0 ? selectedTamanhos : undefined,
      precos_por_tamanho: selectedTamanhos.length > 0 ? precosPorTamanho : undefined,
      preco_base: precoBaseParaApi,
      estoque_padrao: estoquePadrao,
      categoria_id: categoriaId!,
      peso,
      dimensoes,
      descricao_customizada: descricaoCustomizada || undefined,
      usar_imagens_publicas: usarImagensPublicas,
      imagens_principais: imagensPrincipais.length > 0 ? imagensPrincipais : undefined,
      atributos: atributos.length > 0 ? atributos : undefined,
      brand_id: brandId,
      brand_nome: brandNome || undefined,
      size_chart_id: sizeChartId,
      description_type: extendedDescEnabled ? 'extended' : 'normal',
      extended_description: extendedDescEnabled ? extendedDescription : undefined,
      wholesale: wholesaleEnabled && wholesaleTiers.length > 0 ? wholesaleTiers : undefined,
      ncm_padrao: ncmPadrao || undefined,
    };

    let result;
    if (productId) {
      result = await updateProduct(productId, data);
    } else {
      result = await createProduct(data);
      if (result) {
        setProductId(result.id);
      }
    }

    return result;
  };

  // Publicar
  const handlePublish = async () => {
    // Primeiro salva o rascunho
    const saved = await handleSaveDraft();
    if (!saved) return;

    // Depois publica
    const result = await publishProduct(saved.id);
    if (result) {
      onNavigateToAnuncios?.();
    }
  };

  // Cores selecionadas
  const selectedCores = coresConfig.filter(c => c.selected);

  // Calcula total de combinações
  const totalCombinations = selectedCores.length * (selectedTamanhos.length || 1);

  // Nome auto-gerado do anúncio
  const nomeAutoGerado = useMemo(() => {
    if (!selectedTecido) return '';
    const cores = selectedCores.map(c => c.cor_nome).join(', ');
    const base = `Tecido ${selectedTecido.nome}`;
    return cores ? `${base} - ${cores}` : base;
  }, [selectedTecido, selectedCores]);

  // Descrição auto-gerada
  const descricaoAutoGerada = useMemo(() => {
    if (!selectedTecido) return '';
    const lines = [`Tecido ${selectedTecido.nome} de alta qualidade.`];
    if (selectedTecido.largura) lines.push(`Largura: ${selectedTecido.largura}m`);
    if (selectedCores.length > 0) {
      lines.push(`Cores disponíveis: ${selectedCores.map(c => c.cor_nome).join(', ')}`);
    }
    if (selectedTamanhos.length > 0) {
      const nomesTamanhos = selectedTamanhos.map(id => tamanhos.find(t => t.id === id)?.nome).filter(Boolean);
      lines.push(`Tamanhos: ${nomesTamanhos.join(', ')}`);
    }
    return lines.join('\n');
  }, [selectedTecido, selectedCores, selectedTamanhos, tamanhos]);

  // Marcar campo como "tocado" (para validação inline)
  const markTouched = useCallback((field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  }, []);

  // Validação detalhada para Step 3
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!temPrecoValido) {
      if (selectedTamanhos.length > 0) {
        errors.preco = 'Defina o preço para todos os tamanhos selecionados';
      } else {
        errors.preco = 'Preço deve ser maior que zero';
      }
    }
    if (!categoriaId) errors.categoria = 'Selecione uma categoria';
    if (peso <= 0) errors.peso = 'Peso deve ser maior que zero';
    if (dimensoes.comprimento <= 0) errors.comprimento = 'Comprimento deve ser maior que zero';
    if (dimensoes.largura <= 0) errors.largura = 'Largura deve ser maior que zero';
    if (dimensoes.altura <= 0) errors.altura = 'Altura deve ser maior que zero';
    return errors;
  }, [temPrecoValido, selectedTamanhos, categoriaId, peso, dimensoes]);

  // Progresso da etapa atual
  const stepProgress = useMemo(() => {
    if (currentStep === 'tecido') return selectedTecido ? 100 : 0;
    if (currentStep === 'cores') return selectedCores.length > 0 ? 100 : 0;
    if (currentStep === 'configuracoes') {
      const totalFields = 6;
      let filled = 0;
      if (temPrecoValido) filled++;
      if (estoquePadrao > 0) filled++;
      if (categoriaId) filled++;
      if (peso > 0) filled++;
      if (dimensoes.comprimento > 0 && dimensoes.largura > 0) filled++;
      if (dimensoes.altura > 0) filled++;
      return Math.round((filled / totalFields) * 100);
    }
    return 100;
  }, [currentStep, selectedTecido, selectedCores, temPrecoValido, estoquePadrao, categoriaId, peso, dimensoes]);

  // Gerar overlays de marca quando entrar no preview
  useEffect(() => {
    if (currentStep !== 'preview') return;
    selectedCores.forEach(cor => {
      if (cor.imagem_url && !overlayImages[cor.cor_id]) {
        generateBrandOverlay(cor.imagem_url, cor.cor_nome).then(dataUrl => {
          setOverlayImages(prev => ({ ...prev, [cor.cor_id]: dataUrl }));
        }).catch(() => {
          // Silencioso: se falhar, mostra imagem original
        });
      }
    });
  }, [currentStep, selectedCores]);

  // Filtrar categorias por busca
  const filteredCategories = useMemo(() => {
    if (!categorySearchTerm.trim()) return currentCategories;
    const term = categorySearchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return currentCategories.filter(c => 
      c.display_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term)
    );
  }, [currentCategories, categorySearchTerm]);

  // Selecionar todas as cores
  const handleSelectAllCores = useCallback(() => {
    const allSelected = coresConfig.every(c => c.selected);
    setCoresConfig(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  }, [coresConfig]);

  // Upload de imagens principais
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (files: FileList) => {
    if (imagensPrincipais.length + files.length > 9) {
      toast({
        title: 'Limite de imagens',
        description: 'O máximo é 9 imagens principais por anúncio.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImages(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, `shopee-anuncios/${productId || 'temp'}/${timestamp}_${safeName}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newUrls.push(url);
      } catch (err: any) {
        console.error('Erro ao fazer upload:', err);
        toast({
          title: 'Erro no upload',
          description: `Falha ao enviar ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    if (newUrls.length > 0) {
      setImagensPrincipais(prev => [...prev, ...newUrls]);
    }
    setUploadingImages(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagensPrincipais, productId, toast]);

  const removeMainImage = useCallback((index: number) => {
    setImagensPrincipais(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveMainImage = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= imagensPrincipais.length) return;
    setImagensPrincipais(prev => {
      const arr = [...prev];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });
  }, [imagensPrincipais.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Anúncios Shopee', onClick: onNavigateToAnuncios },
          { label: productId ? 'Editar Anúncio' : 'Criar Anúncio' }
        ]}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Indicador de etapas com progresso */}
        <div className="mb-4 sm:mb-8">
          {/* Mobile: compacto */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between mb-2">
              {[
                { key: 'tecido', label: 'Tecido', icon: Package },
                { key: 'cores', label: 'Cores', icon: Palette },
                { key: 'configuracoes', label: 'Config', icon: Ruler },
                { key: 'preview', label: 'Preview', icon: ImageIcon },
              ].map((step, index) => {
                const stepIndex = ['tecido', 'cores', 'configuracoes', 'preview'].indexOf(currentStep);
                const isCompleted = index < stepIndex;
                const isCurrent = currentStep === step.key;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <step.icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          </div>

          {/* Desktop: full indicators */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-center space-x-4">
              {[
                { key: 'tecido', label: 'Tecido', icon: Package },
                { key: 'cores', label: 'Cores', icon: Palette },
                { key: 'configuracoes', label: 'Configurações', icon: Ruler },
                { key: 'preview', label: 'Preview', icon: ImageIcon },
              ].map((step, index) => {
                const stepIndex = ['tecido', 'cores', 'configuracoes', 'preview'].indexOf(currentStep);
                const isCompleted = index < stepIndex;
                const isCurrent = currentStep === step.key;
                return (
                  <div key={step.key} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`ml-2 text-sm font-medium ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {index < 3 && (
                      <ChevronRight className="w-5 h-5 mx-2 text-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 max-w-md mx-auto">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center mt-1">
                {stepProgress}% desta etapa
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 pb-28 sm:pb-6">
          {/* Etapa 1: Seleção de Tecido */}
          {currentStep === 'tecido' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Selecione o Tecido</h2>
              <p className="text-sm text-gray-500 mb-4">
                Escolha o tecido base para o anúncio. As cores e imagens vinculadas serão carregadas automaticamente.
              </p>
              
              {!selectedShop && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    <span className="text-yellow-800">
                      Nenhuma loja Shopee conectada. Conecte uma loja primeiro.
                    </span>
                  </div>
                </div>
              )}

              {loadingTecidos ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="border-2 border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="w-full h-32 bg-gray-200 rounded mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {tecidos.filter(t => t.tipo === 'liso').map(tecido => (
                    <div
                      key={tecido.id}
                      onClick={() => handleTecidoSelect(tecido.id)}
                      className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                        selectedTecido?.id === tecido.id
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {tecido.imagemPadrao && (
                        <img
                          src={tecido.imagemPadrao}
                          alt={tecido.nome}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}
                      <h3 className="font-medium text-gray-900">{tecido.nome}</h3>
                      <p className="text-sm text-gray-500">SKU: {tecido.sku}</p>
                      {tecido.largura && (
                        <p className="text-sm text-gray-500">Largura: {tecido.largura}m</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Etapa 2: Seleção de Cores */}
          {currentStep === 'cores' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Selecione as Cores</h2>
              <p className="text-sm text-gray-500 mb-4">
                Cada cor selecionada será uma variação do anúncio. A imagem vinculada ao tecido será usada como imagem da variação.
              </p>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <FieldHint
                    label="Cores Disponíveis"
                    hint="Cores vinculadas a este tecido no sistema. Cada cor vira uma variação de 'Cor' na Shopee."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllCores}
                  >
                    {coresConfig.every(c => c.selected) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {coresConfig.map(cor => (
                    <div
                      key={cor.cor_id}
                      onClick={() => toggleCorSelection(cor.cor_id)}
                      className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                        cor.selected
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {cor.imagem_url && (
                        <img
                          src={cor.imagem_url}
                          alt={cor.cor_nome}
                          className="w-full h-24 object-cover rounded mb-2"
                        />
                      )}
                      <div className="flex items-center">
                        <Checkbox checked={cor.selected} className="mr-2" />
                        <span className="font-medium">{cor.cor_nome}</span>
                      </div>
                      {cor.cor_hex && (
                        <div
                          className="w-6 h-6 rounded-full border mt-2"
                          style={{ backgroundColor: cor.cor_hex }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Estoque por Cor */}
              {selectedCores.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <FieldHint
                    label="Estoque por Cor"
                    hint="Quantidade inicial de cada cor. Será sincronizado com o módulo de estoque Shopee."
                    className="mb-4"
                  />
                  <div className="space-y-3">
                    {selectedCores.map(cor => (
                      <div key={cor.cor_id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 flex items-center gap-2">
                          {cor.cor_hex && (
                            <div className="w-5 h-5 rounded-full border flex-shrink-0" style={{ backgroundColor: cor.cor_hex }} />
                          )}
                          <span className="font-medium text-sm">{cor.cor_nome}</span>
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            min="0"
                            value={cor.estoque}
                            onChange={(e) => updateCorEstoque(cor.cor_id, parseInt(e.target.value) || 0)}
                            placeholder="Qtd"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seleção de Tamanhos (opcional) */}
              <div className="mt-6 border-t pt-6">
                <FieldHint
                  label="Tamanhos (Opcional)"
                  hint="Adiciona uma segunda camada de variação (Tier 2). Ex: cada cor terá P, M, G. Se não selecionar, cada cor será uma variação única."
                  description="Cada combinação cor × tamanho gera um SKU separado na Shopee."
                  className="mb-4"
                />
                
                {loadingTamanhos ? (
                  <div className="flex gap-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-10 w-16 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tamanhos.map(tamanho => (
                      <Button
                        key={tamanho.id}
                        variant={selectedTamanhos.includes(tamanho.id) ? 'default' : 'outline'}
                        onClick={() => toggleTamanhoSelection(tamanho.id)}
                      >
                        {tamanho.nome}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preço por Tamanho ou Preço Único */}
              {selectedCores.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  {selectedTamanhos.length > 0 ? (
                    <>
                      <FieldHint
                        label="Preço por Tamanho"
                        hint="Defina o preço de venda para cada tamanho. O mesmo preço será aplicado a todas as cores. Cada combinação cor × tamanho terá esse preço na Shopee."
                        required
                        className="mb-4"
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {selectedTamanhos.map(id => {
                          const tam = tamanhos.find(t => t.id === id);
                          return (
                            <div key={id} className="p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm font-medium block mb-1">{tam?.nome || id}</span>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={precosPorTamanho[id] || ''}
                                  onChange={(e) => updatePrecoTamanho(id, parseFloat(e.target.value) || 0)}
                                  className="pl-7 text-sm"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <FieldHint
                      label="Preço de Venda"
                      required
                      hint="Preço de venda aplicado a todas as variações de cor. Mínimo aceito pela Shopee: R$ 1,00."
                    >
                      <div className="relative max-w-xs">
                        <DollarSign className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={precoUnico || ''}
                          onChange={(e) => setPrecoUnico(parseFloat(e.target.value) || 0)}
                          className="pl-10"
                          placeholder="0.00"
                        />
                      </div>
                    </FieldHint>
                  )}
                </div>
              )}

              {/* Resumo de combinações */}
              {selectedCores.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{totalCombinations}</strong> combinações serão criadas
                    ({selectedCores.length} cores × {selectedTamanhos.length || 1} tamanhos)
                  </p>
                  {selectedTamanhos.length > 0 && precoMinimo > 0 && precoMinimo !== Infinity && (
                    <p className="text-xs text-blue-600 mt-1">
                      Preço a partir de R$ {precoMinimo.toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Etapa 3: Configurações */}
          {currentStep === 'configuracoes' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Configurações do Anúncio</h2>
              <p className="text-sm text-gray-500 mb-6">
                Configure preço, envio, categoria e informações fiscais. Campos com <span className="text-red-500">*</span> são obrigatórios.
              </p>
              
              {/* Alerta de campos faltantes */}
              {Object.keys(validationErrors).length > 0 && touchedFields.size > 0 && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Campos que precisam de atenção:</p>
                      <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                        {Object.entries(validationErrors)
                          .filter(([key]) => touchedFields.has(key))
                          .map(([key, msg]) => (
                            <li key={key}>• {msg}</li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resumo de Preços (somente leitura — definidos na Step 2) */}
                <div className="md:col-span-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Preços definidos</span>
                    <span className="text-xs text-green-600">(editável na etapa "Cores")</span>
                  </div>
                  {selectedTamanhos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTamanhos.map(id => {
                        const tam = tamanhos.find(t => t.id === id);
                        const preco = precosPorTamanho[id] || 0;
                        return (
                          <span key={id} className={`px-2 py-1 rounded text-sm ${preco > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {tam?.nome}: {preco > 0 ? `R$ ${preco.toFixed(2)}` : 'Não definido'}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`text-sm ${precoUnico > 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {precoUnico > 0 ? `R$ ${precoUnico.toFixed(2)} para todas as variações` : 'Preço não definido — volte à etapa anterior'}
                    </p>
                  )}
                </div>

                {/* Estoque Padrão */}
                <FieldHint
                  label="Estoque Padrão"
                  hint="Quantidade inicial para cores sem estoque individual definido. Será o estoque de cada variação na Shopee."
                  description="Aplicado a todas as variações que não tenham estoque individual."
                >
                  <Input
                    type="number"
                    min="0"
                    value={estoquePadrao}
                    onChange={(e) => setEstoquePadrao(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </FieldHint>

                {/* Peso */}
                <FieldHint
                  label="Peso (kg)"
                  required
                  hint="Peso da embalagem com o produto. Usado para calcular frete. Para tecidos, considere o peso por metro."
                  description="Peso em quilogramas."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={peso}
                    onChange={(e) => setPeso(parseFloat(e.target.value) || 0)}
                    onBlur={() => markTouched('peso')}
                    className={touchedFields.has('peso') && validationErrors.peso ? 'border-red-400' : ''}
                    placeholder="0.1"
                  />
                </FieldHint>

                {/* Dimensões */}
                <div className="md:col-span-2">
                  <FieldHint
                    label="Dimensões da Embalagem (cm)"
                    required
                    hint="Tamanho da embalagem em centímetros. Usado pela Shopee para calcular frete e definir o tipo de envio. A largura é preenchida automaticamente pela largura do tecido."
                    description="Comprimento × Largura × Altura em cm."
                  />
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <span className="text-xs text-gray-500">Comprimento</span>
                      <Input
                        type="number"
                        min="0"
                        value={dimensoes.comprimento}
                        onChange={(e) => setDimensoes(prev => ({ ...prev, comprimento: parseInt(e.target.value) || 0 }))}
                        onBlur={() => markTouched('comprimento')}
                        className={touchedFields.has('comprimento') && validationErrors.comprimento ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Largura</span>
                      <Input
                        type="number"
                        min="0"
                        value={dimensoes.largura}
                        onChange={(e) => setDimensoes(prev => ({ ...prev, largura: parseInt(e.target.value) || 0 }))}
                        onBlur={() => markTouched('largura')}
                        className={touchedFields.has('largura') && validationErrors.largura ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Altura</span>
                      <Input
                        type="number"
                        min="0"
                        value={dimensoes.altura}
                        onChange={(e) => setDimensoes(prev => ({ ...prev, altura: parseInt(e.target.value) || 0 }))}
                        onBlur={() => markTouched('altura')}
                        className={touchedFields.has('altura') && validationErrors.altura ? 'border-red-400' : ''}
                      />
                    </div>
                  </div>
                </div>

                {/* Categoria */}
                <div className="md:col-span-2">
                  <FieldHint
                    label="Categoria Shopee"
                    required
                    hint="Categoria onde o produto será listado na Shopee. Navegue pelas subcategorias até encontrar a mais específica. Ex: Casa > Cama, Mesa e Banho > Tecidos"
                    description={categoriaId ? undefined : "Navegue e selecione a categoria final (sem filhos)."}
                  />
                  {categoriaId ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {categoriaNome}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCategoriaId(null);
                          setCategoriaNome('');
                          setCategoryPath([]);
                          setCategorySearchTerm('');
                        }}
                      >
                        Alterar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 border rounded-lg p-4">
                      {/* Busca de categoria */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Buscar categoria..."
                          value={categorySearchTerm}
                          onChange={(e) => setCategorySearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {categoryPath.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <Button variant="ghost" size="sm" onClick={() => { handleCategoryBack(); setCategorySearchTerm(''); }}>
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Voltar
                          </Button>
                          <span className="text-sm text-gray-500">
                            {categoryPath.map(c => c.display_name).join(' > ')}
                          </span>
                        </div>
                      )}
                      
                      {loadingCategories ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                          ))}
                        </div>
                      ) : categoriesError ? (
                        <div className="flex flex-col items-center py-6 text-center">
                          <AlertCircle className="w-8 h-8 text-yellow-500 mb-2" />
                          <p className="text-sm text-gray-600 mb-3">Não foi possível carregar as categorias.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedShop && loadCategories(selectedShop.shopId, false, false)}
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      ) : filteredCategories.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">Nenhuma categoria encontrada.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                          {filteredCategories.map(category => (
                            <Button
                              key={category.id}
                              variant="outline"
                              className="justify-start text-left h-auto py-2"
                              onClick={() => { handleCategorySelect(category); setCategorySearchTerm(''); }}
                            >
                              <span className="truncate">{category.display_name}</span>
                              {category.has_children && (
                                <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" />
                              )}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Atributos da Categoria */}
                {categoriaId && selectedShop && (
                  <div className="md:col-span-2">
                    <CategoryAttributes
                      shopId={selectedShop.shopId}
                      categoryId={categoriaId}
                      values={atributos}
                      onChange={setAtributos}
                    />
                  </div>
                )}

                {/* Seletor de Marca */}
                {categoriaId && selectedShop && (
                  <div className="md:col-span-2">
                    <BrandSelector
                      shopId={selectedShop.shopId}
                      categoryId={categoriaId}
                      value={brandId}
                      onChange={(id, nome) => {
                        setBrandId(id);
                        setBrandNome(nome);
                      }}
                    />
                  </div>
                )}

                {/* Informações Fiscais */}
                <div className="md:col-span-2">
                  <FiscalInfo
                    ncm={ncmPadrao}
                    onNcmChange={setNcmPadrao}
                    tecidoNome={selectedTecido?.nome}
                    corExemplo={selectedCores[0]?.cor_nome}
                    tamanhoExemplo={selectedTamanhos.length > 0 ? tamanhos.find(t => t.id === selectedTamanhos[0])?.nome : undefined}
                  />
                </div>

                {/* Configuração de Frete */}
                {selectedShop && (
                  <div className="md:col-span-2">
                    <ShippingConfig
                      shopId={selectedShop.shopId}
                      value={logisticInfo}
                      onChange={setLogisticInfo}
                    />
                  </div>
                )}

                {/* Size Chart */}
                {categoriaId && selectedShop && (
                  <div className="md:col-span-2">
                    <SizeChartSelector
                      shopId={selectedShop.shopId}
                      categoryId={categoriaId}
                      value={sizeChartId}
                      onChange={setSizeChartId}
                    />
                  </div>
                )}

                {/* Descrição Customizada */}
                <div className="md:col-span-2">
                  <FieldHint
                    label="Descrição do Anúncio"
                    hint="Texto que aparece na página do produto na Shopee. Se deixar vazio, uma descrição será gerada automaticamente com os dados do tecido."
                    description={`${(descricaoCustomizada || descricaoAutoGerada).length} caracteres`}
                  >
                    <Textarea
                      value={descricaoCustomizada}
                      onChange={(e) => setDescricaoCustomizada(e.target.value)}
                      placeholder={descricaoAutoGerada || 'Deixe em branco para usar descrição automática baseada no tecido'}
                      rows={4}
                    />
                  </FieldHint>
                </div>

                {/* Descrição Estendida */}
                <div className="md:col-span-2">
                  <ExtendedDescriptionEditor
                    value={extendedDescription}
                    onChange={setExtendedDescription}
                    enabled={extendedDescEnabled}
                    onToggle={setExtendedDescEnabled}
                  />
                </div>

                {/* Atacado */}
                <div className="md:col-span-2">
                  <WholesaleConfig
                    value={wholesaleTiers}
                    onChange={setWholesaleTiers}
                    enabled={wholesaleEnabled}
                    onToggle={setWholesaleEnabled}
                    basePrice={precoBaseParaApi}
                  />
                </div>

                {/* Imagens Principais do Anúncio */}
                <div className="md:col-span-2">
                  <FieldHint
                    label="Imagens Principais do Anúncio"
                    hint="Essas são as fotos da galeria principal do anúncio. A primeira imagem será a capa. Máximo 9 imagens. Recomendado: quadradas (1:1), mínimo 500x500px."
                    description={`${imagensPrincipais.length}/9 imagens`}
                  >
                    <div className="mt-2 space-y-3">
                      {/* Grid de imagens */}
                      {imagensPrincipais.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {imagensPrincipais.map((url, index) => (
                            <div key={index} className="relative group aspect-square border rounded-lg overflow-hidden bg-gray-50">
                              <img
                                src={url}
                                alt={`Imagem ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                                  Capa
                                </span>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveMainImage(index, index - 1)}
                                    className="bg-white rounded-full p-1.5 shadow hover:bg-gray-100"
                                    title="Mover para esquerda"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {index < imagensPrincipais.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveMainImage(index, index + 1)}
                                    className="bg-white rounded-full p-1.5 shadow hover:bg-gray-100"
                                    title="Mover para direita"
                                  >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeMainImage(index)}
                                  className="bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600"
                                  title="Remover"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botão de upload */}
                      {imagensPrincipais.length < 9 && (
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImages}
                            className="min-h-[44px]"
                          >
                            {uploadingImages ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {uploadingImages ? 'Enviando...' : 'Adicionar Imagens'}
                          </Button>
                        </div>
                      )}

                      {imagensPrincipais.length === 0 && (
                        <p className="text-sm text-amber-600 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Adicione pelo menos 1 imagem. Se não adicionar, será usada a imagem padrão do tecido.
                        </p>
                      )}
                    </div>
                  </FieldHint>
                </div>

                {/* Método de Upload */}
                <div className="md:col-span-2">
                  <FieldHint
                    label="Método de Upload de Imagens"
                    hint="URLs Públicas: usa links diretos das imagens (mais rápido). Upload Direto: envia via API da Shopee (mais confiável, funciona mesmo se as URLs mudarem)."
                  >
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={usarImagensPublicas}
                          onChange={() => setUsarImagensPublicas(true)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">URLs Públicas (mais rápido)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!usarImagensPublicas}
                          onChange={() => setUsarImagensPublicas(false)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Upload Direto (mais robusto)</span>
                      </label>
                    </div>
                  </FieldHint>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 4: Preview */}
          {currentStep === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Preview do Anúncio</h2>
                  <p className="text-sm text-gray-500">Revise tudo antes de publicar. Corrija o que for necessário voltando às etapas anteriores.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewModal(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Simulação Shopee
                </Button>
              </div>

              {/* Checklist de validação */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-medium mb-3">Checklist de Publicação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { ok: !!selectedTecido, label: 'Tecido selecionado' },
                    { ok: selectedCores.length > 0, label: 'Pelo menos 1 cor selecionada' },
                    { ok: temPrecoValido, label: selectedTamanhos.length > 0 ? 'Preço definido para todos os tamanhos' : 'Preço definido' },
                    { ok: !!categoriaId, label: 'Categoria selecionada' },
                    { ok: peso > 0, label: 'Peso informado' },
                    { ok: dimensoes.comprimento > 0 && dimensoes.largura > 0 && dimensoes.altura > 0, label: 'Dimensões preenchidas' },
                    { ok: imagensPrincipais.length > 0, label: 'Imagens principais adicionadas' },
                    { ok: selectedCores.every(c => c.imagem_url), label: 'Todas as cores com imagem' },
                    { ok: !!ncmPadrao, label: 'NCM fiscal preenchido' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm ${item.ok ? 'text-gray-700' : 'text-red-600'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações do Produto */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Produto</h3>
                    <p className="text-lg font-semibold">{nomeAutoGerado || selectedTecido?.nome}</p>
                    <p className="text-sm text-gray-500">SKU: {selectedTecido?.sku}</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Preço e Estoque</h3>
                    {selectedTamanhos.length > 0 ? (
                      <div className="space-y-1">
                        {selectedTamanhos.map(id => {
                          const tam = tamanhos.find(t => t.id === id);
                          return (
                            <p key={id} className="text-sm">
                              {tam?.nome}: <strong>R$ {(precosPorTamanho[id] || 0).toFixed(2)}</strong>
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <p>Preço: <strong>R$ {precoUnico.toFixed(2)}</strong></p>
                    )}
                    <p className="mt-1">Estoque Padrão: <strong>{estoquePadrao}</strong></p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Categoria</h3>
                    <p>{categoriaNome || <span className="text-red-500">Não selecionada</span>}</p>
                    {brandNome && <p className="text-sm text-gray-500">Marca: {brandNome}</p>}
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Dimensões e Peso</h3>
                    <p>Peso: {peso}kg</p>
                    <p>Dimensões: {dimensoes.comprimento} × {dimensoes.largura} × {dimensoes.altura} cm</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Informações Fiscais</h3>
                    <p className="text-sm">NCM: <strong>{ncmPadrao || 'Não informado'}</strong></p>
                    <p className="text-sm">GTIN: <strong>00</strong> <span className="text-xs text-gray-400">(fixo)</span></p>
                    <p className="text-sm">Nome NF: <strong className="text-xs">Tecido {selectedTecido?.nome} [cor] [tamanho]</strong></p>
                  </div>

                  {/* Descrição */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Descrição</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {descricaoCustomizada || descricaoAutoGerada || 'Descrição automática será gerada.'}
                    </p>
                  </div>

                  {/* Configurações extras */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Configurações Extras</h3>
                    {logisticInfo.filter(l => l.enabled).length > 0 && (
                      <p className="text-sm">{logisticInfo.filter(l => l.enabled).length} canal(is) de logística</p>
                    )}
                    {atributos.length > 0 && (
                      <p className="text-sm">{atributos.length} atributo(s) configurado(s)</p>
                    )}
                    {sizeChartId && (
                      <p className="text-sm">Tabela de medidas: #{sizeChartId}</p>
                    )}
                    {wholesaleEnabled && wholesaleTiers.length > 0 && (
                      <p className="text-sm">{wholesaleTiers.length} faixa(s) de atacado</p>
                    )}
                    {extendedDescEnabled && (
                      <p className="text-sm">Descrição estendida habilitada</p>
                    )}
                  </div>
                </div>

                {/* Variações */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Variações</h3>
                    <p className="text-sm text-gray-500 mb-2">
                      {selectedCores.length} cores × {selectedTamanhos.length || 1} tamanhos = {totalCombinations} combinações
                    </p>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Cores:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCores.map(cor => (
                          <span key={cor.cor_id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1">
                            {cor.cor_hex && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: cor.cor_hex }} />}
                            {cor.cor_nome}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedTamanhos.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-sm font-medium">Tamanhos:</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTamanhos.map(id => {
                            const tamanho = tamanhos.find(t => t.id === id);
                            return (
                              <span key={id} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                                {tamanho?.nome}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Imagens */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Imagens das Variações</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {selectedCores.map(cor => (
                        <div key={cor.cor_id} className="relative group">
                          {cor.imagem_url ? (
                            <img
                              src={overlayImages[cor.cor_id] || cor.imagem_url}
                              alt={cor.cor_nome}
                              className="w-full aspect-square object-cover rounded"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-red-50 border border-red-200 rounded flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-red-400" />
                            </div>
                          )}
                          <span className="text-xs text-gray-500 truncate block mt-1">{cor.cor_nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Preview Shopee */}
          {showPreviewModal && (
            <AdPreview
              data={{
                nome: nomeAutoGerado || selectedTecido?.nome || '',
                descricao: descricaoCustomizada || descricaoAutoGerada || `Tecido ${selectedTecido?.nome || ''} de alta qualidade`,
                preco: precoBaseParaApi,
                imagensPrincipais: imagensPrincipais.length > 0 ? imagensPrincipais : selectedCores.filter(c => c.imagem_url).map(c => c.imagem_url!),
                cores: selectedCores.map(c => ({
                  nome: c.cor_nome,
                  hex: c.cor_hex,
                  imagem: c.imagem_url,
                })),
                tamanhos: selectedTamanhos.map(id => tamanhos.find(t => t.id === id)?.nome || ''),
                peso,
                dimensoes,
                categoria: categoriaNome,
                condition: 'NEW',
                wholesale: wholesaleEnabled ? wholesaleTiers : undefined,
              }}
              onClose={() => setShowPreviewModal(false)}
            />
          )}

          {/* Navegação - sticky no mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-40 sm:static sm:shadow-none sm:border-t sm:p-0 sm:mt-8 sm:pt-6 safe-bottom">
            <div className="flex justify-between items-center gap-2 max-w-4xl mx-auto">
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                disabled={currentStep === 'tecido'}
                className="min-h-[44px]"
              >
                <ChevronLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving || !selectedTecido || selectedCores.length === 0}
                  className="min-h-[44px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Salvar Rascunho</span>
                </Button>

                {currentStep === 'preview' ? (
                  <Button
                    onClick={handlePublish}
                    disabled={publishing || !canProceedFromConfiguracoes}
                    className="min-h-[44px]"
                  >
                    {publishing ? (
                      <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">Publicar na Shopee</span>
                    <span className="sm:hidden">Publicar</span>
                  </Button>
                ) : (
                  <Button
                    onClick={goToNextStep}
                    disabled={
                      (currentStep === 'tecido' && !canProceedFromTecido) ||
                      (currentStep === 'cores' && !canProceedFromCores) ||
                      (currentStep === 'configuracoes' && !canProceedFromConfiguracoes)
                    }
                    className="min-h-[44px]"
                  >
                    <span className="hidden sm:inline">Próximo</span>
                    <span className="sm:hidden">Avançar</span>
                    <ChevronRight className="w-4 h-4 ml-1 sm:ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
