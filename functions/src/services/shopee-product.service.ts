import admin from '../config/firebase';
import {
  ShopeeProduct,
  CreateShopeeProductData,
  TierVariation,
  ProductModel,
  ShopeeAddItemResponse,
  ShopeeDeleteItemResponse,
  ShopeeInitTierResponse,
  ShopeeUploadImageResponse,
} from '../types/shopee-product.types';
import { callShopeeApi, ensureValidToken, uploadImageToShopeeMultipart } from './shopee.service';
import * as preferencesService from './shopee-preferences.service';
import * as imageCompressor from './image-compressor.service';
import * as logisticsService from './shopee-logistics.service';
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

/**
 * Faz upload de uma imagem para o Shopee Media Space
 * Comprime a imagem se necessário (target: 1.99MB)
 */
async function uploadImageToShopee(
  shopId: number,
  accessToken: string,
  imageUrl: string
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
    filename
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
 * Pipeline: download raw → applyBrandOverlay → comprimir → upload
 */
async function uploadVariationImageToShopee(
  shopId: number,
  accessToken: string,
  imageUrl: string,
  colorName: string
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
    shopId, accessToken, buffer, filename
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
  _usarImagensPublicas: boolean = false
): Promise<string[]> {
  const imageIds: string[] = [];

  for (const url of imageUrls) {
    try {
      const imageId = await uploadImageToShopee(shopId, accessToken, url);
      imageIds.push(imageId);
      console.log(`[processImages] Upload OK: ${url.substring(0, 80)}... -> image_id=${imageId}`);
    } catch (error: any) {
      console.error(`[processImages] FALHA upload ${url.substring(0, 80)}...: ${error.message}`);
      throw error;
    }
  }

  return imageIds;
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
  
  // Imagens principais (usa imagem do tecido como padrão se não fornecidas)
  const imagensPrincipais = data.imagens_principais && data.imagens_principais.length > 0
    ? data.imagens_principais
    : tecido.imagemUrl ? [tecido.imagemUrl] : [];
  
  const now = admin.firestore.Timestamp.now();
  
  const productData = {
    shop_id: data.shop_id,
    tecido_id: data.tecido_id,
    tecido_nome: tecido.nome,
    tecido_sku: tecido.sku,
    imagens_principais: imagensPrincipais,
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
    condition: data.condition || 'NEW',
    is_pre_order: data.is_pre_order ?? false,
    days_to_ship: data.days_to_ship ?? (data.is_pre_order ? 7 : 2),
    size_chart_id: data.size_chart_id || null,
    description_type: data.description_type || 'normal',
    extended_description: data.extended_description || null,
    wholesale: data.wholesale || null,
    ncm_padrao: data.ncm_padrao || null,
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
  if (data.imagens_principais !== undefined) updateData.imagens_principais = data.imagens_principais;
  if (data.condition !== undefined) updateData.condition = data.condition;
  if (data.is_pre_order !== undefined) updateData.is_pre_order = data.is_pre_order;
  if (data.days_to_ship !== undefined) updateData.days_to_ship = data.days_to_ship;
  if (data.size_chart_id !== undefined) updateData.size_chart_id = data.size_chart_id;
  if (data.description_type !== undefined) updateData.description_type = data.description_type;
  if (data.extended_description !== undefined) updateData.extended_description = data.extended_description;
  if (data.wholesale !== undefined) updateData.wholesale = data.wholesale;
  if (data.ncm_padrao !== undefined) updateData.ncm_padrao = data.ncm_padrao;
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
  const doc = await docRef.get();
  
  if (!doc.exists) {
    throw new Error('Produto não encontrado');
  }
  
  const product = { id: doc.id, ...doc.data() } as ShopeeProduct;
  
  // Verifica se o usuário é o dono
  if (getProductOwnerId(product) !== userId) {
    throw new Error('Sem permissão para publicar este produto');
  }
  
  // Verifica se já está publicado
  if (product.status === 'created' && product.item_id) {
    throw new Error('Produto já está publicado');
  }
  
  // Busca dados do tecido para formatação
  const tecido = await getTecidoData(product.tecido_id);
  
  // Formata nome e descrição para atender requisitos mínimos
  const preferredTitle = product.titulo_anuncio?.trim() || product.tecido_nome;
  const formattedName = formatItemName(
    preferredTitle,
    tecido?.nome,
    tecido?.composicao
  );
  const formattedDescription = formatDescription(
    product.descricao,
    tecido?.nome,
    tecido?.composicao,
    tecido?.largura
  );
  
  // Valida produto antes de publicar
  console.log('Validando produto...');
  const validation = validateProductForPublish({
    item_name: formattedName,
    description: formattedDescription,
    price: product.preco_base,
    stock: product.estoque_padrao,
    weight: product.peso,
    dimensions: product.dimensoes,
    images: product.imagens_principais,
    tier_variations: product.tier_variations.map(t => ({
      tier_name: t.tier_name,
      options: t.options.map(o => ({ option_name: o.option_name })),
    })),
    item_sku: product.tecido_sku,
    category_id: product.categoria_id,
  });
  
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.errors.join('; ')}`);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Avisos de validação:', validation.warnings);
  }
  
  // Atualiza status para publishing (pula no dry-run)
  if (!dryRun) {
    await docRef.update({
      status: 'publishing',
      updated_at: admin.firestore.Timestamp.now(),
    });
  }
  
  try {
    const accessToken = dryRun ? 'DRY_RUN' : await ensureValidToken(product.shop_id);

    // Busca canais de logística compatíveis com peso/dimensões
    console.log('Buscando canais de logística...');
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
      throw new Error('Nenhum canal de logística foi habilitado no rascunho');
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
        throw new Error('Nenhum canal de logística selecionado é compatível com peso/dimensões do produto');
      }

      logisticInfo = selectedCompatible;
      console.log(`${logisticInfo.length} canal(is) de logística configurado(s) pela UI`);
    } else {
      console.log(`${logisticInfo.length} canal(is) de logística configurado(s) automaticamente`);
    }

    let processedMainImages: string[];
    let processedTierVariations: Array<{ name: string; option_list: Array<{ option: string; image?: { image_id: string } }> }>;

    if (dryRun) {
      // Dry-run: usa placeholders sem fazer upload
      processedMainImages = product.imagens_principais.map((_, i) => `DRY_RUN_IMAGE_${i}`);
      processedTierVariations = product.tier_variations.map((tier, tierIndex) => ({
        name: tier.tier_name,
        option_list: tier.options.map((opt) => ({
          option: opt.option_name,
          ...(tierIndex === 0 && opt.imagem_url ? { image: { image_id: `DRY_RUN_VAR_${opt.option_name}` } } : {}),
        })),
      }));
      console.log('[publishProduct] DRY-RUN: imagens substituídas por placeholders');
    } else {
      // Processa imagens principais (comprime se necessário)
      console.log('Processando imagens principais...');
      processedMainImages = await processImagesForPublish(
        product.shop_id,
        accessToken,
        product.imagens_principais,
        product.usar_imagens_publicas
      );

      // Processa imagens de variação (cores) - apenas tier 1
      // Shopee exige: se uma opção do tier 1 tem imagem, TODAS devem ter
      console.log('Processando imagens de variação...');
      processedTierVariations = await Promise.all(
        product.tier_variations.map(async (tier, tierIndex) => {
          const processedOptions = await Promise.all(
            tier.options.map(async (opt) => {
              // Apenas tier 1 (index 0) pode ter imagens
              if (tierIndex === 0 && opt.imagem_url) {
                try {
                  const isGeneratedImage = opt.imagem_gerada || /\/gerada_/i.test(opt.imagem_url);
                  const imageId = isGeneratedImage
                    ? await uploadImageToShopee(
                        product.shop_id,
                        accessToken,
                        opt.imagem_url
                      )
                    : await uploadVariationImageToShopee(
                        product.shop_id,
                        accessToken,
                        opt.imagem_url,
                        opt.option_name
                      );
                  return {
                    option: opt.option_name,
                    image: { image_id: imageId },
                  };
                } catch (error: any) {
                  console.error(`[publishProduct] FALHA imagem variacao ${opt.option_name}: ${error.message}`);
                  throw error; // Se uma falhar, todas falham (obrigatoriedade)
                }
              }
              return {
                option: opt.option_name,
              };
            })
          );
          return {
            name: tier.tier_name,
            option_list: processedOptions,
          };
        })
      );
    }
    
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
        image_id_list: processedMainImages,
      },
      // tier_variation e model NAO vao no add_item — sao enviados via init_tier_variation
      logistic_info: logisticInfo,
      condition: product.condition || 'NEW',
      item_status: 'NORMAL',
      pre_order: {
        is_pre_order: product.is_pre_order || false,
        ...(product.is_pre_order && product.days_to_ship ? { days_to_ship: product.days_to_ship } : {}),
      },
    };

    // tax_info no nivel do item (NAO por model)
    if (product.ncm_padrao) {
      shopeePayload.tax_info = {
        ncm: product.ncm_padrao,
        same_state_cfop: '',
        diff_state_cfop: '',
        csosn: '',
        origin: '',
      };
    }
    
    // Adiciona vídeo se disponível
    if (product.video_url) {
      shopeePayload.video = {
        video_url: product.video_url,
      };
    }
    
    // Adiciona atributos se disponíveis
    if (product.atributos && product.atributos.length > 0) {
      shopeePayload.attribute_list = product.atributos;
    }
    
    // Adiciona marca (brand_id + original_brand_name são obrigatórios dentro do objeto brand)
    // brand_id=0 + original_brand_name="No Brand" quando sem marca
    if (product.brand_id !== null && product.brand_id !== undefined) {
      shopeePayload.brand = {
        brand_id: product.brand_id,
        original_brand_name: product.brand_nome || (product.brand_id === 0 ? 'No Brand' : ''),
      };
    } else {
      // Se brand_id não foi definido, envia "Sem marca" por padrão
      shopeePayload.brand = {
        brand_id: 0,
        original_brand_name: 'No Brand',
      };
    }
    
    // Adiciona size chart se disponível (contrato v2)
    if (product.size_chart_id) {
      shopeePayload.size_chart_info = {
        size_chart_id: product.size_chart_id,
      };
    }
    
    // Adiciona descrição estendida se disponível (para vendedores whitelisted)
    if (product.description_type === 'extended' && product.extended_description) {
      shopeePayload.description_type = 'extended';
      shopeePayload.extended_description = product.extended_description;
    }
    
    // Adiciona configuração de atacado se disponível
    if (product.wholesale && product.wholesale.length > 0) {
      shopeePayload.wholesale = product.wholesale;
    }
    
    // Remove valores undefined do payload (Firestore/Shopee não aceitam)
    const cleanPayload = removeUndefinedValues(shopeePayload);

    console.log('[publishProduct] Payload add_item:', JSON.stringify(cleanPayload, null, 2));

    // Modo dry-run: retorna payload sem chamar API (para debug/teste)
    if (dryRun) {
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
      };
    }

    const response = await callShopeeApi({
      path: '/api/v2/product/add_item',
      method: 'POST',
      shopId: product.shop_id,
      accessToken,
      body: cleanPayload,
    }) as ShopeeAddItemResponse;

    if (response.error) {
      console.error('[publishProduct] Resposta Shopee ERRO:', JSON.stringify(response));
      throw new Error(`Erro Shopee: ${response.error} - ${response.message}`);
    }
    
    const itemId = response.response?.item_id;
    
    if (!itemId) {
      throw new Error('Shopee não retornou item_id');
    }

    // === INIT TIER VARIATION ===
    // Shopee recomenda aguardar >= 5s após add_item antes de criar variantes
    console.log('[publishProduct] Aguardando 5s antes de init_tier_variation...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Transforma processedTierVariations (formato { name, option_list }) para
    // standardise_tier_variation (formato { variation_name, variation_option_list })
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

    console.log('[publishProduct] Chamando init_tier_variation...', JSON.stringify(initTierPayload, null, 2));

    const tierResponse = await callShopeeApi({
      path: '/api/v2/product/init_tier_variation',
      method: 'POST',
      shopId: product.shop_id,
      accessToken,
      body: removeUndefinedValues(initTierPayload),
    }) as ShopeeInitTierResponse;

    if (tierResponse.error && tierResponse.error !== '' && tierResponse.error !== '-') {
      console.error('[publishProduct] init_tier_variation ERRO:', JSON.stringify(tierResponse));
      throw new Error(`Erro ao criar variações: ${tierResponse.error} - ${tierResponse.message}`);
    }

    console.log(`[publishProduct] init_tier_variation OK - ${tierResponse.response?.model?.length || 0} modelos criados`);

    // Atualiza produto com sucesso
    const now = admin.firestore.Timestamp.now();
    await docRef.update({
      item_id: itemId,
      status: 'created',
      published_at: now,
      updated_at: now,
      last_synced_at: now,
      sync_status: 'synced',
    });
    
    // Atualiza últimos valores usados nas preferências
    await preferencesService.updateLastUsedValues(userId, {
      preco_base: product.preco_base,
      estoque_padrao: product.estoque_padrao,
      categoria_id: product.categoria_id,
      peso: product.peso,
      dimensoes: product.dimensoes,
    });
    
    // Salva NCM e categoria como preferência padrão
    if (product.ncm_padrao || product.categoria_nome) {
      await preferencesService.saveUserPreferences(userId, {
        ...(product.ncm_padrao ? { ncm_padrao: product.ncm_padrao } : {}),
        ...(product.categoria_nome ? { categoria_nome_padrao: product.categoria_nome } : {}),
      });
    }
    
    const updatedDoc = await docRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as ShopeeProduct;
    
  } catch (error: any) {
    // Atualiza status para erro
    await docRef.update({
      status: 'error',
      error_message: error.message,
      updated_at: admin.firestore.Timestamp.now(),
    });
    
    throw error;
  }
}
