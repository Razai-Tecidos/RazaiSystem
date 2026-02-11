import admin from '../config/firebase';
import { 
  ShopeeCategory, 
  ShopeeCategoriesCache, 
  ShopeeCategoryAttribute,
  ShopeeBrand 
} from '../types/shopee-product.types';
import { callShopeeApi, ensureValidToken } from './shopee.service';

const db = admin.firestore();
const CATEGORIES_CACHE_COLLECTION = 'shopee_categories_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const DEFAULT_SHOPEE_LANGUAGE = 'pt-BR';

function normalizeLanguage(language?: string): string {
  const sanitized = (language || DEFAULT_SHOPEE_LANGUAGE)
    .replace('_', '-')
    .trim();
  return sanitized || DEFAULT_SHOPEE_LANGUAGE;
}

function buildCacheDocId(shopId: number, language?: string): string {
  const normalizedLanguage = normalizeLanguage(language)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  return `${shopId}_${normalizedLanguage}`;
}

/**
 * Busca categorias do cache se válido
 */
export async function getCachedCategories(shopId: number, language: string = DEFAULT_SHOPEE_LANGUAGE): Promise<ShopeeCategory[] | null> {
  const cacheDoc = await db.collection(CATEGORIES_CACHE_COLLECTION).doc(buildCacheDocId(shopId, language)).get();
  
  if (!cacheDoc.exists) {
    return null;
  }
  
  const cache = cacheDoc.data() as ShopeeCategoriesCache;
  const cacheAge = Date.now() - cache.updated_at.toMillis();
  
  // Se cache tem menos de 24h, retorna
  if (cacheAge < CACHE_TTL_MS) {
    return cache.categories;
  }
  
  return null;
}

/**
 * Salva categorias no cache
 */
async function saveCategoriesCache(
  shopId: number,
  language: string,
  categories: ShopeeCategory[]
): Promise<void> {
  await db.collection(CATEGORIES_CACHE_COLLECTION).doc(buildCacheDocId(shopId, language)).set({
    categories,
    updated_at: admin.firestore.Timestamp.now(),
    shop_id: shopId,
    language: normalizeLanguage(language),
  });
}

/**
 * Busca categorias da API Shopee
 */
async function fetchCategoriesFromShopee(shopId: number, language: string): Promise<ShopeeCategory[]> {
  const accessToken = await ensureValidToken(shopId);
  
  const response = await callShopeeApi({
    path: '/api/v2/product/get_category',
    method: 'GET',
    shopId,
    accessToken,
    query: {
      language: normalizeLanguage(language),
    },
  }) as {
    error?: string;
    message?: string;
    response?: {
      category_list: Array<{
        category_id: number;
        parent_category_id: number;
        original_category_name: string;
        display_category_name: string;
        has_children: boolean;
      }>;
    };
  };
  
  if (response.error) {
    throw new Error(`Erro ao buscar categorias: ${response.error} - ${response.message}`);
  }
  
  const categoryList = response.response?.category_list || [];
  const now = admin.firestore.Timestamp.now();
  
  // Mapeia para o formato interno e calcula nível
  const categories: ShopeeCategory[] = categoryList.map(cat => {
    // Calcula o nível baseado na hierarquia
    let level = 1;
    if (cat.parent_category_id > 0) {
      const parent = categoryList.find(c => c.category_id === cat.parent_category_id);
      if (parent) {
        const grandparent = categoryList.find(c => c.category_id === parent.parent_category_id);
        level = grandparent ? 3 : 2;
      }
    }
    
    return {
      id: cat.category_id,
      parent_category_id: cat.parent_category_id > 0 ? cat.parent_category_id : null,
      original_category_name: cat.original_category_name,
      display_name: cat.display_category_name || cat.original_category_name,
      has_children: cat.has_children,
      level,
      updated_at: now,
    };
  });
  
  return categories;
}

/**
 * Busca categorias (do cache ou da API)
 */
export async function getCategories(
  shopId: number,
  forceRefresh = false,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<ShopeeCategory[]> {
  // Tenta buscar do cache primeiro
  if (!forceRefresh) {
    const cached = await getCachedCategories(shopId, language);
    if (cached) {
      return cached;
    }
  }
  
  // Busca da API e atualiza cache
  const categories = await fetchCategoriesFromShopee(shopId, language);
  await saveCategoriesCache(shopId, language, categories);
  
  return categories;
}

/**
 * Busca categoria por ID
 */
export async function getCategoryById(
  shopId: number,
  categoryId: number,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<ShopeeCategory | null> {
  const categories = await getCategories(shopId, false, language);
  return categories.find(c => c.id === categoryId) || null;
}

/**
 * Busca subcategorias de uma categoria
 */
export async function getSubcategories(
  shopId: number,
  parentCategoryId?: number,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<ShopeeCategory[]> {
  const categories = await getCategories(shopId, false, language);
  
  if (!parentCategoryId) {
    // Retorna categorias raiz (sem pai)
    return categories.filter(c => !c.parent_category_id);
  }
  
  return categories.filter(c => c.parent_category_id === parentCategoryId);
}

/**
 * Busca o caminho completo de uma categoria (breadcrumb)
 */
export async function getCategoryPath(
  shopId: number,
  categoryId: number,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<ShopeeCategory[]> {
  const categories = await getCategories(shopId, false, language);
  const path: ShopeeCategory[] = [];
  
  let currentId: number | null | undefined = categoryId;
  
  while (currentId) {
    const category = categories.find(c => c.id === currentId);
    if (category) {
      path.unshift(category);
      currentId = category.parent_category_id;
    } else {
      break;
    }
  }
  
  return path;
}

/**
 * Busca atributos de uma categoria
 */
export async function getCategoryAttributes(shopId: number, categoryId: number): Promise<ShopeeCategoryAttribute[]> {
  const accessToken = await ensureValidToken(shopId);

  const queryAttempts: Array<Record<string, string | number | boolean>> = [
    // Contrato atual da OpenAPI v2
    { category_id_list: String(categoryId), language: 'pt-BR' },
    // Compatibilidade com variantes observadas em alguns ambientes
    { category_ids: String(categoryId), language: 'pt-BR' },
    { category_id: categoryId, language: 'pt-BR' },
  ];

  let lastErrorMessage: string | null = null;

  for (let attempt = 0; attempt < queryAttempts.length; attempt += 1) {
    try {
      const response = await callShopeeApi({
        path: '/api/v2/product/get_attribute_tree',
        method: 'GET',
        shopId,
        accessToken,
        query: queryAttempts[attempt],
      }) as {
        error?: string;
        message?: string;
        response?: {
          attribute_list: ShopeeCategoryAttribute[];
        };
      };

      if (!response.error) {
        return response.response?.attribute_list || [];
      }

      lastErrorMessage = `${response.error} - ${response.message || 'sem detalhes'}`;
      console.warn(
        `[getCategoryAttributes] tentativa ${attempt + 1}/${queryAttempts.length} falhou: ${lastErrorMessage}`
      );
    } catch (error: any) {
      lastErrorMessage = error?.message || 'falha ao chamar get_attribute_tree';
      console.warn(
        `[getCategoryAttributes] tentativa ${attempt + 1}/${queryAttempts.length} falhou com exceção: ${lastErrorMessage}`
      );
    }
  }

  throw new Error(`Erro ao buscar atributos: ${lastErrorMessage || 'falha de contrato no endpoint get_attribute_tree'}`);
}

/**
 * Busca apenas atributos obrigatórios de uma categoria
 */
export async function getMandatoryAttributes(shopId: number, categoryId: number): Promise<ShopeeCategoryAttribute[]> {
  const attributes = await getCategoryAttributes(shopId, categoryId);
  return attributes.filter(attr => attr.is_mandatory);
}

/**
 * Busca marcas disponíveis para uma categoria
 */
export async function getCategoryBrands(
  shopId: number, 
  categoryId: number,
  status: 1 | 2 = 1, // 1 = normal, 2 = pending
  pageSize = 100,
  offset = 0,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<{ brands: ShopeeBrand[]; hasMore: boolean; nextOffset: number }> {
  const accessToken = await ensureValidToken(shopId);
  
  const response = await callShopeeApi({
    path: '/api/v2/product/get_brand_list',
    method: 'GET',
    shopId,
    accessToken,
    query: {
      category_id: categoryId,
      status,
      page_size: pageSize,
      offset,
      language: normalizeLanguage(language),
    },
  }) as {
    error?: string;
    message?: string;
    response?: {
      brand_list: ShopeeBrand[];
      has_next_page: boolean;
      next_offset: number;
      is_mandatory: boolean;
      input_type: string;
    };
  };
  
  if (response.error) {
    throw new Error(`Erro ao buscar marcas: ${response.error} - ${response.message}`);
  }
  
  return {
    brands: response.response?.brand_list || [],
    hasMore: response.response?.has_next_page || false,
    nextOffset: response.response?.next_offset || 0,
  };
}

export async function getAllCategoryBrands(
  shopId: number,
  categoryId: number,
  status: 1 | 2 = 1,
  pageSize = 100,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<{ brands: ShopeeBrand[]; hasMore: boolean; pagesFetched: number }> {
  const dedup = new Map<number, ShopeeBrand>();
  let hasMore = true;
  let offset = 0;
  let pagesFetched = 0;
  const maxPages = 50;

  while (hasMore && pagesFetched < maxPages) {
    const page = await getCategoryBrands(shopId, categoryId, status, pageSize, offset, language);
    pagesFetched += 1;

    for (const brand of page.brands) {
      dedup.set(brand.brand_id, brand);
    }

    if (!page.hasMore) {
      hasMore = false;
      break;
    }

    if (page.nextOffset <= offset) {
      // Guard-rail contra loop de paginação inconsistente.
      hasMore = true;
      break;
    }
    offset = page.nextOffset;
  }

  return {
    brands: Array.from(dedup.values()),
    hasMore,
    pagesFetched,
  };
}

/**
 * Verifica se marca é obrigatória para uma categoria
 */
export async function isBrandMandatory(shopId: number, categoryId: number): Promise<boolean> {
  const accessToken = await ensureValidToken(shopId);
  
  const response = await callShopeeApi({
    path: '/api/v2/product/get_brand_list',
    method: 'GET',
    shopId,
    accessToken,
    query: {
      category_id: categoryId,
      status: 1,
      page_size: 1,
      offset: 0,
    },
  }) as {
    error?: string;
    response?: {
      is_mandatory: boolean;
    };
  };
  
  return response.response?.is_mandatory || false;
}

/**
 * Força atualização do cache de categorias
 */
export async function forceRefreshCategories(
  shopId: number,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<ShopeeCategory[]> {
  return getCategories(shopId, true, language);
}

/**
 * Verifica se o cache precisa ser atualizado
 */
export async function isCacheExpired(
  shopId: number,
  language: string = DEFAULT_SHOPEE_LANGUAGE
): Promise<boolean> {
  const cacheDoc = await db.collection(CATEGORIES_CACHE_COLLECTION).doc(buildCacheDocId(shopId, language)).get();
  
  if (!cacheDoc.exists) {
    return true;
  }
  
  const cache = cacheDoc.data() as ShopeeCategoriesCache;
  const cacheAge = Date.now() - cache.updated_at.toMillis();
  
  return cacheAge >= CACHE_TTL_MS;
}
