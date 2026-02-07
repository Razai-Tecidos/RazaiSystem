import admin from '../config/firebase';
import { callShopeeApi, ensureValidToken, getConnectedShops } from './shopee.service';
import { ShopeeProduct, ShopeeDataSnapshot, SyncStatus } from '../types/shopee-product.types';

const db = admin.firestore();
const PRODUCTS_COLLECTION = 'shopee_products';
const BATCH_SIZE = 50; // Limite da API Shopee

interface ShopeeItemInfo {
  item_id: number;
  item_status: string;
  item_name: string;
  model_list?: Array<{
    model_id: number;
    original_price: number;
    stock_info_v2?: {
      summary_info?: {
        total_available_stock: number;
      };
    };
  }>;
}

/**
 * Divide array em chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Busca informações de produtos na Shopee em lote
 */
async function batchFetchFromShopee(
  shopId: number,
  itemIds: number[]
): Promise<ShopeeItemInfo[]> {
  const accessToken = await ensureValidToken(shopId);
  const batches = chunk(itemIds, BATCH_SIZE);
  const allItems: ShopeeItemInfo[] = [];
  
  for (const batch of batches) {
    try {
      const response = await callShopeeApi({
        path: '/api/v2/product/get_item_base_info',
        method: 'GET',
        shopId,
        accessToken,
        query: {
          item_id_list: batch.join(','),
        },
      }) as {
        error?: string;
        response?: {
          item_list: ShopeeItemInfo[];
        };
      };
      
      if (!response.error && response.response?.item_list) {
        allItems.push(...response.response.item_list);
      }
    } catch (error) {
      console.error(`Erro ao buscar batch de produtos:`, error);
    }
  }
  
  return allItems;
}

/**
 * Busca modelos de um produto na Shopee
 */
async function fetchModelList(
  shopId: number,
  itemId: number
): Promise<Array<{ model_id: number; original_price: number; stock: number }>> {
  const accessToken = await ensureValidToken(shopId);
  
  try {
    const response = await callShopeeApi({
      path: '/api/v2/product/get_model_list',
      method: 'GET',
      shopId,
      accessToken,
      query: {
        item_id: itemId,
      },
    }) as {
      error?: string;
      response?: {
        model: Array<{
          model_id: number;
          price_info: Array<{ original_price: number }>;
          stock_info_v2?: {
            summary_info?: {
              total_available_stock: number;
            };
          };
        }>;
      };
    };
    
    if (response.error || !response.response?.model) {
      return [];
    }
    
    return response.response.model.map(m => ({
      model_id: m.model_id,
      original_price: m.price_info?.[0]?.original_price || 0,
      stock: m.stock_info_v2?.summary_info?.total_available_stock || 0,
    }));
  } catch (error) {
    console.error(`Erro ao buscar modelos do item ${itemId}:`, error);
    return [];
  }
}

/**
 * Detecta diferenças entre dados locais e da Shopee
 */
function detectChanges(
  localProduct: ShopeeProduct,
  shopeeItem: ShopeeItemInfo,
  shopeeModels: Array<{ model_id: number; original_price: number; stock: number }>
): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  
  // Verifica status
  if (localProduct.shopee_data_snapshot?.item_status !== shopeeItem.item_status) {
    changes.push(`Status: ${localProduct.shopee_data_snapshot?.item_status || 'N/A'} -> ${shopeeItem.item_status}`);
  }
  
  // Verifica nome
  if (localProduct.shopee_data_snapshot?.item_name !== shopeeItem.item_name) {
    changes.push(`Nome: ${localProduct.shopee_data_snapshot?.item_name || 'N/A'} -> ${shopeeItem.item_name}`);
  }
  
  // Verifica modelos (preço e estoque)
  const localModels = localProduct.shopee_data_snapshot?.modelos || [];
  for (const shopeeModel of shopeeModels) {
    const localModel = localModels.find(m => m.model_id === shopeeModel.model_id);
    
    if (!localModel) {
      changes.push(`Novo modelo: ${shopeeModel.model_id}`);
      continue;
    }
    
    if (localModel.preco !== shopeeModel.original_price) {
      changes.push(`Preço modelo ${shopeeModel.model_id}: ${localModel.preco} -> ${shopeeModel.original_price}`);
    }
    
    if (localModel.estoque !== shopeeModel.stock) {
      changes.push(`Estoque modelo ${shopeeModel.model_id}: ${localModel.estoque} -> ${shopeeModel.stock}`);
    }
  }
  
  return {
    hasChanges: changes.length > 0,
    changes,
  };
}

/**
 * Atualiza produto local com dados da Shopee
 */
async function updateLocalProduct(
  productId: string,
  shopeeItem: ShopeeItemInfo,
  shopeeModels: Array<{ model_id: number; original_price: number; stock: number }>
): Promise<void> {
  const snapshot: ShopeeDataSnapshot = {
    item_status: shopeeItem.item_status,
    item_name: shopeeItem.item_name,
    modelos: shopeeModels.map(m => ({
      model_id: m.model_id,
      preco: m.original_price,
      estoque: m.stock,
    })),
  };
  
  await db.collection(PRODUCTS_COLLECTION).doc(productId).update({
    shopee_data_snapshot: snapshot,
    last_synced_at: admin.firestore.Timestamp.now(),
    sync_status: 'synced' as SyncStatus,
    updated_at: admin.firestore.Timestamp.now(),
  });
}

/**
 * Sincroniza um produto específico
 */
export async function syncProductFromShopee(productId: string): Promise<{
  success: boolean;
  hasChanges: boolean;
  changes: string[];
  error?: string;
}> {
  try {
    // Busca produto local
    const productDoc = await db.collection(PRODUCTS_COLLECTION).doc(productId).get();
    
    if (!productDoc.exists) {
      return { success: false, hasChanges: false, changes: [], error: 'Produto não encontrado' };
    }
    
    const product = { id: productDoc.id, ...productDoc.data() } as ShopeeProduct;
    
    // Verifica se está publicado
    if (!product.item_id) {
      return { success: false, hasChanges: false, changes: [], error: 'Produto não publicado' };
    }
    
    // Busca dados da Shopee
    const [shopeeItem] = await batchFetchFromShopee(product.shop_id, [product.item_id]);
    
    if (!shopeeItem) {
      await db.collection(PRODUCTS_COLLECTION).doc(productId).update({
        sync_status: 'error' as SyncStatus,
        error_message: 'Produto não encontrado na Shopee',
        updated_at: admin.firestore.Timestamp.now(),
      });
      return { success: false, hasChanges: false, changes: [], error: 'Produto não encontrado na Shopee' };
    }
    
    // Busca modelos
    const shopeeModels = await fetchModelList(product.shop_id, product.item_id);
    
    // Detecta mudanças
    const { hasChanges, changes } = detectChanges(product, shopeeItem, shopeeModels);
    
    // Atualiza produto local
    await updateLocalProduct(productId, shopeeItem, shopeeModels);
    
    return { success: true, hasChanges, changes };
  } catch (error: any) {
    console.error(`Erro ao sincronizar produto ${productId}:`, error);
    
    await db.collection(PRODUCTS_COLLECTION).doc(productId).update({
      sync_status: 'error' as SyncStatus,
      error_message: error.message,
      updated_at: admin.firestore.Timestamp.now(),
    });
    
    return { success: false, hasChanges: false, changes: [], error: error.message };
  }
}

/**
 * Sincroniza todos os produtos de uma loja
 */
export async function syncAllProducts(shopId: number): Promise<{
  total: number;
  synced: number;
  withChanges: number;
  errors: number;
}> {
  const stats = { total: 0, synced: 0, withChanges: 0, errors: 0 };
  
  try {
    // Busca todos os produtos publicados da loja
    const snapshot = await db.collection(PRODUCTS_COLLECTION)
      .where('shop_id', '==', shopId)
      .where('status', '==', 'created')
      .get();
    
    stats.total = snapshot.size;
    
    if (stats.total === 0) {
      return stats;
    }
    
    // Agrupa item_ids
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      item_id: doc.data().item_id as number,
    }));
    
    const itemIds = products.map(p => p.item_id).filter(Boolean);
    
    // Busca dados da Shopee em lote
    const shopeeItems = await batchFetchFromShopee(shopId, itemIds);
    
    // Processa cada produto
    for (const product of products) {
      const shopeeItem = shopeeItems.find(i => i.item_id === product.item_id);
      
      if (!shopeeItem) {
        stats.errors++;
        await db.collection(PRODUCTS_COLLECTION).doc(product.id).update({
          sync_status: 'error' as SyncStatus,
          error_message: 'Produto não encontrado na Shopee',
          updated_at: admin.firestore.Timestamp.now(),
        });
        continue;
      }
      
      try {
        // Busca modelos
        const shopeeModels = await fetchModelList(shopId, product.item_id);
        
        // Busca produto local para comparação
        const productDoc = await db.collection(PRODUCTS_COLLECTION).doc(product.id).get();
        const localProduct = { id: productDoc.id, ...productDoc.data() } as ShopeeProduct;
        
        // Detecta mudanças
        const { hasChanges } = detectChanges(localProduct, shopeeItem, shopeeModels);
        
        // Atualiza produto local
        await updateLocalProduct(product.id, shopeeItem, shopeeModels);
        
        stats.synced++;
        if (hasChanges) {
          stats.withChanges++;
        }
      } catch (error) {
        stats.errors++;
        console.error(`Erro ao sincronizar produto ${product.id}:`, error);
      }
    }
    
    return stats;
  } catch (error: any) {
    console.error('Erro ao sincronizar produtos:', error);
    throw error;
  }
}

/**
 * Sincroniza todas as lojas conectadas
 */
export async function syncAllShops(): Promise<{
  shops: number;
  total: number;
  synced: number;
  withChanges: number;
  errors: number;
}> {
  const totalStats = { shops: 0, total: 0, synced: 0, withChanges: 0, errors: 0 };
  
  try {
    const shops = await getConnectedShops();
    totalStats.shops = shops.length;
    
    for (const shop of shops) {
      const stats = await syncAllProducts(shop.shopId);
      totalStats.total += stats.total;
      totalStats.synced += stats.synced;
      totalStats.withChanges += stats.withChanges;
      totalStats.errors += stats.errors;
    }
    
    return totalStats;
  } catch (error: any) {
    console.error('Erro ao sincronizar lojas:', error);
    throw error;
  }
}

/**
 * Marca produto como fora de sincronia
 */
export async function markProductOutOfSync(productId: string): Promise<void> {
  await db.collection(PRODUCTS_COLLECTION).doc(productId).update({
    sync_status: 'out_of_sync' as SyncStatus,
    updated_at: admin.firestore.Timestamp.now(),
  });
}

/**
 * Busca produtos que precisam de sincronização
 */
export async function getProductsNeedingSync(shopId?: number): Promise<ShopeeProduct[]> {
  let query = db.collection(PRODUCTS_COLLECTION)
    .where('status', '==', 'created')
    .where('sync_status', 'in', ['out_of_sync', 'error']);
  
  if (shopId) {
    query = query.where('shop_id', '==', shopId);
  }
  
  const snapshot = await query.limit(100).get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ShopeeProduct));
}
