import admin from '../config/firebase';
import { 
  ShopeeProduct, 
  CreateShopeeProductData, 
  TierVariation,
  ProductModel,
  ShopeeAddItemResponse,
  ShopeeUploadImageResponse,
} from '../types/shopee-product.types';
import { callShopeeApi, ensureValidToken, uploadImageToShopeeMultipart } from './shopee.service';
import * as preferencesService from './shopee-preferences.service';
import * as imageCompressor from './image-compressor.service';
import * as logisticsService from './shopee-logistics.service';
import { 
  validateProductForPublish, 
  formatItemName, 
  formatDescription,
} from '../utils/shopee-validation';

const db = admin.firestore();
const PRODUCTS_COLLECTION = 'shopee_products';
const TECIDOS_COLLECTION = 'tecidos';
const COR_TECIDO_COLLECTION = 'cor_tecido';
const TAMANHOS_COLLECTION = 'tamanhos';

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
  
  return response.response?.image_info?.image_url || imageUrl;
}

/**
 * Processa imagens para publicação
 * Se usar_imagens_publicas = true, usa URLs diretas
 * Se usar_imagens_publicas = false, faz upload para Shopee
 */
async function processImagesForPublish(
  shopId: number,
  accessToken: string,
  imageUrls: string[],
  usarImagensPublicas: boolean
): Promise<string[]> {
  if (usarImagensPublicas) {
    // Usa URLs públicas diretamente
    // Mas ainda verifica se precisam de compressão e faz upload se > 2MB
    const processedUrls: string[] = [];
    
    for (const url of imageUrls) {
      try {
        const { buffer } = await imageCompressor.downloadAndCompressImage(url);
        
        // Se a imagem original era > 2MB, precisamos fazer upload da versão comprimida
        if (buffer.length > 1.99 * 1024 * 1024) {
          // Não deveria acontecer após compressão, mas por segurança
          const uploadedUrl = await uploadImageToShopee(shopId, accessToken, url);
          processedUrls.push(uploadedUrl);
        } else {
          // Usa URL original se está dentro do limite
          processedUrls.push(url);
        }
      } catch (error) {
        console.error(`Erro ao processar imagem ${url}:`, error);
        // Tenta usar URL original em caso de erro
        processedUrls.push(url);
      }
    }
    
    return processedUrls;
  } else {
    // Faz upload de todas as imagens para Shopee
    const uploadedUrls: string[] = [];
    
    for (const url of imageUrls) {
      try {
        const uploadedUrl = await uploadImageToShopee(shopId, accessToken, url);
        uploadedUrls.push(uploadedUrl);
      } catch (error) {
        console.error(`Erro ao fazer upload de imagem ${url}:`, error);
        throw error;
      }
    }
    
    return uploadedUrls;
  }
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
  imagemTingida?: string;
}>> {
  const vinculos: Array<{
    id: string;
    corId: string;
    corNome: string;
    corSku?: string;
    imagemTingida?: string;
  }> = [];
  
  for (const corId of corIds) {
    const snapshot = await db.collection(COR_TECIDO_COLLECTION)
      .where('tecidoId', '==', tecidoId)
      .where('corId', '==', corId)
      .limit(5)
      .get();
    
    // Filtra no código: aceita documentos sem deletedAt OU com deletedAt == null
    const activeDoc = snapshot.docs.find(doc => {
      const data = doc.data();
      return !data.deletedAt;
    });
    
    if (activeDoc) {
      const data = activeDoc.data();
      vinculos.push({
        id: activeDoc.id,
        corId: data.corId,
        corNome: data.corNome || '',
        corSku: data.corSku,
        imagemTingida: data.imagemTingida,
      });
    }
  }
  
  return vinculos;
}

/**
 * Busca dados dos tamanhos
 */
async function getTamanhosData(tamanhoIds: string[]): Promise<Array<{
  id: string;
  nome: string;
  sku?: string;
}>> {
  const tamanhos: Array<{ id: string; nome: string; sku?: string }> = [];
  
  for (const id of tamanhoIds) {
    const doc = await db.collection(TAMANHOS_COLLECTION).doc(id).get();
    if (doc.exists && !doc.data()?.deletedAt) {
      const data = doc.data();
      tamanhos.push({
        id: doc.id,
        nome: data?.nome || '',
        sku: data?.sku,
      });
    }
  }
  
  return tamanhos;
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
  vinculos: Array<{ corNome: string; imagemTingida?: string }>,
  tamanhos?: Array<{ nome: string }>
): TierVariation[] {
  const tiers: TierVariation[] = [];
  
  // Tier 1: Cor (sempre primeiro)
  tiers.push({
    tier_name: 'Cor',
    tier_index: 0,
    options: vinculos.map(v => ({
      option_name: v.corNome,
      imagem_url: v.imagemTingida,
    })),
  });
  
  // Tier 2: Tamanho (opcional)
  if (tamanhos && tamanhos.length > 0) {
    tiers.push({
      tier_name: 'Tamanho',
      tier_index: 1,
      options: tamanhos.map(t => ({
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
  vinculos: Array<{ id: string; corId: string; corNome: string; corSku?: string; imagemTingida?: string }>,
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
        imagem_url: vinculo.imagemTingida,
      });
    });
  } else {
    // Cores + Tamanhos - usa preço do tamanho correspondente
    vinculos.forEach((vinculo, corIndex) => {
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
          imagem_url: vinculo.imagemTingida,
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
  
  // Busca tamanhos (se selecionados)
  const tamanhos = data.tamanhos && data.tamanhos.length > 0
    ? await getTamanhosData(data.tamanhos)
    : undefined;
  
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
    precos_por_tamanho: data.precos_por_tamanho || null,
    estoque_padrao: data.estoque_padrao,
    categoria_id: data.categoria_id,
    atributos: data.atributos || [],
    brand_id: data.brand_id || null,
    peso: data.peso,
    dimensoes: data.dimensoes,
    descricao,
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
  if (existingData.created_by !== userId) {
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
  
  // Se mudou cores ou tamanhos, recalcula modelos
  if (data.cores || data.tamanhos) {
    const tecidoId = data.tecido_id || existingData.tecido_id;
    const tecido = await getTecidoData(tecidoId);
    
    if (tecido) {
      const corIds = (data.cores || existingData.modelos.map(m => m.cor_id!)).filter(Boolean) as string[];
      const vinculos = await getCorTecidoData(tecidoId, corIds);
      
      const tamanhoIds = data.tamanhos || existingData.tier_variations
        .find(t => t.tier_name === 'Tamanho')?.options
        .map((_, i) => existingData.modelos.find(m => m.tier_index[1] === i)?.tamanho_id)
        .filter(Boolean) as string[] || [];
      
      const tamanhos = tamanhoIds.length > 0 ? await getTamanhosData(tamanhoIds) : undefined;
      
      updateData.tier_variations = buildTierVariations(vinculos, tamanhos);
      updateData.modelos = buildModelList(
        tecido.sku,
        vinculos,
        tamanhos,
        data.cores || existingData.modelos.map(m => ({
          cor_id: m.cor_id!,
          estoque: m.estoque,
        })),
        data.preco_base ?? existingData.preco_base,
        data.precos_por_tamanho,
        data.estoque_padrao ?? existingData.estoque_padrao
      );
    }
  }
  
  // Atualiza campos simples
  if (data.preco_base !== undefined) updateData.preco_base = data.preco_base;
  if (data.precos_por_tamanho !== undefined) updateData.precos_por_tamanho = data.precos_por_tamanho;
  if (data.estoque_padrao !== undefined) updateData.estoque_padrao = data.estoque_padrao;
  if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id;
  if (data.peso !== undefined) updateData.peso = data.peso;
  if (data.dimensoes !== undefined) updateData.dimensoes = data.dimensoes;
  if (data.descricao_customizada !== undefined) updateData.descricao_customizada = data.descricao_customizada;
  if (data.usar_imagens_publicas !== undefined) updateData.usar_imagens_publicas = data.usar_imagens_publicas;
  if (data.imagens_principais !== undefined) updateData.imagens_principais = data.imagens_principais;
  
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
  if (data.created_by !== userId) {
    throw new Error('Sem permissão para excluir este produto');
  }
  
  // Não permite excluir produtos publicados
  if (data.status === 'created' && data.item_id) {
    throw new Error('Não é possível excluir um produto já publicado na Shopee');
  }
  
  await docRef.delete();
  return true;
}

/**
 * Publica um rascunho na Shopee
 */
export async function publishProduct(
  id: string,
  userId: string
): Promise<ShopeeProduct> {
  const docRef = db.collection(PRODUCTS_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    throw new Error('Produto não encontrado');
  }
  
  const product = { id: doc.id, ...doc.data() } as ShopeeProduct;
  
  // Verifica se o usuário é o dono
  if (product.created_by !== userId) {
    throw new Error('Sem permissão para publicar este produto');
  }
  
  // Verifica se já está publicado
  if (product.status === 'created' && product.item_id) {
    throw new Error('Produto já está publicado');
  }
  
  // Busca dados do tecido para formatação
  const tecido = await getTecidoData(product.tecido_id);
  
  // Formata nome e descrição para atender requisitos mínimos
  const formattedName = formatItemName(
    product.tecido_nome,
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
  
  // Atualiza status para publishing
  await docRef.update({
    status: 'publishing',
    updated_at: admin.firestore.Timestamp.now(),
  });
  
  try {
    const accessToken = await ensureValidToken(product.shop_id);
    
    // Busca canais de logística habilitados
    console.log('Buscando canais de logística...');
    const logisticInfo = await logisticsService.buildLogisticInfoForProduct(
      product.shop_id,
      product.peso,
      product.dimensoes
    );
    console.log(`${logisticInfo.length} canais de logística configurados`);
    
    // Processa imagens principais (comprime se necessário)
    console.log('Processando imagens principais...');
    const processedMainImages = await processImagesForPublish(
      product.shop_id,
      accessToken,
      product.imagens_principais,
      product.usar_imagens_publicas
    );
    
    // Processa imagens de variação (cores)
    console.log('Processando imagens de variação...');
    const processedTierVariations = await Promise.all(
      product.tier_variations.map(async (tier) => {
        const processedOptions = await Promise.all(
          tier.options.map(async (opt) => {
            if (opt.imagem_url) {
              try {
                const [processedUrl] = await processImagesForPublish(
                  product.shop_id,
                  accessToken,
                  [opt.imagem_url],
                  product.usar_imagens_publicas
                );
                return {
                  option: opt.option_name,
                  image: { image_url: processedUrl },
                };
              } catch (error) {
                console.error(`Erro ao processar imagem de variação ${opt.option_name}:`, error);
                return {
                  option: opt.option_name,
                  image: opt.imagem_url ? { image_url: opt.imagem_url } : undefined,
                };
              }
            }
            return {
              option: opt.option_name,
              image: undefined,
            };
          })
        );
        return {
          name: tier.tier_name,
          option_list: processedOptions,
        };
      })
    );
    
    // Monta payload para API Shopee
    const shopeePayload: Record<string, unknown> = {
      item_name: formattedName,
      description: formattedDescription,
      item_sku: product.tecido_sku,
      original_price: product.preco_base,
      category_id: product.categoria_id,
      weight: product.peso,
      dimension: {
        package_length: product.dimensoes.comprimento,
        package_width: product.dimensoes.largura,
        package_height: product.dimensoes.altura,
      },
      image: {
        image_url_list: processedMainImages,
      },
      tier_variation: processedTierVariations,
      model: product.modelos.map(modelo => {
        const ncm = product.ncm_padrao || modelo.tax_info?.ncm || '';
        const gtin = '00';
        const invoiceName = `Tecido ${product.tecido_nome} ${modelo.cor_nome || ''} ${modelo.tamanho_nome || ''}`.trim();
        
        const modelPayload: Record<string, unknown> = {
          model_sku: modelo.model_sku,
          tier_index: modelo.tier_index,
          original_price: modelo.preco || product.preco_base,
          stock_info_v2: {
            seller_stock: [{
              stock: modelo.estoque,
            }],
          },
        };
        
        // Inclui tax_info se NCM estiver preenchido
        if (ncm) {
          modelPayload.tax_info = {
            ncm,
            gtin,
            item_name_in_invoice: invoiceName.substring(0, 120),
          };
        }
        
        return modelPayload;
      }),
      logistic_info: logisticInfo,
      condition: product.condition || 'NEW',
      item_status: 'NORMAL',
      pre_order: {
        is_pre_order: product.is_pre_order || false,
        ...(product.is_pre_order && product.days_to_ship ? { days_to_ship: product.days_to_ship } : {}),
      },
      ...(product.is_pre_order ? {} : { days_to_ship: product.days_to_ship || 2 }),
    };
    
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
    
    // Adiciona marca se disponível
    if (product.brand_id) {
      shopeePayload.brand = {
        brand_id: product.brand_id,
      };
    }
    
    // Adiciona size chart se disponível
    if (product.size_chart_id) {
      shopeePayload.size_chart = product.size_chart_id;
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
    
    const itemId = response.response?.item_id;
    
    if (!itemId) {
      throw new Error('Shopee não retornou item_id');
    }
    
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
