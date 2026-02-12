import admin from '../config/firebase';
import {
  ShopeeProduct,
  CreateShopeeProductData,
  TierVariation,
  ProductModel,
  ProductAttributeValue,
  ShopeeAddItemResponse,
  ShopeeDeleteItemResponse,
  ShopeeInitTierResponse,
  ShopeeUploadImageResponse,
} from '../types/shopee-product.types';
import { callShopeeApi, ensureValidToken, uploadImageToShopeeMultipart } from './shopee.service';
import * as preferencesService from './shopee-preferences.service';
import * as imageCompressor from './image-compressor.service';
import * as logisticsService from './shopee-logistics.service';
import * as categoryService from './shopee-category.service';
import * as itemLimitService from './shopee-item-limit.service';
import { applyBrandOverlay } from './brand-overlay.service';
import axios from 'axios';
import { 
  validateProductForPublish, 
  formatItemName, 
  formatDescription,
} from '../utils/shopee-validation';

const db = admin.firestore();
const PRODUCTS_COLLECTION = 'shopee_products';
const TECIDOS_COLLECTION = 'tecidos';
const COR_TECIDO_COLLECTION = 'cor_tecido';
const COMPRIMENTOS_PADRAO_METROS: number[] = [1, 2, 3];
const PUBLISH_LOCK_TTL_MS = 10 * 60 * 1000;
const IMAGE_UPLOAD_POOL_SIZE = 3;
const IMAGE_UPLOAD_MAX_RETRIES = 2;
const IMAGE_UPLOAD_RETRY_BASE_DELAY_MS = 500;
const SHOPEE_BR_TAX_DEFAULTS = {
  ncm: '55161300',
  cest: '2806000',
  same_state_cfop: '5102',
  diff_state_cfop: '6102',
  csosn: '102',
  origin: '0',
  measure_unit: 'M',
} as const;

type PublishLogLevel = 'info' | 'warn' | 'error';
type PublishStage = 'lock' | 'validation' | 'upload' | 'add_item' | 'init_tier_variation' | 'rollback' | 'persist';

interface PublishLogContext {
  product_id: string;
  user_id: string;
  dry_run: boolean;
  shop_id?: number;
  lock_token?: string | null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enetunreach') ||
    message.includes('service_unavailable') ||
    message.includes('system_error') ||
    message.includes('api_limit') ||
    message.includes('http 429') ||
    message.includes('http 5')
  );
}

function getUploadRetryDelay(attempt: number): number {
  const exponential = IMAGE_UPLOAD_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 200);
  return exponential + jitter;
}

function normalizeNcm(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 8) return digits;
  if (digits === '00') return digits;
  return null;
}

function normalizeCest(value?: string | null): string {
  if (!value) return SHOPEE_BR_TAX_DEFAULTS.cest;
  const digits = value.replace(/\D/g, '');
  if (digits === '00') return SHOPEE_BR_TAX_DEFAULTS.cest;
  if (digits.length === 7) return digits;
  return SHOPEE_BR_TAX_DEFAULTS.cest;
}

function normalizeImageUrlList(urls?: string[] | null): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  urls.forEach((url) => {
    if (typeof url !== 'string') return;
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
}

async function withUploadRetry<T>(
  label: string,
  action: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= IMAGE_UPLOAD_MAX_RETRIES + 1; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt > IMAGE_UPLOAD_MAX_RETRIES) {
        break;
      }

      const delayMs = getUploadRetryDelay(attempt);
      console.warn(
        `[uploadRetry] ${label} tentativa ${attempt}/${IMAGE_UPLOAD_MAX_RETRIES + 1} falhou com erro recuperavel: ${toErrorMessage(error)}. Retry em ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`[uploadRetry] ${label} falhou apos ${IMAGE_UPLOAD_MAX_RETRIES + 1} tentativa(s): ${toErrorMessage(lastError)}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

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

function logPublishEvent(
  level: PublishLogLevel,
  event: string,
  context: PublishLogContext,
  details: Record<string, unknown> = {}
): void {
  const payload = {
    ts: new Date().toISOString(),
    module: 'shopee_product.publish',
    event,
    ...context,
    ...details,
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

async function runPublishStage<T>(
  stage: PublishStage,
  context: PublishLogContext,
  action: () => Promise<T>,
  details: Record<string, unknown> = {}
): Promise<T> {
  const startedAt = Date.now();
  logPublishEvent('info', 'publish.stage.start', context, { stage, ...details });

  try {
    const result = await action();
    logPublishEvent('info', 'publish.stage.success', context, {
      stage,
      duration_ms: Date.now() - startedAt,
      ...details,
    });
    return result;
  } catch (error) {
    logPublishEvent('error', 'publish.stage.error', context, {
      stage,
      duration_ms: Date.now() - startedAt,
      error: toErrorMessage(error),
      ...details,
    });
    throw error;
  }
}

/**
 * Remove valores undefined recursivamente de um objeto
 * Firestore e Shopee API não aceitam undefined
 */
function removeUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Pula valores undefined
    }
    
    if (value === null) {
      cleaned[key] = null; // Mantém null (é válido)
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item => 
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? removeUndefinedValues(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = removeUndefinedValues(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

function getProductOwnerId(product: Partial<ShopeeProduct>): string | null {
  if (product.created_by) return product.created_by;
  if (product.user_id) return product.user_id;
  return null;
}

function hasAttributeValue(attribute?: ProductAttributeValue): boolean {
  if (!attribute?.attribute_value_list || attribute.attribute_value_list.length === 0) {
    return false;
  }

  return attribute.attribute_value_list.some((value) => {
    if (value.value_id !== undefined && value.value_id !== null) {
      return true;
    }
    return typeof value.original_value_name === 'string' && value.original_value_name.trim().length > 0;
  });
}

function isPublishLockActive(lockData: any): boolean {
  const expiresAt = lockData?.expires_at;
  if (!expiresAt || typeof expiresAt.toMillis !== 'function') {
    return false;
  }
  return expiresAt.toMillis() > Date.now();
}

function buildPublishLockToken(productId: string): string {
  return `publish_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickPreferredSizeChartId(sizeCharts: Array<{
  size_chart_id: number;
}>): number | undefined {
  if (sizeCharts.length === 0) return undefined;
  // API so retorna size_chart_id (sem nome) — selecionar a primeira disponivel
  return sizeCharts[0]?.size_chart_id;
}

async function resolveSizeChartIdForPublish(product: ShopeeProduct): Promise<number | undefined> {
  const configuredId = product.size_chart_id || undefined;

  try {
    const support = await itemLimitService.checkSizeChartSupport(product.shop_id, product.categoria_id);
    if (!support.supported) {
      return undefined;
    }

    const sizeCharts = await itemLimitService.getSizeCharts(product.shop_id, product.categoria_id, 50);
    if (sizeCharts.length === 0) {
      return configuredId;
    }

    if (configuredId && sizeCharts.some((chart) => chart.size_chart_id === configuredId)) {
      return configuredId;
    }

    return pickPreferredSizeChartId(sizeCharts) || configuredId;
  } catch {
    return configuredId;
  }
}

async function validatePrePublishRequirements(product: ShopeeProduct): Promise<void> {
  const errors: string[] = [];

  try {
    const mandatoryAttributes = await categoryService.getMandatoryAttributes(product.shop_id, product.categoria_id);
    if (mandatoryAttributes.length > 0) {
      const provided = new Set(
        (product.atributos || [])
          .filter((attribute) => hasAttributeValue(attribute))
          .map((attribute) => attribute.attribute_id)
      );
      const missingIds = mandatoryAttributes
        .map((attribute) => attribute.attribute_id)
        .filter((attributeId) => !provided.has(attributeId));

      if (missingIds.length > 0) {
        errors.push(`Atributos obrigatorios ausentes: ${missingIds.join(', ')}`);
      }
    }
  } catch (error: any) {
    errors.push(`Falha ao validar atributos obrigatorios: ${error.message || 'erro desconhecido'}`);
  }

  try {
    const mandatoryBrand = await categoryService.isBrandMandatory(product.shop_id, product.categoria_id);
    if (mandatoryBrand && (!product.brand_id || product.brand_id === 0)) {
      errors.push('Marca obrigatoria para a categoria selecionada');
    }
  } catch (error: any) {
    errors.push(`Falha ao validar obrigatoriedade de marca: ${error.message || 'erro desconhecido'}`);
  }

  if (Array.isArray(product.logistic_info) && product.logistic_info.length > 0) {
    const enabledCount = product.logistic_info.filter((channel) => channel.enabled).length;
    if (enabledCount === 0) {
      errors.push('Pelo menos um canal de logistica deve estar habilitado');
    }
  }

  if (product.size_chart_id) {
    try {
      const support = await itemLimitService.checkSizeChartSupport(product.shop_id, product.categoria_id);
      if (!support.supported) {
        errors.push('A categoria selecionada nao suporta tabela de medidas');
      } else {
        const sizeCharts = await itemLimitService.getSizeCharts(product.shop_id, product.categoria_id, 50);
        if (sizeCharts.length > 0 && !sizeCharts.some((sizeChart) => sizeChart.size_chart_id === product.size_chart_id)) {
          errors.push(`Tabela de medidas invalida para a categoria: ${product.size_chart_id}`);
        }
      }
    } catch (error: any) {
      errors.push(`Falha ao validar tabela de medidas: ${error.message || 'erro desconhecido'}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validacao pre-publish reforcada falhou: ${errors.join('; ')}`);
  }
}

/**
 * Faz upload de uma imagem para o Shopee Media Space
 * Comprime a imagem se necessário (target: 1.99MB)
 */
async function uploadImageToShopee(
  shopId: number,
  accessToken: string,
  imageUrl: string,
  ratio: '1:1' | '3:4'
): Promise<string> {
  // Baixa e comprime a imagem se necessário
  const { buffer, wasCompressed, originalSize, finalSize } = 
    await imageCompressor.downloadAndCompressImage(imageUrl);
  
  if (wasCompressed) {
    console.log(`Imagem comprimida: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(finalSize / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Faz upload para Shopee Media Space usando multipart/form-data
  // O endpoint requer arquivo binário, não base64 em JSON
  const filename = imageUrl.split('/').pop() || 'image.jpg';
  const response = await uploadImageToShopeeMultipart(
    shopId,
    accessToken,
    buffer,
    filename,
    ratio
  ) as ShopeeUploadImageResponse;
  
  if (response.error) {
    throw new Error(`Erro ao fazer upload de imagem: ${response.error} - ${response.message}`);
  }

  const imageId = response.response?.image_info?.image_id;
  if (!imageId) {
    throw new Error('Upload de imagem não retornou image_id');
  }

  return imageId;
}

/**
 * Faz upload de uma imagem de variação com overlay de marca (logo Razai + nome da cor)
 * Pipeline: download raw -> applyBrandOverlay -> comprimir -> upload
 */
async function uploadVariationImageToShopee(
  shopId: number,
  accessToken: string,
  imageUrl: string,
  colorName: string,
  ratio: '1:1' | '3:4'
): Promise<string> {
  // 1. Download da imagem original
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const rawBuffer = Buffer.from(response.data);

  // 2. Aplicar overlay (logo + nome da cor)
  console.log(`[uploadVariationImage] Aplicando overlay para "${colorName}"`);
  const overlaidBuffer = await applyBrandOverlay(rawBuffer, colorName);

  // 3. Comprimir (target 1.99MB)
  const { buffer, wasCompressed, originalSize, finalSize } =
    await imageCompressor.compressImageToTarget(overlaidBuffer, 'image/png');
  if (wasCompressed) {
    console.log(`[uploadVariationImage] Comprimido: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(finalSize / 1024 / 1024).toFixed(2)}MB`);
  }

  // 4. Upload para Shopee
  const filename = `variation_${colorName.replace(/\s+/g, '_')}.png`;
  const uploadResponse = await uploadImageToShopeeMultipart(
    shopId, accessToken, buffer, filename, ratio
  ) as ShopeeUploadImageResponse;

  if (uploadResponse.error) {
    throw new Error(`Erro upload imagem variacao: ${uploadResponse.error} - ${uploadResponse.message}`);
  }
  const imageId = uploadResponse.response?.image_info?.image_id;
  if (!imageId) throw new Error('Upload de imagem de variacao nao retornou image_id');
  return imageId;
}

/**
 * Processa imagens para publicação
 * Sempre faz upload para Shopee Media Space para obter image_id
 * Retorna lista de image_ids
 */
async function processImagesForPublish(
  shopId: number,
  accessToken: string,
  imageUrls: string[],
  ratio: '1:1' | '3:4',
  _usarImagensPublicas: boolean = false
): Promise<string[]> {
  return mapWithConcurrency(imageUrls, IMAGE_UPLOAD_POOL_SIZE, async (url) => {
    const imageId = await withUploadRetry(`main_image:${url.substring(0, 80)}`, () =>
      uploadImageToShopee(shopId, accessToken, url, ratio)
    );
    console.log(`[processImages] Upload OK: ${url.substring(0, 80)}... -> image_id=${imageId}`);
    return imageId;
  });
}

/**
 * Busca dados do tecido
 */
async function getTecidoData(tecidoId: string): Promise<{
  nome: string;
  sku: string;
  largura?: number;
  composicao?: string;
  descricao?: string;
  imagemUrl?: string;
} | null> {
  const doc = await db.collection(TECIDOS_COLLECTION).doc(tecidoId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    nome: data?.nome || '',
    sku: data?.sku || '',
    largura: data?.largura,
    composicao: data?.composicao,
    descricao: data?.descricao,
    imagemUrl: data?.imagemUrl,
  };
}

/**
 * Busca vínculos cor-tecido
 */
async function getCorTecidoData(tecidoId: string, corIds: string[]): Promise<Array<{
  id: string;
  corId: string;
  corNome: string;
  corSku?: string;
  imagemGerada?: string;
  imagemTingida?: string;
}>> {
  const vinculos: Array<{
    id: string;
    corId: string;
    corNome: string;
    corSku?: string;
    imagemGerada?: string;
    imagemTingida?: string;
  }> = [];

  // Busca TODOS os vínculos do tecido (apenas 1 WHERE para evitar erro de índice composto)
  const snapshot = await db.collection(COR_TECIDO_COLLECTION)
    .where('tecidoId', '==', tecidoId)
    .get();

  console.log(`[getCorTecidoData] tecidoId=${tecidoId}, corIds=[${corIds.join(',')}], snapshot.size=${snapshot.size}`);

  // Filtra no código por corId e deletedAt
  for (const corId of corIds) {
    const doc = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.corId === corId && !data.deletedAt;
    });

    if (doc) {
      const data = doc.data();
      vinculos.push({
        id: doc.id,
        corId: data.corId,
        corNome: data.corNome || '',
        corSku: data.corSku,
        imagemGerada: data.imagemGerada,
        imagemTingida: data.imagemTingida,
      });
    }
  }

  console.log(`[getCorTecidoData] vinculos encontrados: ${vinculos.length}/${corIds.length}`);

  return vinculos;
}

function formatLarguraLabel(largura?: number): string {
  if (typeof largura !== 'number' || Number.isNaN(largura) || largura <= 0) {
    return '-';
  }

  return `${largura.toFixed(2).replace('.', ',')}m`;
}

function normalizeComprimentoIds(tamanhoIds?: string[]): string[] {
  const source = tamanhoIds === undefined
    ? COMPRIMENTOS_PADRAO_METROS.map((metros) => String(metros))
    : tamanhoIds;

  return source.filter((id, index, array) => {
    const metros = Number(id);
    const isValid = COMPRIMENTOS_PADRAO_METROS.includes(metros);
    if (!isValid) return false;
    return array.indexOf(id) === index;
  });
}

function extractComprimentoIdsFromModels(modelos: ProductModel[] = []): string[] {
  const ids = modelos
    .map((model) => {
      if (model.tamanho_id && COMPRIMENTOS_PADRAO_METROS.includes(Number(model.tamanho_id))) {
        return String(model.tamanho_id);
      }

      if (model.tamanho_nome) {
        const match = model.tamanho_nome.match(/^(\d+(?:[.,]\d+)?)m/i);
        if (match) {
          const metros = Number(match[1].replace(',', '.'));
          if (COMPRIMENTOS_PADRAO_METROS.includes(metros)) {
            return String(metros);
          }
        }
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));

  return normalizeComprimentoIds(ids);
}

function buildComprimentosData(
  tamanhoIds: string[] | undefined,
  larguraTecido?: number
): Array<{ id: string; nome: string; sku?: string }> {
  const larguraLabel = formatLarguraLabel(larguraTecido);

  return normalizeComprimentoIds(tamanhoIds).map((id) => ({
    id,
    nome: `${id}m x ${larguraLabel}`,
    sku: id,
  }));
}

/**
 * Gera descrição do produto
 */
function buildProductDescription(
  tecidoNome: string,
  composicao?: string,
  largura?: number,
  descricaoCustomizada?: string,
  descricaoTemplate?: string
): string {
  if (descricaoCustomizada) {
    return descricaoCustomizada;
  }
  
  let descricao = descricaoTemplate || `${tecidoNome}`;
  
  if (composicao) {
    descricao += `\n\nComposição: ${composicao}`;
  }
  
  if (largura) {
    descricao += `\n\nLargura: ${largura}m`;
  }
  
  return descricao;
}

/**
 * Gera estrutura de tier variations
 */
function buildTierVariations(
  vinculos: Array<{ corNome: string; imagemGerada?: string; imagemTingida?: string }>,
  tamanhos?: Array<{ nome: string }>
): TierVariation[] {
  const tiers: TierVariation[] = [];

  // Tier 1: Cor (sempre primeiro)
  tiers.push({
    tier_name: 'Cor',
    tier_index: 0,
    options: vinculos.map((v) => {
      const imagemFinal = v.imagemGerada || v.imagemTingida;
      return {
        option_name: v.corNome,
        imagem_url: imagemFinal,
        imagem_gerada: Boolean(v.imagemGerada),
      };
    }),
  });

  // Tier 2: Tamanho (opcional)
  if (tamanhos && tamanhos.length > 0) {
    tiers.push({
      tier_name: 'Tamanho',
      tier_index: 1,
      options: tamanhos.map((t) => ({
        option_name: t.nome,
      })),
    });
  }

  return tiers;
}

/**
 * Gera lista de modelos (combinações)
 */
function buildModelList(
  tecidoSku: string,
  vinculos: Array<{ id: string; corId: string; corNome: string; corSku?: string; imagemGerada?: string; imagemTingida?: string }>,
  tamanhos: Array<{ id: string; nome: string; sku?: string }> | undefined,
  coresConfig: Array<{ cor_id: string; estoque: number }>,
  precoBase: number,
  precosPorTamanho: Record<string, number> | undefined,
  estoquePadrao: number
): ProductModel[] {
  const modelos: ProductModel[] = [];
  
  if (!tamanhos || tamanhos.length === 0) {
    // Apenas cores, sem tamanhos - usa preco_base para todos
    vinculos.forEach((vinculo, corIndex) => {
      const imagemFinal = vinculo.imagemGerada || vinculo.imagemTingida;
      const corConfig = coresConfig.find(c => c.cor_id === vinculo.corId);
      const modelSku = vinculo.corSku 
        ? `${tecidoSku}-${vinculo.corSku}` 
        : `${tecidoSku}-${corIndex + 1}`;
      
      modelos.push({
        model_sku: modelSku,
        tier_index: [corIndex],
        cor_id: vinculo.corId,
        cor_nome: vinculo.corNome,
        vinculo_id: vinculo.id,
        preco: precoBase, // Sem tamanhos, usa preço único
        estoque: corConfig?.estoque ?? estoquePadrao,
        imagem_url: imagemFinal,
      });
    });
  } else {
    // Cores + Tamanhos - usa preço do tamanho correspondente
    vinculos.forEach((vinculo, corIndex) => {
      const imagemFinal = vinculo.imagemGerada || vinculo.imagemTingida;
      const corConfig = coresConfig.find(c => c.cor_id === vinculo.corId);
      
      tamanhos.forEach((tamanho, tamanhoIndex) => {
        const modelSku = vinculo.corSku && tamanho.sku
          ? `${tecidoSku}-${vinculo.corSku}-${tamanho.sku}`
          : `${tecidoSku}-${corIndex + 1}-${tamanhoIndex + 1}`;
        
        // Preço do tamanho ou fallback para preco_base
        const precoTamanho = precosPorTamanho?.[tamanho.id] || precoBase;
        
        modelos.push({
          model_sku: modelSku,
          tier_index: [corIndex, tamanhoIndex],
          cor_id: vinculo.corId,
          cor_nome: vinculo.corNome,
          tamanho_id: tamanho.id,
          tamanho_nome: tamanho.nome,
          vinculo_id: vinculo.id,
          preco: precoTamanho, // Preço do tamanho aplicado a todas as cores
          estoque: corConfig?.estoque ?? estoquePadrao,
          imagem_url: imagemFinal,
        });
      });
    });
  }
  
  return modelos;
}

/**
 * Lista produtos/rascunhos
 */
export async function listProducts(
  userId: string,
  shopId?: number,
  status?: string
): Promise<ShopeeProduct[]> {
  let query = db.collection(PRODUCTS_COLLECTION)
    .where('created_by', '==', userId);
  
  if (shopId) {
    query = query.where('shop_id', '==', shopId);
  }
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const snapshot = await query.orderBy('updated_at', 'desc').get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ShopeeProduct));
}

/**
 * Busca produto por ID
 */
export async function getProductById(id: string): Promise<ShopeeProduct | null> {
  const doc = await db.collection(PRODUCTS_COLLECTION).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  } as ShopeeProduct;
}

/**
 * Cria um novo produto/rascunho
 */
export async function createProduct(
  userId: string,
  data: CreateShopeeProductData
): Promise<ShopeeProduct> {
  // Busca dados do tecido
  const tecido = await getTecidoData(data.tecido_id);
  if (!tecido) {
    throw new Error('Tecido não encontrado');
  }
  
  // Busca vínculos cor-tecido
  const corIds = data.cores.map(c => c.cor_id);
  const vinculos = await getCorTecidoData(data.tecido_id, corIds);
  
  if (vinculos.length === 0) {
    throw new Error('Nenhum vínculo cor-tecido encontrado');
  }
  
  // Comprimentos selecionados (automatizados por largura do tecido)
  const tamanhos = buildComprimentosData(data.tamanhos, tecido.largura);
  
  // Busca preferências do usuário para template de descrição
  const preferences = await preferencesService.getUserPreferences(userId);
  
  // Monta descrição
  const descricao = buildProductDescription(
    tecido.nome,
    tecido.composicao,
    tecido.largura,
    data.descricao_customizada,
    preferences?.descricao_template
  );
  
  // Monta tier variations
  const tierVariations = buildTierVariations(vinculos, tamanhos);
  
  // Monta lista de modelos
  const modelos = buildModelList(
    tecido.sku,
    vinculos,
    tamanhos,
    data.cores,
    data.preco_base,
    data.precos_por_tamanho,
    data.estoque_padrao
  );
  
  const imagemRatioPrincipal: '1:1' | '3:4' =
    data.imagem_ratio_principal === '3:4' ? '3:4' : '1:1';

  const imagensPrincipais11 = data.imagens_principais_1_1 && data.imagens_principais_1_1.length > 0
    ? data.imagens_principais_1_1
    : [];

  const imagensPrincipais34 = data.imagens_principais_3_4 && data.imagens_principais_3_4.length > 0
    ? data.imagens_principais_3_4
    : [];

  // Compatibilidade retroativa: se vier apenas imagens_principais, usa no ratio ativo
  if ((imagensPrincipais11.length === 0 && imagensPrincipais34.length === 0) && data.imagens_principais?.length) {
    if (imagemRatioPrincipal === '3:4') {
      imagensPrincipais34.push(...data.imagens_principais);
    } else {
      imagensPrincipais11.push(...data.imagens_principais);
    }
  }

  // Galeria efetiva enviada para publicação (depende do ratio principal selecionado)
  const imagensPrincipais = imagensPrincipais11.length > 0
    ? imagensPrincipais11
    : imagensPrincipais34.length > 0
      ? imagensPrincipais34
      : tecido.imagemUrl ? [tecido.imagemUrl] : [];
  
  const now = admin.firestore.Timestamp.now();
  
  const productData = {
    shop_id: data.shop_id,
    tecido_id: data.tecido_id,
    tecido_nome: tecido.nome,
    tecido_sku: tecido.sku,
    imagens_principais: imagensPrincipais,
    imagens_principais_1_1: imagensPrincipais11,
    imagens_principais_3_4: imagensPrincipais34,
    imagem_ratio_principal: imagemRatioPrincipal,
    video_url: data.video_url || null,
    tier_variations: tierVariations,
    modelos,
    preco_base: data.preco_base,
    precificacao: data.precificacao || null,
    precos_por_tamanho: data.precos_por_tamanho || null,
    estoque_padrao: data.estoque_padrao,
    categoria_id: data.categoria_id,
    atributos: data.atributos || [],
    brand_id: data.brand_id ?? null,
    brand_nome: data.brand_nome || null,
    logistic_info: data.logistic_info || null,
    peso: data.peso,
    dimensoes: data.dimensoes,
    descricao,
    titulo_anuncio: data.titulo_anuncio || null,
    descricao_customizada: data.descricao_customizada || null,
    usar_imagens_publicas: data.usar_imagens_publicas ?? true,
    condition: 'NEW',
    is_pre_order: data.is_pre_order ?? false,
    days_to_ship: data.days_to_ship ?? (data.is_pre_order ? 7 : 2),
    size_chart_id: data.size_chart_id || null,
    description_type: data.description_type || 'normal',
    extended_description: data.extended_description || null,
    wholesale: data.wholesale || null,
    ncm_padrao: data.ncm_padrao || SHOPEE_BR_TAX_DEFAULTS.ncm,
    cest_padrao: data.cest_padrao || SHOPEE_BR_TAX_DEFAULTS.cest,
    status: 'draft' as const,
    created_at: now,
    updated_at: now,
    created_by: userId,
    user_id: userId,
    template_id: data.template_id || null,
  };
  
  const docRef = await db.collection(PRODUCTS_COLLECTION).add(productData);
  
  return {
    id: docRef.id,
    ...productData,
  } as ShopeeProduct;
}

/**
 * Atualiza um produto/rascunho
 */
export async function updateProduct(
  id: string,
  userId: string,
  data: Partial<CreateShopeeProductData>
): Promise<ShopeeProduct | null> {
  const docRef = db.collection(PRODUCTS_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const existingData = doc.data() as ShopeeProduct;
  
  // Verifica se o usuário é o dono
  if (getProductOwnerId(existingData) !== userId) {
    throw new Error('Sem permissão para editar este produto');
  }
  
  // Não permite editar produtos já publicados (exceto alguns campos)
  if (existingData.status === 'created' && existingData.item_id) {
    // Para produtos publicados, só permite editar alguns campos
    const allowedFields = ['preco_base', 'estoque_padrao'];
    const hasDisallowedFields = Object.keys(data).some(k => !allowedFields.includes(k));
    if (hasDisallowedFields) {
      throw new Error('Produto já publicado. Apenas preço e estoque podem ser alterados.');
    }
  }
  
  const updateData: Record<string, unknown> = {
    updated_at: admin.firestore.Timestamp.now(),
    condition: 'NEW',
  };
  
  const hasCoresField = Object.prototype.hasOwnProperty.call(data, 'cores');
  const hasTamanhosField = Object.prototype.hasOwnProperty.call(data, 'tamanhos');

  // Se mudou cores ou tamanhos, recalcula modelos
  if (hasCoresField || hasTamanhosField) {
    const tecidoId = data.tecido_id || existingData.tecido_id;
    const tecido = await getTecidoData(tecidoId);
    
    if (tecido) {
      const coresConfig = hasCoresField
        ? (data.cores || [])
        : existingData.modelos
            .filter(m => Boolean(m.cor_id))
            .map(m => ({
              cor_id: m.cor_id!,
              estoque: m.estoque,
            }));
      const corIds = coresConfig.map(c => c.cor_id).filter(Boolean) as string[];

      if (corIds.length === 0) {
        throw new Error('Pelo menos uma cor deve ser selecionada');
      }
      const vinculos = await getCorTecidoData(tecidoId, corIds);

      if (vinculos.length === 0) {
        throw new Error('Nenhum vínculo cor-tecido encontrado para as cores selecionadas');
      }

      const tamanhoIds = hasTamanhosField
        ? normalizeComprimentoIds(data.tamanhos)
        : extractComprimentoIdsFromModels(existingData.modelos);

      const tamanhos = buildComprimentosData(tamanhoIds, tecido.largura);
      
      updateData.tier_variations = buildTierVariations(vinculos, tamanhos);
      updateData.modelos = buildModelList(
        tecido.sku,
        vinculos,
        tamanhos,
        coresConfig,
        data.preco_base ?? existingData.preco_base,
        data.precos_por_tamanho ?? existingData.precos_por_tamanho ?? undefined,
        data.estoque_padrao ?? existingData.estoque_padrao
      );

      if (hasTamanhosField && tamanhoIds.length === 0) {
        updateData.precos_por_tamanho = null;
      }
    }
  }
  
  // Atualiza campos simples
  if (data.preco_base !== undefined) updateData.preco_base = data.preco_base;
  if (data.precificacao !== undefined) updateData.precificacao = data.precificacao;
  if (data.precos_por_tamanho !== undefined) updateData.precos_por_tamanho = data.precos_por_tamanho;
  if (data.estoque_padrao !== undefined) updateData.estoque_padrao = data.estoque_padrao;
  if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id;
  if (data.atributos !== undefined) updateData.atributos = data.atributos;
  if (data.brand_id !== undefined) updateData.brand_id = data.brand_id;
  if (data.brand_nome !== undefined) updateData.brand_nome = data.brand_nome;
  if (data.logistic_info !== undefined) updateData.logistic_info = data.logistic_info;
  if (data.peso !== undefined) updateData.peso = data.peso;
  if (data.dimensoes !== undefined) updateData.dimensoes = data.dimensoes;
  if (data.video_url !== undefined) updateData.video_url = data.video_url;
  if (data.descricao_customizada !== undefined) updateData.descricao_customizada = data.descricao_customizada;
  if (data.titulo_anuncio !== undefined) updateData.titulo_anuncio = data.titulo_anuncio;
  if (data.usar_imagens_publicas !== undefined) updateData.usar_imagens_publicas = data.usar_imagens_publicas;
  const nextImageRatio: '1:1' | '3:4' =
    data.imagem_ratio_principal === '3:4'
      ? '3:4'
      : existingData.imagem_ratio_principal === '3:4'
        ? '3:4'
        : '1:1';
  if (data.imagem_ratio_principal !== undefined) {
    updateData.imagem_ratio_principal = nextImageRatio;
  }

  const hasRatioSpecific11 = Object.prototype.hasOwnProperty.call(data, 'imagens_principais_1_1');
  const hasRatioSpecific34 = Object.prototype.hasOwnProperty.call(data, 'imagens_principais_3_4');
  const hasLegacyImages = Object.prototype.hasOwnProperty.call(data, 'imagens_principais');

  const existing11 = existingData.imagens_principais_1_1 || [];
  const existing34 = existingData.imagens_principais_3_4 || [];

  let next11 = hasRatioSpecific11 ? (data.imagens_principais_1_1 || []) : existing11;
  let next34 = hasRatioSpecific34 ? (data.imagens_principais_3_4 || []) : existing34;

  // Compatibilidade: payload legado atualiza a lista do ratio ativo.
  if (hasLegacyImages && !hasRatioSpecific11 && !hasRatioSpecific34) {
    if (nextImageRatio === '3:4') {
      next34 = data.imagens_principais || [];
    } else {
      next11 = data.imagens_principais || [];
    }
  }

  if (hasRatioSpecific11 || (hasLegacyImages && nextImageRatio !== '3:4')) {
    updateData.imagens_principais_1_1 = next11;
  }
  if (hasRatioSpecific34 || (hasLegacyImages && nextImageRatio === '3:4')) {
    updateData.imagens_principais_3_4 = next34;
  }

  const nextLegacyImages = next11.length > 0 ? next11 : next34;
  if (hasLegacyImages) {
    updateData.imagens_principais = data.imagens_principais || nextLegacyImages;
  } else if (hasRatioSpecific11 || hasRatioSpecific34 || data.imagem_ratio_principal !== undefined) {
    updateData.imagens_principais = nextLegacyImages;
  }
  if (data.condition !== undefined) updateData.condition = 'NEW';
  if (data.is_pre_order !== undefined) updateData.is_pre_order = data.is_pre_order;
  if (data.days_to_ship !== undefined) updateData.days_to_ship = data.days_to_ship;
  if (data.size_chart_id !== undefined) updateData.size_chart_id = data.size_chart_id;
  if (data.description_type !== undefined) updateData.description_type = data.description_type;
  if (data.extended_description !== undefined) updateData.extended_description = data.extended_description;
  if (data.wholesale !== undefined) updateData.wholesale = data.wholesale;
  if (data.ncm_padrao !== undefined) updateData.ncm_padrao = data.ncm_padrao || SHOPEE_BR_TAX_DEFAULTS.ncm;
  if (data.cest_padrao !== undefined) updateData.cest_padrao = data.cest_padrao || SHOPEE_BR_TAX_DEFAULTS.cest;
  if (data.template_id !== undefined) updateData.template_id = data.template_id;
  
  await docRef.update(updateData);
  
  const updatedDoc = await docRef.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  } as ShopeeProduct;
}

/**
 * Exclui um produto/rascunho
 */
export async function deleteProduct(id: string, userId: string): Promise<boolean> {
  const docRef = db.collection(PRODUCTS_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  const data = doc.data() as ShopeeProduct;
  
  // Verifica se o usuário é o dono
  if (getProductOwnerId(data) !== userId) {
    throw new Error('Sem permissão para excluir este produto');
  }

  const shopeeItemId = data.item_id ?? data.shopee_item_id;
  const isPublished = (data.status === 'created' || data.status === 'published') && !!shopeeItemId;

  if (isPublished && shopeeItemId) {
    const accessToken = await ensureValidToken(data.shop_id);
    const response = await callShopeeApi({
      path: '/api/v2/product/delete_item',
      method: 'POST',
      shopId: data.shop_id,
      accessToken,
      body: {
        item_id: shopeeItemId,
      },
    }) as ShopeeDeleteItemResponse;

    if (response.error && response.error !== '' && response.error !== '-') {
      throw new Error(`Erro ao excluir anúncio na Shopee: ${response.error} - ${response.message || 'sem detalhes'}`);
    }
  }

  await docRef.delete();
  return true;
}

/**
 * Publica um rascunho na Shopee
 * Se dryRun=true, retorna o payload sem chamar a API (para debug)
 */
export async function publishProduct(
  id: string,
  userId: string,
  dryRun: boolean = false
): Promise<ShopeeProduct | Record<string, unknown>> {
  const docRef = db.collection(PRODUCTS_COLLECTION).doc(id);
  const publishStartedAt = Date.now();
  const publishContext: PublishLogContext = {
    product_id: id,
    user_id: userId,
    dry_run: dryRun,
  };
  logPublishEvent('info', 'publish.request.start', publishContext);

  let publishLockToken: string | null = null;
  let product: ShopeeProduct;

  if (dryRun) {
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Produto nao encontrado');
    }

    product = { id: doc.id, ...doc.data() } as ShopeeProduct;
    if (getProductOwnerId(product) !== userId) {
      throw new Error('Sem permissao para publicar este produto');
    }
    publishContext.shop_id = product.shop_id;
  } else {
    const now = admin.firestore.Timestamp.now();
    const lockToken = buildPublishLockToken(id);
    const lockExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + PUBLISH_LOCK_TTL_MS);

    const lockedState = await runPublishStage('lock', publishContext, async () => {
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists) {
          throw new Error('Produto nao encontrado');
        }

        const currentProduct = { id: snapshot.id, ...snapshot.data() } as ShopeeProduct;
        publishContext.shop_id = currentProduct.shop_id;

        if (getProductOwnerId(currentProduct) !== userId) {
          throw new Error('Sem permissao para publicar este produto');
        }

        const existingItemId = currentProduct.item_id ?? currentProduct.shopee_item_id;
        if ((currentProduct.status === 'created' || currentProduct.status === 'published') && existingItemId) {
          return {
            alreadyPublished: true,
            product: currentProduct,
            lockToken: null as string | null,
          };
        }

        if (currentProduct.status === 'publishing' && isPublishLockActive((currentProduct as any).publish_lock)) {
          throw new Error('Publicacao ja em andamento para este rascunho');
        }

        transaction.update(docRef, {
          status: 'publishing',
          updated_at: now,
          publish_lock: {
            token: lockToken,
            owner: userId,
            acquired_at: now,
            expires_at: lockExpiresAt,
          },
        });

        return {
          alreadyPublished: false,
          product: currentProduct,
          lockToken,
        };
      });
    }, { lock_ttl_ms: PUBLISH_LOCK_TTL_MS });

    if (lockedState.alreadyPublished) {
      logPublishEvent('info', 'publish.request.idempotent', publishContext, {
        item_id: lockedState.product.item_id ?? lockedState.product.shopee_item_id ?? null,
      });
      return lockedState.product;
    }

    product = lockedState.product;
    publishLockToken = lockedState.lockToken;
    publishContext.shop_id = product.shop_id;
    publishContext.lock_token = publishLockToken;
  }

  let createdItemId: number | null = null;
  let formattedName = '';
  let formattedDescription = '';
  let sizeChartIdForPublish: number | undefined = product.size_chart_id || undefined;
  const imageUrls11 = normalizeImageUrlList(product.imagens_principais_1_1);
  const imageUrls34 = normalizeImageUrlList(product.imagens_principais_3_4);
  const legacyImageUrls = normalizeImageUrlList(product.imagens_principais);
  const mainImageRatioForAdd: '1:1' | '3:4' = imageUrls11.length > 0
    ? '1:1'
    : imageUrls34.length > 0
      ? '3:4'
      : product.imagem_ratio_principal === '3:4'
        ? '3:4'
        : '1:1';
  const mainImageUrlsForAdd = imageUrls11.length > 0
    ? imageUrls11
    : imageUrls34.length > 0
      ? imageUrls34
      : legacyImageUrls;
  const shouldSyncImages34AfterCreate = imageUrls34.length > 0 && mainImageRatioForAdd !== '3:4';

  try {
    await runPublishStage('validation', publishContext, async () => {
      sizeChartIdForPublish = await resolveSizeChartIdForPublish(product);
      const productForValidation = {
        ...product,
        size_chart_id: sizeChartIdForPublish,
      } as ShopeeProduct;

      const tecido = await getTecidoData(product.tecido_id);
      const preferredTitle = product.titulo_anuncio?.trim() || product.tecido_nome;
      formattedName = formatItemName(
        preferredTitle,
        tecido?.nome,
        tecido?.composicao
      );
      formattedDescription = formatDescription(
        product.descricao,
        tecido?.nome,
        tecido?.composicao,
        tecido?.largura
      );

      const validation = validateProductForPublish({
        item_name: formattedName,
        description: formattedDescription,
        price: product.preco_base,
        stock: product.estoque_padrao,
        weight: product.peso,
        dimensions: product.dimensoes,
        images: mainImageUrlsForAdd,
        tier_variations: product.tier_variations.map(t => ({
          tier_name: t.tier_name,
          options: t.options.map(o => ({ option_name: o.option_name })),
        })),
        item_sku: product.tecido_sku,
        category_id: product.categoria_id,
      });

      if (!validation.valid) {
        throw new Error(`Validacao falhou: ${validation.errors.join('; ')}`);
      }

      if (validation.warnings.length > 0) {
        logPublishEvent('warn', 'publish.validation.warnings', publishContext, {
          warnings: validation.warnings,
        });
      }

      await validatePrePublishRequirements(productForValidation);
    });

    const accessToken = dryRun ? 'DRY_RUN' : await ensureValidToken(product.shop_id);

    const compatibleLogisticInfo = await logisticsService.buildLogisticInfoForProduct(
      product.shop_id,
      product.peso,
      product.dimensoes
    );

    const configuredLogisticInfo = Array.isArray(product.logistic_info)
      ? product.logistic_info
      : [];
    const enabledConfiguredLogisticInfo = configuredLogisticInfo.filter((item) => item.enabled);

    let logisticInfo = compatibleLogisticInfo;

    if (configuredLogisticInfo.length > 0 && enabledConfiguredLogisticInfo.length === 0) {
      throw new Error('Nenhum canal de logistica foi habilitado no rascunho');
    }

    if (enabledConfiguredLogisticInfo.length > 0) {
      const selectedById = new Map(
        enabledConfiguredLogisticInfo.map((item) => [item.logistic_id, item] as const)
      );
      const selectedCompatible = compatibleLogisticInfo
        .filter((item) => selectedById.has(item.logistic_id))
        .map((item) => {
          const selected = selectedById.get(item.logistic_id)!;
          return {
            ...item,
            ...(selected.size_id ? { size_id: selected.size_id } : {}),
            ...(selected.is_free !== undefined ? { is_free: selected.is_free } : {}),
            ...(selected.shipping_fee !== undefined ? { shipping_fee: selected.shipping_fee } : {}),
          };
        });

      if (selectedCompatible.length === 0) {
        throw new Error('Nenhum canal de logistica selecionado e compativel com peso/dimensoes do produto');
      }

      logisticInfo = selectedCompatible;
      logPublishEvent('info', 'publish.logistics.selected_from_ui', publishContext, {
        logistic_channel_count: logisticInfo.length,
      });
    } else {
      logPublishEvent('info', 'publish.logistics.auto_selected', publishContext, {
        logistic_channel_count: logisticInfo.length,
      });
    }

    const { processedMainImagesForAdd, processedMainImages34, processedTierVariations } = await runPublishStage(
      'upload',
      publishContext,
      async () => {
        if (dryRun) {
          return {
            processedMainImagesForAdd: mainImageUrlsForAdd.map((_, i) => `DRY_RUN_IMAGE_ADD_${i}`),
            processedMainImages34: shouldSyncImages34AfterCreate
              ? imageUrls34.map((_, i) => `DRY_RUN_IMAGE_34_${i}`)
              : null,
            processedTierVariations: product.tier_variations.map((tier, tierIndex) => ({
              name: tier.tier_name,
              option_list: tier.options.map((opt) => ({
                option: opt.option_name,
                ...(tierIndex === 0 && opt.imagem_url ? { image: { image_id: `DRY_RUN_VAR_${opt.option_name}` } } : {}),
              })),
            })),
          };
        }

        const mainImagesForAdd = await processImagesForPublish(
          product.shop_id,
          accessToken,
          mainImageUrlsForAdd,
          mainImageRatioForAdd,
          product.usar_imagens_publicas
        );

        const mainImages34 = shouldSyncImages34AfterCreate
          ? await processImagesForPublish(
              product.shop_id,
              accessToken,
              imageUrls34,
              '3:4',
              product.usar_imagens_publicas
            )
          : null;

        const tierVariations = await Promise.all(
          product.tier_variations.map(async (tier, tierIndex) => {
            const processedOptions = await mapWithConcurrency(
              tier.options,
              IMAGE_UPLOAD_POOL_SIZE,
              async (opt) => {
                if (tierIndex === 0 && opt.imagem_url) {
                  const isGeneratedImage = opt.imagem_gerada || /\/gerada_/i.test(opt.imagem_url);
                  const imageId = isGeneratedImage
                    ? await withUploadRetry(`tier_generated:${opt.option_name}`, () =>
                        uploadImageToShopee(
                          product.shop_id,
                          accessToken,
                          opt.imagem_url!,
                          mainImageRatioForAdd
                        )
                      )
                    : await withUploadRetry(`tier_overlay:${opt.option_name}`, () =>
                        uploadVariationImageToShopee(
                          product.shop_id,
                          accessToken,
                          opt.imagem_url!,
                          opt.option_name,
                          mainImageRatioForAdd
                        )
                      );
                  return {
                    option: opt.option_name,
                    image: { image_id: imageId },
                  };
                }
                return {
                  option: opt.option_name,
                };
              }
            );
            return {
              name: tier.tier_name,
              option_list: processedOptions,
            };
          })
        );

        return {
          processedMainImagesForAdd: mainImagesForAdd,
          processedMainImages34: mainImages34,
          processedTierVariations: tierVariations,
        };
      },
      {
        main_image_count: mainImageUrlsForAdd.length,
        main_image_count_34: imageUrls34.length,
        tier_variation_count: product.tier_variations.length,
      }
    );

    // Monta payload para API Shopee
    const shopeePayload: Record<string, unknown> = {
      item_name: formattedName,
      description: formattedDescription,
      item_sku: product.tecido_sku,
      original_price: product.preco_base,
      seller_stock: [{
        stock: product.estoque_padrao,
      }],
      category_id: product.categoria_id,
      weight: product.peso,
      dimension: {
        package_length: product.dimensoes.comprimento,
        package_width: product.dimensoes.largura,
        package_height: product.dimensoes.altura,
      },
      image: {
        image_id_list: processedMainImagesForAdd,
        ...(mainImageRatioForAdd === '3:4' ? { image_ratio: '3:4' } : {}),
      },
      // tier_variation e model NAO vao no add_item - sao enviados via init_tier_variation
      logistic_info: logisticInfo,
      condition: 'NEW',
      item_status: 'NORMAL',
      pre_order: {
        is_pre_order: product.is_pre_order || false,
        ...(product.is_pre_order && product.days_to_ship ? { days_to_ship: product.days_to_ship } : {}),
      },
    };

    // tax_info no nivel do item (NAO por model)
    const normalizedNcm = normalizeNcm(product.ncm_padrao) || SHOPEE_BR_TAX_DEFAULTS.ncm;
    shopeePayload.tax_info = {
      ncm: normalizedNcm,
      cest: normalizeCest(product.cest_padrao || SHOPEE_BR_TAX_DEFAULTS.cest),
      same_state_cfop: SHOPEE_BR_TAX_DEFAULTS.same_state_cfop,
      diff_state_cfop: SHOPEE_BR_TAX_DEFAULTS.diff_state_cfop,
      csosn: SHOPEE_BR_TAX_DEFAULTS.csosn,
      origin: SHOPEE_BR_TAX_DEFAULTS.origin,
      measure_unit: SHOPEE_BR_TAX_DEFAULTS.measure_unit,
    };

    // Adiciona video se disponivel
    if (product.video_url) {
      shopeePayload.video = {
        video_url: product.video_url,
      };
    }

    // Adiciona atributos se disponiveis
    // Normaliza formato: Shopee exige value_id=0 para valores customizados (texto livre)
    if (product.atributos && product.atributos.length > 0) {
      shopeePayload.attribute_list = product.atributos.map((attr) => ({
        attribute_id: attr.attribute_id,
        attribute_value_list: (attr.attribute_value_list || []).map((val) => {
          // Se ja tem value_id > 0, manter (opcao existente da Shopee)
          if (val.value_id !== undefined && val.value_id !== null && val.value_id > 0) {
            return { value_id: val.value_id };
          }
          // Texto livre: obrigatorio ter value_id=0 + original_value_name
          if (val.original_value_name) {
            return {
              value_id: 0,
              original_value_name: val.original_value_name,
              ...(val.value_unit ? { value_unit: val.value_unit } : {}),
            };
          }
          return val;
        }),
      }));
    }

    // Adiciona marca (brand_id + original_brand_name sao obrigatorios dentro do objeto brand)
    // brand_id=0 + original_brand_name="No Brand" quando sem marca
    if (product.brand_id !== null && product.brand_id !== undefined) {
      shopeePayload.brand = {
        brand_id: product.brand_id,
        original_brand_name: product.brand_nome || (product.brand_id === 0 ? 'No Brand' : ''),
      };
    } else {
      // Se brand_id nao foi definido, envia "Sem marca" por padrao
      shopeePayload.brand = {
        brand_id: 0,
        original_brand_name: 'No Brand',
      };
    }

    // Adiciona size chart se disponivel (contrato v2)
    if (sizeChartIdForPublish) {
      shopeePayload.size_chart_info = {
        size_chart_id: sizeChartIdForPublish,
      };
    }

    // Adiciona descricao estendida se disponivel (para vendedores whitelisted)
    if (product.description_type === 'extended' && product.extended_description) {
      shopeePayload.description_type = 'extended';
      shopeePayload.extended_description = product.extended_description;
    }

    // Adiciona configuracao de atacado se disponivel
    if (product.wholesale && product.wholesale.length > 0) {
      shopeePayload.wholesale = product.wholesale;
    }

    // Remove valores undefined do payload (Firestore/Shopee nao aceitam)
    const cleanPayload = removeUndefinedValues(shopeePayload);

    logPublishEvent('info', 'publish.add_item.payload_summary', publishContext, {
      main_image_count: processedMainImagesForAdd.length,
      main_image_count_34: processedMainImages34?.length || 0,
      main_image_ratio: mainImageRatioForAdd,
      logistic_channel_count: logisticInfo.length,
      has_attributes: !!(product.atributos && product.atributos.length > 0),
      has_video: !!product.video_url,
      has_size_chart: !!sizeChartIdForPublish,
      has_wholesale: !!(product.wholesale && product.wholesale.length > 0),
    });

    // Modo dry-run: retorna payload sem chamar API (para debug/teste)
    if (dryRun) {
      logPublishEvent('info', 'publish.request.dry_run.success', publishContext, {
        duration_ms: Date.now() - publishStartedAt,
      });
      return {
        add_item: cleanPayload,
        init_tier_variation: {
          item_id: 'DRY_RUN_ITEM_ID',
          standardise_tier_variation: processedTierVariations.map((tier, tierIndex) => ({
            variation_id: 0,
            variation_group_id: 0,
            variation_name: tier.name,
            variation_option_list: tier.option_list.map(opt => ({
              variation_option_id: 0,
              variation_option_name: opt.option,
              ...(tierIndex === 0 && opt.image ? { image_id: opt.image.image_id } : {}),
            })),
          })),
          model: product.modelos.map(m => ({
            tier_index: m.tier_index,
            model_sku: m.model_sku,
            original_price: m.preco || product.preco_base,
            seller_stock: [{ stock: m.estoque }],
          })),
        },
        ...(processedMainImages34 && processedMainImages34.length > 0
          ? {
              update_item_image_ratio_3_4: {
                item_id: 'DRY_RUN_ITEM_ID',
                image: {
                  image_id_list: processedMainImages34,
                  image_ratio: '3:4',
                },
              },
              update_item_promotion_images_3_4_fallback: {
                item_id: 'DRY_RUN_ITEM_ID',
                promotion_images: {
                  image_id_list: processedMainImages34,
                },
              },
            }
          : {}),
      };
    }

    const addItemResponse = await runPublishStage('add_item', publishContext, async () => {
      const response = await callShopeeApi({
        path: '/api/v2/product/add_item',
        method: 'POST',
        shopId: product.shop_id,
        accessToken,
        body: cleanPayload,
      }) as ShopeeAddItemResponse;

      if (response.error) {
        throw new Error(`Erro Shopee: ${response.error} - ${response.message}`);
      }

      if (!response.response?.item_id) {
        throw new Error('Shopee nao retornou item_id');
      }

      return response;
    }, {
      logistic_channel_count: logisticInfo.length,
    });
    const itemId = addItemResponse.response!.item_id;

    createdItemId = itemId;
    logPublishEvent('info', 'publish.add_item.item_created', publishContext, {
      item_id: itemId,
    });

    // === INIT TIER VARIATION ===
    const initTierPayload = {
      item_id: itemId,
      standardise_tier_variation: processedTierVariations.map((tier, tierIndex) => ({
        variation_id: 0,
        variation_group_id: 0,
        variation_name: tier.name,
        variation_option_list: tier.option_list.map(opt => ({
          variation_option_id: 0,
          variation_option_name: opt.option,
          ...(tierIndex === 0 && opt.image ? { image_id: opt.image.image_id } : {}),
        })),
      })),
      model: product.modelos.map(modelo => ({
        tier_index: modelo.tier_index,
        model_sku: modelo.model_sku,
        original_price: modelo.preco || product.preco_base,
        seller_stock: [{ stock: modelo.estoque }],
      })),
    };

    const tierResponse = await runPublishStage('init_tier_variation', publishContext, async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await callShopeeApi({
        path: '/api/v2/product/init_tier_variation',
        method: 'POST',
        shopId: product.shop_id,
        accessToken,
        body: removeUndefinedValues(initTierPayload),
      }) as ShopeeInitTierResponse;

      if (response.error && response.error !== '' && response.error !== '-') {
        throw new Error(`Erro ao criar variacoes: ${response.error} - ${response.message}`);
      }

      return response;
    }, {
      item_id: itemId,
      model_count: product.modelos.length,
      tier_variation_count: processedTierVariations.length,
    });
    logPublishEvent('info', 'publish.init_tier_variation.models_created', publishContext, {
      item_id: itemId,
      created_model_count: tierResponse.response?.model?.length || 0,
    });

    if (
      processedMainImages34 &&
      processedMainImages34.length > 0
    ) {
      // Aguardar propagacao do item na Shopee antes de update_item (evita error_item_or_variation_not_found)
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const updateItemImage34Response = await callShopeeApi({
          path: '/api/v2/product/update_item',
          method: 'POST',
          shopId: product.shop_id,
          accessToken,
          body: removeUndefinedValues({
            item_id: itemId,
            image: {
              image_id_list: processedMainImages34,
              image_ratio: '3:4',
            },
          }),
        }) as { error?: string; message?: string };

        if (updateItemImage34Response.error && updateItemImage34Response.error !== '' && updateItemImage34Response.error !== '-') {
          throw new Error(`Erro ao sincronizar imagens 3:4: ${updateItemImage34Response.error} - ${updateItemImage34Response.message || 'sem detalhes'}`);
        }

        logPublishEvent('info', 'publish.update_item.image_ratio_3_4.success', publishContext, {
          item_id: itemId,
          image_count_34: processedMainImages34.length,
        });
      } catch (updateImageError) {
        const firstErrorMsg = toErrorMessage(updateImageError);
        logPublishEvent('warn', 'publish.update_item.image_ratio_3_4.failed', publishContext, {
          item_id: itemId,
          image_count_34: processedMainImages34.length,
          error: firstErrorMsg,
        });

        // Se o erro for "item not found", aguardar mais e tentar novamente com image_ratio
        const isNotFoundError = firstErrorMsg.includes('not_found') || firstErrorMsg.includes('not found');
        if (isNotFoundError) {
          logPublishEvent('info', 'publish.update_item.image_ratio_3_4.retry_after_delay', publishContext, {
            item_id: itemId,
            delay_ms: 5000,
          });
          await new Promise(resolve => setTimeout(resolve, 5000));

          try {
            const retryResponse = await callShopeeApi({
              path: '/api/v2/product/update_item',
              method: 'POST',
              shopId: product.shop_id,
              accessToken,
              body: removeUndefinedValues({
                item_id: itemId,
                image: {
                  image_id_list: processedMainImages34,
                  image_ratio: '3:4',
                },
              }),
            }) as { error?: string; message?: string };

            if (retryResponse.error && retryResponse.error !== '' && retryResponse.error !== '-') {
              throw new Error(`Erro ao sincronizar imagens 3:4 (retry): ${retryResponse.error} - ${retryResponse.message || 'sem detalhes'}`);
            }
            logPublishEvent('info', 'publish.update_item.image_ratio_3_4.retry_success', publishContext, {
              item_id: itemId,
              image_count_34: processedMainImages34.length,
            });
            // Retry com sucesso — pula o fallback de promotion_images
          } catch (retryError) {
            logPublishEvent('warn', 'publish.update_item.image_ratio_3_4.retry_failed', publishContext, {
              item_id: itemId,
              error: toErrorMessage(retryError),
            });
          }
        }

        // Fallback: tenta como promotion_images
        try {
          const updateItemResponse = await callShopeeApi({
            path: '/api/v2/product/update_item',
            method: 'POST',
            shopId: product.shop_id,
            accessToken,
            body: removeUndefinedValues({
              item_id: itemId,
              promotion_images: {
                image_id_list: processedMainImages34,
              },
            }),
          }) as { error?: string; message?: string };

          if (updateItemResponse.error && updateItemResponse.error !== '' && updateItemResponse.error !== '-') {
            throw new Error(`Erro ao sincronizar promotion_images 3:4: ${updateItemResponse.error} - ${updateItemResponse.message || 'sem detalhes'}`);
          }
          logPublishEvent('info', 'publish.update_item.promotion_images_3_4.success', publishContext, {
            item_id: itemId,
            image_count_34: processedMainImages34.length,
          });
        } catch (promotionImageError) {
          logPublishEvent('warn', 'publish.update_item.promotion_images_3_4.failed', publishContext, {
            item_id: itemId,
            image_count_34: processedMainImages34.length,
            error: toErrorMessage(promotionImageError),
          });
        }
      }
    }

    // Atualiza produto com sucesso
    await runPublishStage('persist', publishContext, async () => {
      const now = admin.firestore.Timestamp.now();
      await docRef.update({
        item_id: itemId,
        status: 'created',
        published_at: now,
        updated_at: now,
        last_synced_at: now,
        sync_status: 'synced',
        ...(sizeChartIdForPublish ? { size_chart_id: sizeChartIdForPublish } : {}),
        publish_lock: admin.firestore.FieldValue.delete(),
        error_message: admin.firestore.FieldValue.delete(),
      });

      await preferencesService.updateLastUsedValues(userId, {
        preco_base: product.preco_base,
        estoque_padrao: product.estoque_padrao,
        categoria_id: product.categoria_id,
        peso: product.peso,
        dimensoes: product.dimensoes,
      });

      if (product.ncm_padrao || product.cest_padrao || product.categoria_nome) {
        await preferencesService.saveUserPreferences(userId, {
          ...(product.ncm_padrao ? { ncm_padrao: product.ncm_padrao } : {}),
          ...(product.cest_padrao ? { cest_padrao: product.cest_padrao } : {}),
          ...(product.categoria_nome ? { categoria_nome_padrao: product.categoria_nome } : {}),
        });
      }
    }, { item_id: itemId });

    const updatedDoc = await docRef.get();
    logPublishEvent('info', 'publish.request.success', publishContext, {
      duration_ms: Date.now() - publishStartedAt,
      item_id: itemId,
    });
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as ShopeeProduct;

  } catch (error: any) {
    let finalErrorMessage = error?.message || 'Erro ao publicar produto';

    // Rollback: se add_item criou item mas init_tier_variation falhou
    if (!dryRun && createdItemId) {
      try {
        await runPublishStage('rollback', publishContext, async () => {
          const rollbackToken = await ensureValidToken(product.shop_id);
          const rollbackResponse = await callShopeeApi({
            path: '/api/v2/product/delete_item',
            method: 'POST',
            shopId: product.shop_id,
            accessToken: rollbackToken,
            body: {
              item_id: createdItemId,
            },
          }) as ShopeeDeleteItemResponse;

          if (rollbackResponse.error && rollbackResponse.error !== '' && rollbackResponse.error !== '-') {
            throw new Error(`${rollbackResponse.error} - ${rollbackResponse.message || 'sem detalhes'}`);
          }
        }, { item_id: createdItemId });
        finalErrorMessage = `${finalErrorMessage} | rollback add_item concluido`;
      } catch (rollbackError: any) {
        finalErrorMessage = `${finalErrorMessage} | rollback falhou: ${rollbackError?.message || 'erro desconhecido'}`;
      }
    }

    if (!dryRun) {
      try {
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) return;

          const currentData = snapshot.data() as any;
          const updatePayload: Record<string, unknown> = {
            status: 'error',
            error_message: finalErrorMessage,
            updated_at: admin.firestore.Timestamp.now(),
          };

          const currentLock = currentData?.publish_lock;
          if (!currentLock || !publishLockToken || currentLock.token === publishLockToken || !isPublishLockActive(currentLock)) {
            updatePayload.publish_lock = admin.firestore.FieldValue.delete();
          }

          transaction.update(docRef, updatePayload);
        });
      } catch (persistError: any) {
        logPublishEvent('error', 'publish.persist_error.failed', publishContext, {
          error: persistError?.message || String(persistError),
        });
      }
    }

    logPublishEvent('error', 'publish.request.error', publishContext, {
      duration_ms: Date.now() - publishStartedAt,
      item_id: createdItemId ?? null,
      error: finalErrorMessage,
    });
    throw new Error(finalErrorMessage);
  }
}
