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
import { useShopeePreferences } from '@/hooks/useShopeePreferences';
import { Tecido } from '@/types/tecido.types';
import { ShopeeCategory, CreateShopeeProductData, ShopeeProduct, ProductAttributeValue, ExtendedDescription, WholesaleTier, PrecificacaoShopee, ProductLogisticInfo, ShopeeImageRatio } from '@/types/shopee-product.types';
import { CategoryAttributes } from '@/components/Shopee/CategoryAttributes';
import { BrandSelector } from '@/components/Shopee/BrandSelector';
import { ShippingConfig } from '@/components/Shopee/ShippingConfig';
import { ExtendedDescriptionEditor } from '@/components/Shopee/ExtendedDescriptionEditor';
import { WholesaleConfig } from '@/components/Shopee/WholesaleConfig';
import { SizeChartSelector } from '@/components/Shopee/SizeChartSelector';
import { AdPreview } from '@/components/Shopee/AdPreview';
import { generateBrandOverlay } from '@/lib/brandOverlay';
import { ShopeePricingParams, ShopeeMarginConfig, ShopeeMarginMode, ShopeeMarginOverridesByLength, DEFAULT_CNPJ_PRICING_PARAMS, calculateLengthPrices, calculateNetProfitReais, calculateSuggestedPrice, roundUpToPreferredCents, validatePricingParams } from '@/lib/shopeePricing';
import { FieldHint } from '@/components/Shopee/FieldHint';
import { FiscalInfo } from '@/components/Shopee/FiscalInfo';
import { listRecentMosaicosByTecido } from '@/lib/firebase/gestao-imagens';
import { GestaoImagemMosaico } from '@/types/gestao-imagens.types';
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

type Step = 'tecido' | 'cores' | 'tamanhos_precificacao' | 'imagens' | 'configuracoes' | 'preview';

interface CorConfig {
  cor_id: string;
  cor_nome: string;
  cor_hex?: string;
  imagem_url?: string;
  imagem_gerada?: boolean;
  estoque: number;
  selected: boolean;
}

type MargemPorTamanho = Record<string, ShopeeMarginConfig>;

const STEP_ORDER: Step[] = ['tecido', 'cores', 'tamanhos_precificacao', 'imagens', 'configuracoes', 'preview'];
const FORCED_PRICING_FLAGS = {
  aplicar_teto: true,
  aplicar_baixo_valor: true,
} as const;

function extractMetersFromTamanhoNome(nome?: string): number | null {
  if (!nome) return null;
  const match = nome.trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function toComprimentoId(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(value).replace(',', '.');
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function composeInitialImageList(
  mosaicoUrls: string[],
  premiumUrls: string[],
  maxItems: number = 9
): string[] {
  const uniqueMosaicos = Array.from(new Set(mosaicoUrls.filter(Boolean))).slice(0, 2);
  const uniquePremium = Array.from(new Set(premiumUrls.filter(Boolean))).filter(
    (url) => !uniqueMosaicos.includes(url)
  );

  const remainingSlots = Math.max(0, maxItems - uniqueMosaicos.length);
  const premiumSelection = shuffleArray(uniquePremium).slice(0, remainingSlots);

  return [...uniqueMosaicos, ...premiumSelection].slice(0, maxItems);
}

function toPrecificacaoPayload(
  params: ShopeePricingParams,
  margemPorTamanho: MargemPorTamanho
): PrecificacaoShopee {
  return {
    custo_metro: params.custo_metro,
    margem_liquida_percentual: params.margem_liquida_percentual,
    modo_margem_lucro: params.modo_margem_lucro,
    margem_lucro_fixa: params.margem_lucro_fixa,
    margem_por_tamanho: margemPorTamanho,
    comissao_percentual: params.comissao_percentual,
    taxa_fixa_item: params.taxa_fixa_item,
    valor_minimo_baixo_valor: params.valor_minimo_baixo_valor,
    adicional_baixo_valor: params.adicional_baixo_valor,
    teto_comissao: params.teto_comissao,
    aplicar_teto: true,
    aplicar_baixo_valor: true,
  };
}

function fromPrecificacaoPayload(payload?: PrecificacaoShopee | null): ShopeePricingParams {
  if (!payload) return { ...DEFAULT_CNPJ_PRICING_PARAMS };
  return {
    custo_metro: payload.custo_metro ?? DEFAULT_CNPJ_PRICING_PARAMS.custo_metro,
    margem_liquida_percentual: payload.margem_liquida_percentual ?? DEFAULT_CNPJ_PRICING_PARAMS.margem_liquida_percentual,
    modo_margem_lucro: payload.modo_margem_lucro ?? DEFAULT_CNPJ_PRICING_PARAMS.modo_margem_lucro,
    margem_lucro_fixa: payload.margem_lucro_fixa ?? DEFAULT_CNPJ_PRICING_PARAMS.margem_lucro_fixa,
    comissao_percentual: payload.comissao_percentual ?? DEFAULT_CNPJ_PRICING_PARAMS.comissao_percentual,
    taxa_fixa_item: payload.taxa_fixa_item ?? DEFAULT_CNPJ_PRICING_PARAMS.taxa_fixa_item,
    valor_minimo_baixo_valor: payload.valor_minimo_baixo_valor ?? DEFAULT_CNPJ_PRICING_PARAMS.valor_minimo_baixo_valor,
    adicional_baixo_valor: payload.adicional_baixo_valor ?? DEFAULT_CNPJ_PRICING_PARAMS.adicional_baixo_valor,
    teto_comissao: payload.teto_comissao ?? DEFAULT_CNPJ_PRICING_PARAMS.teto_comissao,
    aplicar_teto: true,
    aplicar_baixo_valor: true,
  };
}

export function CriarAnuncioShopee({ 
  onNavigateHome, 
  onNavigateToAnuncios,
  draftId 
}: CriarAnuncioShopeeProps) {
  const { toast } = useToast();
  const { tecidos, loading: loadingTecidos } = useTecidos();
  const { vinculos, getVinculosByTecido } = useCorTecido();
  const { tamanhos, loading: loadingTamanhos, error: errorTamanhos } = useTamanhos();
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
    saving: savingDraft,
    publishing,
  } = useShopeeProducts();
  const {
    savePreferences: saveShopeePreferences,
    saving: savingPreferences,
  } = useShopeePreferences();
  const { shops } = useShopee();

  // Estado do formulário
  const [currentStep, setCurrentStep] = useState<Step>('tecido');
  const [selectedTecido, setSelectedTecido] = useState<Tecido | null>(null);
  const [coresConfig, setCoresConfig] = useState<CorConfig[]>([]);
  const [selectedTamanhos, setSelectedTamanhos] = useState<string[]>([]);
  const [precoUnico, setPrecoUnico] = useState<number>(0);
  const [precosPorTamanho, setPrecosPorTamanho] = useState<Record<string, number>>({});
  const [margemPorTamanho, setMargemPorTamanho] = useState<MargemPorTamanho>({});
  const [precificacaoParams, setPrecificacaoParams] = useState<ShopeePricingParams>({ ...DEFAULT_CNPJ_PRICING_PARAMS });
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [estoquePadrao, setEstoquePadrao] = useState<number>(100);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string>('');
  const [peso, setPeso] = useState<number>(0.3);
  const [dimensoes, setDimensoes] = useState({ comprimento: 30, largura: 30, altura: 10 });
  const [descricaoCustomizada, setDescricaoCustomizada] = useState<string>('');
  const [tituloAnuncio, setTituloAnuncio] = useState<string>('');
  const [tituloEditadoManual, setTituloEditadoManual] = useState(false);
  const [usarImagensPublicas, setUsarImagensPublicas] = useState<boolean>(true);
  const [imagemRatioPrincipal, setImagemRatioPrincipal] = useState<ShopeeImageRatio>('1:1');
  const [imagensPrincipais11, setImagensPrincipais11] = useState<string[]>([]);
  const [imagensPrincipais34, setImagensPrincipais34] = useState<string[]>([]);
  const [imagensPrincipais, setImagensPrincipais] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [mosaicosTecido, setMosaicosTecido] = useState<GestaoImagemMosaico[]>([]);
  const [loadingMosaicosTecido, setLoadingMosaicosTecido] = useState(false);
  const [productId, setProductId] = useState<string | null>(draftId?.startsWith('duplicate_') ? null : draftId || null);
  const autoSelectedCoresRef = useRef(false);
  const autoSelectedTamanhosRef = useRef(false);
  const autoFilledImagesRef = useRef(false);
  
  // Novos campos opcionais
  const [atributos, setAtributos] = useState<ProductAttributeValue[]>([]);
  const [brandId, setBrandId] = useState<number | undefined>(0);
  const [brandNome, setBrandNome] = useState<string>('');
  const [logisticInfo, setLogisticInfo] = useState<ProductLogisticInfo[]>([]);
  const [extendedDescEnabled, setExtendedDescEnabled] = useState(false);
  const [extendedDescription, setExtendedDescription] = useState<ExtendedDescription | undefined>(undefined);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>([]);
  const [sizeChartId, setSizeChartId] = useState<number | undefined>(undefined);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [overlayImages, setOverlayImages] = useState<Record<string, string>>({});
  const [attributesValidation, setAttributesValidation] = useState({
    loading: false,
    isValid: true,
    mandatoryCount: 0,
    filledMandatoryCount: 0,
    missingAttributeIds: [] as number[],
  });
  const [brandValidation, setBrandValidation] = useState({
    loading: false,
    isMandatory: false,
    isValid: true,
  });
  const [sizeChartValidation, setSizeChartValidation] = useState({
    loading: false,
    supported: false,
    hasSizeCharts: false,
    isValid: true,
  });

  // Informações fiscais
  const [ncmPadrao, setNcmPadrao] = useState<string>('55161300');
  const [cestPadrao, setCestPadrao] = useState<string>('2806000');
  
  // Busca de categoria
  const [categorySearchTerm, setCategorySearchTerm] = useState<string>('');
  
  // Validação inline
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Estado de navegação de categorias
  const [categoryPath, setCategoryPath] = useState<ShopeeCategory[]>([]);

  // Shop selecionada
  const selectedShop = shops[0];

  useEffect(() => {
    if (!categoriaId) {
      setAttributesValidation({
        loading: false,
        isValid: true,
        mandatoryCount: 0,
        filledMandatoryCount: 0,
        missingAttributeIds: [],
      });
      setBrandValidation({
        loading: false,
        isMandatory: false,
        isValid: true,
      });
      setSizeChartValidation({
        loading: false,
        supported: false,
        hasSizeCharts: false,
        isValid: true,
      });
      return;
    }

    setAttributesValidation((prev) => ({ ...prev, loading: true, isValid: false }));
    setBrandValidation((prev) => ({ ...prev, loading: true, isValid: false }));
    setSizeChartValidation((prev) => ({ ...prev, loading: true, isValid: true }));
  }, [categoriaId]);

  const availableTamanhos = useMemo(
    () => tamanhos.filter((tamanho) => extractMetersFromTamanhoNome(tamanho.nome) !== 4),
    [tamanhos]
  );

  const tamanhoIdToComprimentoId = useMemo(() => {
    const map = new Map<string, string>();
    availableTamanhos.forEach((tamanho) => {
      const metros = extractMetersFromTamanhoNome(tamanho.nome);
      if (metros !== null) {
        map.set(tamanho.id, toComprimentoId(metros));
      }
    });
    return map;
  }, [availableTamanhos]);

  const comprimentoIdToTamanhoId = useMemo(() => {
    const map = new Map<string, string>();
    availableTamanhos.forEach((tamanho) => {
      const metros = extractMetersFromTamanhoNome(tamanho.nome);
      if (metros !== null) {
        const key = toComprimentoId(metros);
        if (!map.has(key)) {
          map.set(key, tamanho.id);
        }
      }
    });
    return map;
  }, [availableTamanhos]);

  const selectedComprimentosForPayload = useMemo(() => {
    const deduped: string[] = [];
    selectedTamanhos.forEach((tamanhoId) => {
      const comprimentoId = tamanhoIdToComprimentoId.get(tamanhoId);
      if (comprimentoId && !deduped.includes(comprimentoId)) {
        deduped.push(comprimentoId);
      }
    });
    return deduped;
  }, [selectedTamanhos, tamanhoIdToComprimentoId]);

  const mapPrecosToComprimentoIds = useCallback((source: Record<string, number>) => {
    return Object.entries(source).reduce<Record<string, number>>((acc, [tamanhoId, preco]) => {
      const comprimentoId = tamanhoIdToComprimentoId.get(tamanhoId);
      if (comprimentoId) {
        acc[comprimentoId] = preco;
      }
      return acc;
    }, {});
  }, [tamanhoIdToComprimentoId]);

  const mapMarginsToComprimentoIds = useCallback((source: MargemPorTamanho) => {
    return Object.entries(source).reduce<MargemPorTamanho>((acc, [tamanhoId, margin]) => {
      const comprimentoId = tamanhoIdToComprimentoId.get(tamanhoId);
      if (comprimentoId) {
        acc[comprimentoId] = margin;
      }
      return acc;
    }, {});
  }, [tamanhoIdToComprimentoId]);

  const normalizePricingParams = useCallback(
    (params: ShopeePricingParams): ShopeePricingParams => ({
      ...params,
      ...FORCED_PRICING_FLAGS,
    }),
    []
  );

  const pricingParamErrors = useMemo(
    () => validatePricingParams(normalizePricingParams(precificacaoParams)),
    [precificacaoParams, normalizePricingParams]
  );

  const imagensAtivas = useMemo(
    () => (imagemRatioPrincipal === '3:4' ? imagensPrincipais34 : imagensPrincipais11),
    [imagemRatioPrincipal, imagensPrincipais11, imagensPrincipais34]
  );

  useEffect(() => {
    setImagensPrincipais(imagensAtivas);
  }, [imagensAtivas]);

  const getGlobalMarginDefault = useCallback((mode: ShopeeMarginMode) => {
    if (mode === 'valor_fixo') {
      return precificacaoParams.margem_lucro_fixa;
    }
    return precificacaoParams.margem_liquida_percentual;
  }, [precificacaoParams.margem_lucro_fixa, precificacaoParams.margem_liquida_percentual]);

  const getMarginConfigForSize = useCallback((tamanhoId: string): ShopeeMarginConfig => {
    return margemPorTamanho[tamanhoId] ?? {
      modo: precificacaoParams.modo_margem_lucro,
      valor: getGlobalMarginDefault(precificacaoParams.modo_margem_lucro),
    };
  }, [margemPorTamanho, precificacaoParams.modo_margem_lucro, getGlobalMarginDefault]);

  useEffect(() => {
    const allowedIds = new Set(availableTamanhos.map((tamanho) => tamanho.id));

    setSelectedTamanhos((previous) => {
      const next = previous.filter((id) => allowedIds.has(id));
      return next.length === previous.length ? previous : next;
    });

    setPrecosPorTamanho((previous) => {
      const next = Object.entries(previous).reduce<Record<string, number>>((acc, [id, value]) => {
        if (allowedIds.has(id)) {
          acc[id] = value;
        }
        return acc;
      }, {});
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });

    setMargemPorTamanho((previous) => {
      const next = Object.entries(previous).reduce<MargemPorTamanho>((acc, [id, value]) => {
        if (allowedIds.has(id)) {
          acc[id] = value;
        }
        return acc;
      }, {});
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [availableTamanhos]);

  useEffect(() => {
    if (!selectedTecido || productId || autoSelectedTamanhosRef.current) {
      return;
    }
    if (availableTamanhos.length === 0) {
      return;
    }

    const allTamanhoIds = availableTamanhos.map((tamanho) => tamanho.id);
    setSelectedTamanhos(allTamanhoIds);
    autoSelectedTamanhosRef.current = true;
  }, [availableTamanhos, productId, selectedTecido]);

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

  useEffect(() => {
    if (!selectedTecido) {
      setMosaicosTecido([]);
      return;
    }

    let active = true;
    const loadMosaicos = async () => {
      try {
        setLoadingMosaicosTecido(true);
        const data = await listRecentMosaicosByTecido(selectedTecido.id, 2);
        if (active) {
          setMosaicosTecido(data);
        }
      } catch (error) {
        console.error('Erro ao carregar mosaicos do tecido:', error);
      } finally {
        if (active) {
          setLoadingMosaicosTecido(false);
        }
      }
    };

    void loadMosaicos();
    return () => {
      active = false;
    };
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
    autoSelectedCoresRef.current = true;
    autoSelectedTamanhosRef.current = true;
    autoFilledImagesRef.current = true;
    // Preenche formulário com dados do produto
    const tecido = tecidos.find(t => t.id === product.tecido_id);
    if (tecido) {
      setSelectedTecido(tecido);
      await getVinculosByTecido(tecido.id);
    }
    const mapDraftKeyToLocalTamanhoId = (rawKey?: string, fallbackNome?: string): string | null => {
      if (!rawKey && !fallbackNome) return null;

      if (rawKey && availableTamanhos.some((item) => item.id === rawKey)) {
        return rawKey;
      }

      const fromNumericKey = rawKey ? Number.parseFloat(rawKey.replace(',', '.')) : NaN;
      if (Number.isFinite(fromNumericKey)) {
        const found = comprimentoIdToTamanhoId.get(toComprimentoId(fromNumericKey));
        if (found) return found;
      }

      const fromNome = extractMetersFromTamanhoNome(fallbackNome);
      if (fromNome !== null) {
        const found = comprimentoIdToTamanhoId.get(toComprimentoId(fromNome));
        if (found) return found;
      }

      return null;
    };

    const mappedPrecosPorTamanho = Object.entries(product.precos_por_tamanho || {}).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        const localTamanhoId = mapDraftKeyToLocalTamanhoId(key);
        if (localTamanhoId) {
          acc[localTamanhoId] = value;
        }
        return acc;
      },
      {}
    );

    const mappedMargemPorTamanho = Object.entries(product.precificacao?.margem_por_tamanho || {}).reduce<MargemPorTamanho>(
      (acc, [key, value]) => {
        const localTamanhoId = mapDraftKeyToLocalTamanhoId(key);
        if (localTamanhoId) {
          acc[localTamanhoId] = value;
        }
        return acc;
      },
      {}
    );

    setPrecoUnico(product.preco_base);
    setPrecosPorTamanho(mappedPrecosPorTamanho);
    setPrecificacaoParams(normalizePricingParams(fromPrecificacaoPayload(product.precificacao)));
    setMargemPorTamanho(mappedMargemPorTamanho);
    setPricingError(null);
    setEstoquePadrao(product.estoque_padrao);
    setCategoriaId(product.categoria_id);
    setCategoriaNome(product.categoria_nome || '');
    setPeso(product.peso);
    setDimensoes(product.dimensoes);
    setDescricaoCustomizada(product.descricao_customizada || '');
    setTituloAnuncio(product.titulo_anuncio || '');
    setTituloEditadoManual(Boolean(product.titulo_anuncio));
    setUsarImagensPublicas(product.usar_imagens_publicas);
    setImagemRatioPrincipal(product.imagem_ratio_principal === '3:4' ? '3:4' : '1:1');
    setAtributos(product.atributos || []);
    setBrandId(product.brand_id ?? 0);
    setBrandNome(product.brand_nome || '');
    setLogisticInfo(product.logistic_info || []);
    setExtendedDescEnabled(product.description_type === 'extended');
    setExtendedDescription(product.extended_description || undefined);
    setWholesaleEnabled(Boolean(product.wholesale && product.wholesale.length > 0));
    setWholesaleTiers(product.wholesale || []);
    setSizeChartId(product.size_chart_id);
    setNcmPadrao(product.ncm_padrao || '55161300');
    setCestPadrao(product.cest_padrao || '2806000');
    const imagens11 = product.imagens_principais_1_1 && product.imagens_principais_1_1.length > 0
      ? product.imagens_principais_1_1
      : (product.imagem_ratio_principal !== '3:4' ? (product.imagens_principais || []) : []);
    const imagens34 = product.imagens_principais_3_4 && product.imagens_principais_3_4.length > 0
      ? product.imagens_principais_3_4
      : (product.imagem_ratio_principal === '3:4' ? (product.imagens_principais || []) : []);
    setImagensPrincipais11(imagens11.slice(0, 9));
    setImagensPrincipais34(imagens34.slice(0, 9));
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
          imagem_gerada: /\/gerada_/i.test(m.imagem_url || ''),
          estoque: m.estoque,
          selected: true,
        });
      }
    });
    setCoresConfig(Array.from(coresMap.values()));
    
    // Configura tamanhos
    const tierTamanhoOptions = product.tier_variations.find((t) => t.tier_name === 'Tamanho')?.options || [];
    const selectedTamanhoIds = tierTamanhoOptions
      .map((option, index) => {
        const modelo = product.modelos.find((m) => m.tier_index[1] === index);
        return mapDraftKeyToLocalTamanhoId(modelo?.tamanho_id, option.option_name || modelo?.tamanho_nome);
      })
      .filter((value): value is string => Boolean(value));
    setSelectedTamanhos(Array.from(new Set(selectedTamanhoIds)));
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
      if (defaults.cest_padrao) setCestPadrao(defaults.cest_padrao);
      setPrecificacaoParams((current) => ({
        ...current,
        comissao_percentual: defaults.comissao_percentual_padrao ?? current.comissao_percentual,
        taxa_fixa_item: defaults.taxa_fixa_item_padrao ?? current.taxa_fixa_item,
        margem_liquida_percentual: defaults.margem_liquida_percentual_padrao ?? current.margem_liquida_percentual,
        modo_margem_lucro: defaults.modo_margem_lucro_padrao ?? 'valor_fixo',
        margem_lucro_fixa: defaults.margem_lucro_fixa_padrao ?? 4,
        valor_minimo_baixo_valor: defaults.valor_minimo_baixo_valor_padrao ?? current.valor_minimo_baixo_valor,
        adicional_baixo_valor: defaults.adicional_baixo_valor_padrao ?? current.adicional_baixo_valor,
        teto_comissao: defaults.teto_comissao_padrao ?? current.teto_comissao,
        aplicar_teto: true,
        aplicar_baixo_valor: true,
      }));
      setPricingError(null);
    }
  };

  // Quando tecido é selecionado, carrega vínculos
  const handleTecidoSelect = async (tecidoId: string) => {
    const tecido = tecidos.find(t => t.id === tecidoId);
    if (tecido) {
      autoSelectedCoresRef.current = false;
      autoSelectedTamanhosRef.current = false;
      autoFilledImagesRef.current = false;
      setSelectedTecido(tecido);
      setCoresConfig([]);
      setSelectedTamanhos([]);
      setPrecosPorTamanho({});
      setMargemPorTamanho({});
      setImagensPrincipais11([]);
      setImagensPrincipais34([]);
      setImagemRatioPrincipal('1:1');
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
    if (vinculos.length > 0 && selectedTecido && !productId && !autoSelectedCoresRef.current && coresConfig.length === 0) {
      const vinculosDoTecido = vinculos.filter(v => v.tecidoId === selectedTecido.id);
      const cores = vinculosDoTecido.map(v => ({
        cor_id: v.corId,
        cor_nome: v.corNome,
        cor_hex: v.corHex,
        imagem_url: v.imagemGerada || v.imagemTingida,
        imagem_gerada: Boolean(v.imagemGerada),
        estoque: estoquePadrao,
        selected: true,
      }));
      setCoresConfig(cores);
      autoSelectedCoresRef.current = true;
    }
  }, [vinculos, selectedTecido, productId, estoquePadrao, coresConfig.length]);

  // Toggle seleção de cor
  const toggleCorSelection = (corId: string) => {
    setCoresConfig(prev => prev.map(c => 
      c.cor_id === corId ? { ...c, selected: !c.selected } : c
    ));
  };

  const applySuggestedPrices = useCallback((
    params: ShopeePricingParams = precificacaoParams,
    tamanhoIds: string[] = selectedTamanhos,
    marginsBySize: MargemPorTamanho = margemPorTamanho
  ) => {
    const effectiveParams = normalizePricingParams(params);
    const errors = validatePricingParams(effectiveParams);
    if (errors.length > 0) {
      setPricingError(errors[0]);
      return false;
    }

    try {
      if (tamanhoIds.length > 0) {
        const selectedLengths = tamanhoIds
          .map((id) => availableTamanhos.find((t) => t.id === id))
          .filter((tamanho): tamanho is (typeof availableTamanhos)[number] => Boolean(tamanho))
          .map((tamanho) => ({ id: tamanho.id, metros: extractMetersFromTamanhoNome(tamanho.nome) || 1 }));
        const marginOverrides = selectedLengths.reduce<ShopeeMarginOverridesByLength>((acc, item) => {
          const margin = marginsBySize[item.id];
          if (margin) {
            acc[item.id] = margin;
          }
          return acc;
        }, {});
        const suggestedPrices = calculateLengthPrices(effectiveParams, selectedLengths, marginOverrides);
        const roundedPrices = Object.entries(suggestedPrices).reduce<Record<string, number>>((acc, [id, price]) => {
          acc[id] = roundUpToPreferredCents(price);
          return acc;
        }, {});
        setPrecosPorTamanho(roundedPrices);
      } else {
        setPrecoUnico(calculateSuggestedPrice(effectiveParams, 1));
        setPrecosPorTamanho({});
      }
      setPricingError(null);
      return true;
    } catch (error: any) {
      setPricingError(error.message || 'Nao foi possivel calcular os precos sugeridos.');
      return false;
    }
  }, [precificacaoParams, selectedTamanhos, margemPorTamanho, availableTamanhos, normalizePricingParams]);

  const updatePrecificacaoParam = useCallback((patch: Partial<ShopeePricingParams>) => {
    const nextParams = normalizePricingParams({ ...precificacaoParams, ...patch });
    setPrecificacaoParams(nextParams);
    applySuggestedPrices(nextParams, selectedTamanhos, margemPorTamanho);
  }, [precificacaoParams, applySuggestedPrices, selectedTamanhos, margemPorTamanho, normalizePricingParams]);

  const updateMargemPorTamanho = useCallback((
    tamanhoId: string,
    patch: Partial<ShopeeMarginConfig>
  ) => {
    setMargemPorTamanho((previous) => {
      const current = previous[tamanhoId] ?? getMarginConfigForSize(tamanhoId);
      const nextConfig: ShopeeMarginConfig = {
        modo: patch.modo ?? current.modo,
        valor: patch.valor ?? current.valor,
      };
      const nextMargins = {
        ...previous,
        [tamanhoId]: nextConfig,
      };
      applySuggestedPrices(precificacaoParams, selectedTamanhos, nextMargins);
      return nextMargins;
    });
  }, [applySuggestedPrices, getMarginConfigForSize, precificacaoParams, selectedTamanhos]);

  const savePricingDefaults = useCallback(async () => {
    await saveShopeePreferences({
      comissao_percentual_padrao: precificacaoParams.comissao_percentual,
      taxa_fixa_item_padrao: precificacaoParams.taxa_fixa_item,
      margem_liquida_percentual_padrao: precificacaoParams.margem_liquida_percentual,
      modo_margem_lucro_padrao: precificacaoParams.modo_margem_lucro,
      margem_lucro_fixa_padrao: precificacaoParams.margem_lucro_fixa,
      valor_minimo_baixo_valor_padrao: precificacaoParams.valor_minimo_baixo_valor,
      adicional_baixo_valor_padrao: precificacaoParams.adicional_baixo_valor,
      teto_comissao_padrao: precificacaoParams.teto_comissao,
      aplicar_teto_padrao: true,
      aplicar_baixo_valor_padrao: true,
    });
  }, [saveShopeePreferences, precificacaoParams]);

  // Atualiza preço de um tamanho
  const updatePrecoTamanho = (tamanhoId: string, value: number) => {
    setPrecosPorTamanho(prev => ({ ...prev, [tamanhoId]: value }));
  };

  // Toggle seleção de tamanho
  const toggleTamanhoSelection = (tamanhoId: string) => {
    setSelectedTamanhos(prev => {
      const nextSelection = prev.includes(tamanhoId)
        ? prev.filter(id => id !== tamanhoId)
        : [...prev, tamanhoId];

      const nextMargins = nextSelection.reduce<MargemPorTamanho>((acc, id) => {
        if (margemPorTamanho[id]) {
          acc[id] = margemPorTamanho[id];
        }
        return acc;
      }, {});
      setMargemPorTamanho(nextMargins);
      applySuggestedPrices(precificacaoParams, nextSelection, nextMargins);
      return nextSelection;
    });
  };

  useEffect(() => {
    if (productId) return;
    if (selectedTamanhos.length === 0) return;
    if (Object.keys(precosPorTamanho).length > 0) return;
    applySuggestedPrices(precificacaoParams, selectedTamanhos, margemPorTamanho);
  }, [applySuggestedPrices, margemPorTamanho, precificacaoParams, precosPorTamanho, productId, selectedTamanhos]);

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

  const lucroLiquidoPorTamanho = useMemo(() => {
    return selectedTamanhos.reduce<Record<string, number | null>>((acc, id) => {
      const tamanho = tamanhos.find((t) => t.id === id);
      const metros = extractMetersFromTamanhoNome(tamanho?.nome) || 1;
      const price = precosPorTamanho[id] || 0;
      if (price <= 0) {
        acc[id] = null;
        return acc;
      }

      try {
        acc[id] = calculateNetProfitReais(precificacaoParams, metros, price);
      } catch {
        acc[id] = null;
      }
      return acc;
    }, {});
  }, [selectedTamanhos, tamanhos, precosPorTamanho, precificacaoParams]);

  const lucroLiquidoPorMetroPorTamanho = useMemo(() => {
    return selectedTamanhos.reduce<Record<string, number | null>>((acc, id) => {
      const tamanho = tamanhos.find((t) => t.id === id);
      const metros = extractMetersFromTamanhoNome(tamanho?.nome) || 1;
      const lucroTotal = lucroLiquidoPorTamanho[id];
      if (lucroTotal === null || lucroTotal === undefined || metros <= 0) {
        acc[id] = null;
        return acc;
      }
      acc[id] = lucroTotal / metros;
      return acc;
    }, {});
  }, [selectedTamanhos, tamanhos, lucroLiquidoPorTamanho]);

  const lucroLiquidoPrecoUnico = useMemo(() => {
    if (precoUnico <= 0) {
      return null;
    }
    try {
      return calculateNetProfitReais(precificacaoParams, 1, precoUnico);
    } catch {
      return null;
    }
  }, [precoUnico, precificacaoParams]);

  const tituloTrim = tituloAnuncio.trim();
  const tituloValido = tituloTrim.length === 0 || (tituloTrim.length >= 20 && tituloTrim.length <= 120);
  const mandatoryAttributesReadyAndValid = !categoriaId || (!attributesValidation.loading && attributesValidation.isValid);
  const mandatoryBrandReadyAndValid = !categoriaId || (!brandValidation.loading && brandValidation.isValid);
  const sizeChartReadyAndValid = !categoriaId || (!sizeChartValidation.loading && sizeChartValidation.isValid);

  // Validação de etapas
  const canProceedFromTecido = selectedTecido !== null;
  const canProceedFromImagens = imagensPrincipais11.length >= 9 && imagensPrincipais34.length >= 9;
  const canProceedFromCores = coresConfig.some(c => c.selected);
  const hasEnabledLogistics = logisticInfo.some((channel) => channel.enabled);
  const canProceedFromTamanhosPrecificacao = temPrecoValido && !pricingError && pricingParamErrors.length === 0;
  const canProceedFromConfiguracoes = 
    temPrecoValido && 
    categoriaId !== null && 
    tituloValido &&
    mandatoryAttributesReadyAndValid &&
    mandatoryBrandReadyAndValid &&
    sizeChartReadyAndValid &&
    peso > 0 && 
    dimensoes.comprimento > 0 && 
    dimensoes.largura > 0 && 
    dimensoes.altura > 0;
  const canPublishFromPreview = canProceedFromConfiguracoes && hasEnabledLogistics;

  // Navegação entre etapas
  const goToNextStep = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
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

    if (!tituloValido) {
      toast({
        title: 'Titulo invalido',
        description: 'O titulo precisa ter entre 20 e 120 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    const tamanhosPayload = selectedComprimentosForPayload.length > 0
      ? selectedComprimentosForPayload
      : undefined;
    const precosPorTamanhoPayload = selectedComprimentosForPayload.length > 0
      ? mapPrecosToComprimentoIds(precosPorTamanho)
      : undefined;
    const margemPorTamanhoPayload = mapMarginsToComprimentoIds(margemPorTamanho);

    const data: CreateShopeeProductData = {
      shop_id: selectedShop.shopId,
      tecido_id: selectedTecido.id,
      cores: selectedCores.map(c => ({
        cor_id: c.cor_id,
        estoque: estoquePadrao,
      })),
      tamanhos: tamanhosPayload,
      precos_por_tamanho: precosPorTamanhoPayload,
      preco_base: precoBaseParaApi,
      precificacao: toPrecificacaoPayload(precificacaoParams, margemPorTamanhoPayload),
      estoque_padrao: estoquePadrao,
      categoria_id: categoriaId!,
      peso,
      dimensoes,
      titulo_anuncio: tituloTrim || undefined,
      descricao_customizada: descricaoCustomizada || undefined,
      usar_imagens_publicas: usarImagensPublicas,
      imagem_ratio_principal: imagemRatioPrincipal,
      imagens_principais_1_1: imagensPrincipais11.length > 0 ? imagensPrincipais11 : undefined,
      imagens_principais_3_4: imagensPrincipais34.length > 0 ? imagensPrincipais34 : undefined,
      atributos: atributos.length > 0 ? atributos : undefined,
      brand_id: brandId,
      brand_nome: brandNome || undefined,
      logistic_info: logisticInfo,
      condition: 'NEW',
      size_chart_id: sizeChartId,
      description_type: extendedDescEnabled ? 'extended' : 'normal',
      extended_description: extendedDescEnabled ? extendedDescription : undefined,
      wholesale: wholesaleEnabled && wholesaleTiers.length > 0 ? wholesaleTiers : undefined,
      ncm_padrao: ncmPadrao || undefined,
      cest_padrao: cestPadrao || '2806000',
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
  const selectedCorIds = useMemo(() => new Set(selectedCores.map((cor) => cor.cor_id)), [selectedCores]);

  const premiumSquareCandidates = useMemo(() => {
    if (!selectedTecido) return [];
    return vinculos
      .filter((vinculo) =>
        vinculo.tecidoId === selectedTecido.id &&
        selectedCorIds.has(vinculo.corId) &&
        Boolean(vinculo.imagemPremiumSquare)
      )
      .map((vinculo) => vinculo.imagemPremiumSquare!)
      .filter(Boolean);
  }, [selectedCorIds, selectedTecido, vinculos]);

  const premiumPortraitCandidates = useMemo(() => {
    if (!selectedTecido) return [];
    return vinculos
      .filter((vinculo) =>
        vinculo.tecidoId === selectedTecido.id &&
        selectedCorIds.has(vinculo.corId) &&
        Boolean(vinculo.imagemPremiumPortrait)
      )
      .map((vinculo) => vinculo.imagemPremiumPortrait!)
      .filter(Boolean);
  }, [selectedCorIds, selectedTecido, vinculos]);

  useEffect(() => {
    if (!selectedTecido || productId || autoFilledImagesRef.current) {
      return;
    }

    const mosaicosSquare = mosaicosTecido.map((mosaico) => mosaico.outputSquareUrl).filter(Boolean);
    const mosaicosPortrait = mosaicosTecido.map((mosaico) => mosaico.outputPortraitUrl).filter(Boolean);
    const next11 = composeInitialImageList(mosaicosSquare, premiumSquareCandidates, 9);
    const next34 = composeInitialImageList(mosaicosPortrait, premiumPortraitCandidates, 9);

    if (next11.length > 0 && imagensPrincipais11.length === 0) {
      setImagensPrincipais11(next11);
    }
    if (next34.length > 0 && imagensPrincipais34.length === 0) {
      setImagensPrincipais34(next34);
    }

    if (next11.length > 0 || next34.length > 0) {
      autoFilledImagesRef.current = true;
    }
  }, [
    imagensPrincipais11.length,
    imagensPrincipais34.length,
    mosaicosTecido,
    premiumPortraitCandidates,
    premiumSquareCandidates,
    productId,
    selectedTecido,
  ]);

  // Calcula total de combinações
  const totalCombinations = selectedCores.length * (selectedTamanhos.length || 1);

  // Dados do tecido para auto-fill de atributos Shopee
  const tecidoDataForAttributes = useMemo(() => {
    if (!selectedTecido) return undefined;
    // Extrair comprimentos dos tamanhos selecionados (em metros)
    const comprimentos = selectedTamanhos
      .map((id) => {
        const tam = tamanhos.find((t) => t.id === id);
        return tam ? extractMetersFromTamanhoNome(tam.nome) : null;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    return {
      composicao: selectedTecido.composicao,
      tipo: selectedTecido.tipo,
      largura: selectedTecido.largura,
      comprimentos,
    };
  }, [selectedTecido?.composicao, selectedTecido?.tipo, selectedTecido?.largura, selectedTamanhos, tamanhos]);

  // Nome auto-gerado do anúncio
  const nomeAutoGerado = useMemo(() => {
    if (!selectedTecido) return '';
    const cores = selectedCores.map(c => c.cor_nome).join(', ');
    const base = `Tecido ${selectedTecido.nome}`;
    return cores ? `${base} - ${cores}` : base;
  }, [selectedTecido, selectedCores]);

  useEffect(() => {
    if (!tituloEditadoManual) {
      setTituloAnuncio(nomeAutoGerado);
    }
  }, [nomeAutoGerado, tituloEditadoManual]);

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
    if (!tituloValido) {
      errors.titulo = 'Titulo deve ter entre 20 e 120 caracteres';
    }
    if (!categoriaId) errors.categoria = 'Selecione uma categoria';
    if (!mandatoryAttributesReadyAndValid) errors.atributos = 'Preencha todos os atributos obrigatorios da categoria';
    if (!mandatoryBrandReadyAndValid) errors.marca = 'Selecione uma marca valida para a categoria';
    if (!hasEnabledLogistics) errors.logistica = 'Habilite pelo menos um canal de logistica';
    if (!sizeChartReadyAndValid) errors.sizeChart = 'Selecao de tabela de medidas invalida para esta categoria';
    if (peso <= 0) errors.peso = 'Peso deve ser maior que zero';
    if (dimensoes.comprimento <= 0) errors.comprimento = 'Comprimento deve ser maior que zero';
    if (dimensoes.largura <= 0) errors.largura = 'Largura deve ser maior que zero';
    if (dimensoes.altura <= 0) errors.altura = 'Altura deve ser maior que zero';
    return errors;
  }, [temPrecoValido, selectedTamanhos, tituloValido, categoriaId, mandatoryAttributesReadyAndValid, mandatoryBrandReadyAndValid, hasEnabledLogistics, sizeChartReadyAndValid, peso, dimensoes]);

  // Progresso da etapa atual
  const stepProgress = useMemo(() => {
    if (currentStep === 'tecido') return selectedTecido ? 100 : 0;
    if (currentStep === 'cores') return selectedCores.length > 0 ? 100 : 0;
    if (currentStep === 'tamanhos_precificacao') {
      let filled = 0;
      if (selectedTamanhos.length > 0 || precoUnico > 0) filled++;
      if (temPrecoValido) filled++;
      if (pricingParamErrors.length === 0) filled++;
      return Math.round((filled / 3) * 100);
    }
    if (currentStep === 'imagens') {
      const progress11 = Math.min(imagensPrincipais11.length, 9);
      const progress34 = Math.min(imagensPrincipais34.length, 9);
      return Math.round(((progress11 + progress34) / 18) * 100);
    }
    if (currentStep === 'configuracoes') {
      const totalFields = 10;
      let filled = 0;
      if (temPrecoValido) filled++;
      if (estoquePadrao > 0) filled++;
      if (tituloValido) filled++;
      if (categoriaId) filled++;
      if (mandatoryAttributesReadyAndValid) filled++;
      if (mandatoryBrandReadyAndValid) filled++;
      if (hasEnabledLogistics) filled++;
      if (sizeChartReadyAndValid) filled++;
      if (peso > 0) filled++;
      if (dimensoes.comprimento > 0 && dimensoes.largura > 0) filled++;
      if (dimensoes.altura > 0) filled++;
      return Math.round((filled / totalFields) * 100);
    }
    return 100;
  }, [currentStep, selectedTecido, imagensPrincipais11.length, imagensPrincipais34.length, selectedCores, selectedTamanhos.length, precoUnico, temPrecoValido, pricingParamErrors.length, estoquePadrao, tituloValido, categoriaId, mandatoryAttributesReadyAndValid, mandatoryBrandReadyAndValid, hasEnabledLogistics, sizeChartReadyAndValid, peso, dimensoes]);

  // Gerar overlays de marca quando entrar no preview
  useEffect(() => {
    if (currentStep !== 'preview') return;
    selectedCores.forEach(cor => {
      if (cor.imagem_url && !cor.imagem_gerada && !overlayImages[cor.cor_id]) {
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
  const fileInput11Ref = useRef<HTMLInputElement>(null);
  const fileInput34Ref = useRef<HTMLInputElement>(null);

  const updateImagesByRatio = useCallback((
    ratio: ShopeeImageRatio,
    updater: (current: string[]) => string[]
  ) => {
    if (ratio === '3:4') {
      setImagensPrincipais34((previous) => updater(previous));
      return;
    }
    setImagensPrincipais11((previous) => updater(previous));
  }, []);

  const getImagesByRatio = useCallback((ratio: ShopeeImageRatio): string[] => {
    return ratio === '3:4' ? imagensPrincipais34 : imagensPrincipais11;
  }, [imagensPrincipais11, imagensPrincipais34]);

  const handleImageUpload = useCallback(async (files: FileList, ratio: ShopeeImageRatio) => {
    const currentImages = getImagesByRatio(ratio);
    if (currentImages.length + files.length > 9) {
      toast({
        title: 'Limite de imagens',
        description: `O maximo e 9 imagens ${ratio} por anuncio.`,
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
        const storageRef = ref(storage, `shopee-anuncios/${productId || 'temp'}/${ratio}/${timestamp}_${safeName}`);
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
      updateImagesByRatio(ratio, (previous) => [...previous, ...newUrls].slice(0, 9));
    }

    setUploadingImages(false);
    if (ratio === '3:4' && fileInput34Ref.current) fileInput34Ref.current.value = '';
    if (ratio === '1:1' && fileInput11Ref.current) fileInput11Ref.current.value = '';
  }, [getImagesByRatio, productId, toast, updateImagesByRatio]);

  const useImageAsCover = useCallback((url: string, ratio: ShopeeImageRatio) => {
    updateImagesByRatio(ratio, (previous) => {
      const deduped = previous.filter((existing) => existing !== url);
      return [url, ...deduped].slice(0, 9);
    });
  }, [updateImagesByRatio]);

  const removeMainImage = useCallback((ratio: ShopeeImageRatio, index: number) => {
    updateImagesByRatio(ratio, (previous) => previous.filter((_, imageIndex) => imageIndex !== index));
  }, [updateImagesByRatio]);

  const moveMainImage = useCallback((ratio: ShopeeImageRatio, fromIndex: number, toIndex: number) => {
    const images = getImagesByRatio(ratio);
    if (toIndex < 0 || toIndex >= images.length) return;

    updateImagesByRatio(ratio, (previous) => {
      const next = [...previous];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, [getImagesByRatio, updateImagesByRatio]);

  const renderRatioGallery = (ratio: ShopeeImageRatio) => {
    const images = getImagesByRatio(ratio);
    const isSquare = ratio === '1:1';
    const mosaicoPreviewUrls = mosaicosTecido
      .map((mosaico) => (isSquare ? mosaico.outputSquareUrl : mosaico.outputPortraitUrl))
      .filter(Boolean);

    return (
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Galeria {ratio}</p>
            <p className="text-xs text-gray-500">{images.length}/9 imagens</p>
          </div>
          <Button
            type="button"
            variant={imagemRatioPrincipal === ratio ? 'default' : 'outline'}
            size="sm"
            onClick={() => setImagemRatioPrincipal(ratio)}
          >
            Usar como principal
          </Button>
        </div>

        {selectedTecido && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
            <p className="text-[11px] font-medium text-gray-700 mb-2">
              Sugestoes automaticas ({ratio}): 2 ultimos mosaicos + premium random
            </p>
            {loadingMosaicosTecido ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Carregando mosaicos...
              </div>
            ) : mosaicoPreviewUrls.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum mosaico salvo para este tecido.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {mosaicoPreviewUrls.map((url, index) => (
                  <button
                    key={`${ratio}-mosaico-${index}`}
                    type="button"
                    onClick={() => useImageAsCover(url, ratio)}
                    className="group rounded-md border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all text-left"
                  >
                    <img
                      src={url}
                      alt={`Mosaico ${ratio}`}
                      className={`w-full ${isSquare ? 'aspect-square' : 'aspect-[3/4]'} object-cover`}
                    />
                    <div className="px-2 py-1 text-[11px] text-gray-600 group-hover:text-blue-700 truncate">
                      Usar na galeria {ratio}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {images.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {images.map((url, index) => (
              <div key={`${ratio}-${index}`} className={`relative group border rounded-lg overflow-hidden bg-gray-50 ${isSquare ? 'aspect-square' : 'aspect-[3/4]'}`}>
                <img
                  src={url}
                  alt={`Imagem ${ratio} ${index + 1}`}
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
                      onClick={() => moveMainImage(ratio, index, index - 1)}
                      className="bg-white rounded-full p-1.5 shadow hover:bg-gray-100"
                      title="Mover para esquerda"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {index < images.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveMainImage(ratio, index, index + 1)}
                      className="bg-white rounded-full p-1.5 shadow hover:bg-gray-100"
                      title="Mover para direita"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMainImage(ratio, index)}
                    className="bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            Galeria {ratio} vazia. Adicione imagens para usar essa proporcao.
          </p>
        )}

        {images.length < 9 && (
          <div>
            <input
              ref={isSquare ? fileInput11Ref : fileInput34Ref}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleImageUpload(e.target.files, ratio)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => (isSquare ? fileInput11Ref.current?.click() : fileInput34Ref.current?.click())}
              disabled={uploadingImages}
              className="min-h-[44px]"
            >
              {uploadingImages ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {uploadingImages ? 'Enviando...' : `Adicionar imagens ${ratio}`}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderImageSelectionStep = () => (
    <div className="space-y-6">
      <FieldHint
        label="Imagens Principais do Anuncio"
        hint="A Shopee suporta 1:1 como padrao e 3:4 quando enviado com ratio explicito."
        description={`1:1: ${imagensPrincipais11.length}/9 | 3:4: ${imagensPrincipais34.length}/9`}
      >
        <div className="mt-2 space-y-4">
          {renderRatioGallery('1:1')}
          {renderRatioGallery('3:4')}
        </div>
      </FieldHint>
      {!canProceedFromImagens && (
        <p className="text-sm text-amber-600">
          Para continuar, complete as duas galerias com 9 imagens em 1:1 e 9 imagens em 3:4.
        </p>
      )}

      <div>
        <FieldHint
          label="Metodo de Upload de Imagens"
          hint="URLs Publicas usam links diretos. Upload Direto envia a imagem para Shopee."
        >
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={usarImagensPublicas}
                onChange={() => setUsarImagensPublicas(true)}
                className="w-4 h-4"
              />
              <span className="text-sm">URLs Publicas (mais rapido)</span>
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
  );
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
                { key: 'tamanhos_precificacao', label: 'Preços', icon: DollarSign },
                { key: 'imagens', label: 'Imagens', icon: ImageIcon },
                { key: 'configuracoes', label: 'Config', icon: Ruler },
                { key: 'preview', label: 'Preview', icon: ImageIcon },
              ].map((step, index) => {
                const stepIndex = STEP_ORDER.indexOf(currentStep);
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
                { key: 'tamanhos_precificacao', label: 'Tamanhos e Preços', icon: DollarSign },
                { key: 'imagens', label: 'Imagens', icon: ImageIcon },
                { key: 'configuracoes', label: 'Configurações', icon: Ruler },
                { key: 'preview', label: 'Preview', icon: ImageIcon },
              ].map((step, index) => {
                const stepIndex = STEP_ORDER.indexOf(currentStep);
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
                    {index < STEP_ORDER.length - 1 && (
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

          {/* Etapa 5: Selecao de Imagens */}
          {currentStep === 'imagens' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Selecione as Imagens</h2>
              <p className="text-sm text-gray-500 mb-4">
                Escolha as imagens principais depois de definir cores, tamanhos e precificacao.
              </p>
              {renderImageSelectionStep()}
            </div>
          )}

          {/* Etapa 3: Selecao de Cores */}
          {currentStep === 'cores' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Selecione as Cores</h2>
              <p className="text-sm text-gray-500 mb-4">
                Cada cor selecionada sera uma variacao do anuncio. A imagem vinculada ao tecido sera usada como imagem da variacao.
              </p>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <FieldHint
                    label="Cores Disponiveis"
                    hint="Cores vinculadas a este tecido no sistema. Cada cor vira uma variacao de Cor na Shopee."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllCores}
                  >
                    {coresConfig.every(c => c.selected) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {coresConfig.map(cor => (
                    <div
                      key={cor.cor_id}
                      onClick={() => toggleCorSelection(cor.cor_id)}
                      className={`cursor-pointer border-2 rounded-lg p-3 aspect-square flex flex-col transition-all ${
                        cor.selected
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex-1 min-h-0 bg-white rounded-md border border-gray-100 overflow-hidden">
                        {cor.imagem_url ? (
                          <img
                            src={cor.imagem_url}
                            alt={cor.cor_nome}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center mt-2">
                        <Checkbox checked={cor.selected} className="mr-2" />
                        <span className="font-medium text-sm truncate">{cor.cor_nome}</span>
                        {cor.cor_hex && (
                          <div
                            className="w-4 h-4 rounded-full border ml-auto flex-shrink-0"
                            style={{ backgroundColor: cor.cor_hex }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  {selectedCores.length > 0
                    ? `${selectedCores.length} cores selecionadas.`
                    : 'Selecione pelo menos uma cor para continuar.'}
                </p>
              </div>
            </div>
          )}

          {/* Etapa 4: Tamanhos e Precificacao */}
          {currentStep === 'tamanhos_precificacao' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Tamanhos e Precificacao</h2>
              <p className="text-sm text-gray-500 mb-4">
                Defina os comprimentos e parametros de precificacao para gerar sugestoes automaticas de preco.
              </p>

              <div className="mt-4">
                <FieldHint
                  label="Comprimentos"
                  hint="Selecione os comprimentos que serao publicados. Sem comprimentos selecionados, sera usado preco unico."
                  className="mb-4"
                />

                {loadingTamanhos ? (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-10 w-16 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                ) : availableTamanhos.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {errorTamanhos
                      ? `Nao foi possivel carregar os comprimentos: ${errorTamanhos}`
                      : 'Nenhum comprimento ativo encontrado. Cadastre/ative tamanhos para aparecer aqui.'}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTamanhos.map(tamanho => (
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

              <div className="mt-6 border-t pt-6">
                <FieldHint
                  label="Parametros de Precificacao"
                  hint="Defina custo por metro e margem para gerar precos sugeridos automaticamente (inclui 3% de taxa de antecipacao sobre o valor liquido da venda)."
                  className="mb-4"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500">Custo por metro (R$)</span>
                    <Input type="number" step="0.01" min="0" value={precificacaoParams.custo_metro} onChange={(e) => updatePrecificacaoParam({ custo_metro: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Modo da margem</span>
                    <select
                      value={precificacaoParams.modo_margem_lucro}
                      onChange={(e) => updatePrecificacaoParam({ modo_margem_lucro: e.target.value as ShopeeMarginMode })}
                      className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="percentual">Percentual (%)</option>
                      <option value="valor_fixo">Valor fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">
                      {precificacaoParams.modo_margem_lucro === 'valor_fixo' ? 'Margem liquida fixa por metro (R$/m)' : 'Margem liquida (%)'}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precificacaoParams.modo_margem_lucro === 'valor_fixo' ? precificacaoParams.margem_lucro_fixa : precificacaoParams.margem_liquida_percentual}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        if (precificacaoParams.modo_margem_lucro === 'valor_fixo') {
                          updatePrecificacaoParam({ margem_lucro_fixa: value });
                        } else {
                          updatePrecificacaoParam({ margem_liquida_percentual: value });
                        }
                      }}
                    />
                  </div>
                </div>

                {(pricingError || pricingParamErrors.length > 0) && (
                  <p className="mt-3 text-sm text-red-600">{pricingError || pricingParamErrors[0]}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => applySuggestedPrices()}>
                    Calcular precos sugeridos
                  </Button>
                  <Button type="button" variant="outline" onClick={savePricingDefaults} disabled={savingPreferences}>
                    {savingPreferences ? 'Salvando...' : 'Salvar como padrao'}
                  </Button>
                </div>
              </div>

              {selectedTamanhos.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <FieldHint
                    label="Margem por Comprimento"
                    hint="Opcional: defina margem especifica por comprimento. Em modo fixo, o valor e por metro (R$/m)."
                    className="mb-4"
                  />
                  <div className="space-y-3">
                    {selectedTamanhos.map((id) => {
                      const tam = tamanhos.find((t) => t.id === id);
                      const marginConfig = getMarginConfigForSize(id);
                      return (
                        <div key={`margem-${id}`} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium text-gray-700 flex items-center">
                            {tam?.nome || id}
                          </div>
                          <select
                            value={marginConfig.modo}
                            onChange={(e) => {
                              const modo = e.target.value as ShopeeMarginMode;
                              updateMargemPorTamanho(id, { modo, valor: getGlobalMarginDefault(modo) });
                            }}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="percentual">Percentual (%)</option>
                            <option value="valor_fixo">Valor fixo (R$)</option>
                          </select>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={marginConfig.valor}
                            onChange={(e) => updateMargemPorTamanho(id, { valor: parseFloat(e.target.value) || 0 })}
                            placeholder={marginConfig.modo === 'valor_fixo' ? 'R$/m 0,00' : '0%'}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 border-t pt-6">
                {selectedTamanhos.length > 0 ? (
                  <>
                    <FieldHint
                      label="Preco por Comprimento"
                      hint="Alterar parametros de precificacao sobrescreve os valores manuais."
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
                            {lucroLiquidoPorTamanho[id] !== null && lucroLiquidoPorTamanho[id] !== undefined && (
                              <p className="mt-2 text-xs text-emerald-700">
                                Lucro liquido total: R$ {lucroLiquidoPorTamanho[id]!.toFixed(2)}
                                {lucroLiquidoPorMetroPorTamanho[id] !== null && lucroLiquidoPorMetroPorTamanho[id] !== undefined
                                  ? ` (${lucroLiquidoPorMetroPorTamanho[id]!.toFixed(2)}/m)`
                                  : ''}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <FieldHint
                    label="Preco Unico"
                    required
                    hint="Sem comprimentos selecionados, este preco vale para todas as variacoes de cor."
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
                    {lucroLiquidoPrecoUnico !== null && (
                      <p className="mt-2 text-xs text-emerald-700">
                        Lucro liquido estimado: R$ {lucroLiquidoPrecoUnico.toFixed(2)}
                      </p>
                    )}
                  </FieldHint>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{totalCombinations}</strong> combinacoes serao criadas
                  ({selectedCores.length} cores x {selectedTamanhos.length || 1} comprimentos)
                </p>
                {selectedTamanhos.length > 0 && precoMinimo > 0 && precoMinimo !== Infinity && (
                  <p className="text-xs text-blue-600 mt-1">
                    Preco a partir de R$ {precoMinimo.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Etapa 6: Configuracoes */}
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
                {/* Resumo de Preços (somente leitura — definidos na etapa de tamanhos e precificacao) */}
                <div className="md:col-span-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Preços definidos</span>
                    <span className="text-xs text-green-600">(editavel na etapa "Tamanhos e Precificacao")</span>
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

                <div className="md:col-span-2">
                  <FieldHint
                    label="Titulo do Anuncio"
                    hint="Voce pode ajustar o titulo manualmente. Se ficar vazio, o sistema usa a sugestao automatica."
                    description={`${tituloTrim.length}/120 caracteres`}
                  >
                    <Input
                      value={tituloAnuncio}
                      onChange={(e) => {
                        setTituloAnuncio(e.target.value);
                        setTituloEditadoManual(true);
                      }}
                      onBlur={() => markTouched('titulo')}
                      className={touchedFields.has('titulo') && validationErrors.titulo ? 'border-red-400' : ''}
                      placeholder={nomeAutoGerado || 'Titulo do anuncio'}
                      maxLength={120}
                    />
                  </FieldHint>
                  {touchedFields.has('titulo') && validationErrors.titulo ? (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.titulo}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setTituloEditadoManual(false);
                      setTituloAnuncio(nomeAutoGerado);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Usar sugestao automatica
                  </button>
                </div>

                {/* Estoque Padrão */}
                <FieldHint
                  label="Estoque Padrão"
                  hint="Quantidade inicial geral. Este valor sera aplicado em todas as variacoes (cores e tamanhos)."
                  description="Nao ha ajuste de estoque por cor nesta etapa."
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
                      tecidoData={tecidoDataForAttributes}
                      onValidationChange={setAttributesValidation}
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
                      onValidationChange={setBrandValidation}
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
                    cest={cestPadrao}
                    onCestChange={setCestPadrao}
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
                    {!hasEnabledLogistics && (
                      <p className="mt-2 text-xs text-amber-700">
                        Para publicar, habilite pelo menos um canal de logistica.
                      </p>
                    )}
                  </div>
                )}

                {/* Size Chart */}
                {categoriaId && selectedShop && (
                  <div className="md:col-span-2">
                    <SizeChartSelector
                      shopId={selectedShop.shopId}
                      categoryId={categoriaId}
                      value={sizeChartId}
                      onValidationChange={setSizeChartValidation}
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

              </div>
            </div>
          )}

          {/* Etapa 5: Preview */}
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
                    { ok: mandatoryAttributesReadyAndValid, label: attributesValidation.mandatoryCount > 0 ? 'Atributos obrigatorios preenchidos' : 'Atributos obrigatorios nao exigidos' },
                    { ok: mandatoryBrandReadyAndValid, label: brandValidation.isMandatory ? 'Marca obrigatoria selecionada' : 'Marca obrigatoria nao exigida' },
                    { ok: hasEnabledLogistics, label: 'Pelo menos 1 canal logistico habilitado' },
                    { ok: sizeChartReadyAndValid, label: 'Tabela de medidas valida para a categoria' },
                    { ok: peso > 0, label: 'Peso informado' },
                    { ok: dimensoes.comprimento > 0 && dimensoes.largura > 0 && dimensoes.altura > 0, label: 'Dimensões preenchidas' },
                    { ok: imagensPrincipais.length > 0, label: 'Imagens principais adicionadas' },
                    { ok: selectedCores.every(c => c.imagem_url), label: 'Todas as cores com imagem' },
                    { ok: tituloValido, label: 'Titulo do anuncio valido' },
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
                    <p className="text-lg font-semibold">{tituloTrim || nomeAutoGerado || selectedTecido?.nome}</p>
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
                    <p className="text-sm">CEST: <strong>{cestPadrao || '2806000'}</strong></p>
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
                nome: tituloTrim || nomeAutoGerado || selectedTecido?.nome || '',
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
                  disabled={savingDraft || !selectedTecido || selectedCores.length === 0}
                  className="min-h-[44px]"
                >
                  {savingDraft ? (
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Salvar Rascunho</span>
                </Button>

                {currentStep === 'preview' ? (
                  <Button
                    onClick={handlePublish}
                    disabled={publishing || !canPublishFromPreview}
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
                      (currentStep === 'tamanhos_precificacao' && !canProceedFromTamanhosPrecificacao) ||
                      (currentStep === 'imagens' && !canProceedFromImagens) ||
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
