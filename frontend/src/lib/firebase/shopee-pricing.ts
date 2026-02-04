import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import {
  SkuCost,
  CreateSkuCostData,
  UpdateSkuCostData,
  SkuSalesData,
  PriceChangeLog,
  PricingRule,
} from '@/types/shopee-pricing.types';

// Collections
const SKU_COSTS_COLLECTION = 'shopee_sku_costs';
const SKU_SALES_COLLECTION = 'shopee_sku_sales';
const PRICE_LOGS_COLLECTION = 'shopee_price_logs';
const PRICING_RULES_COLLECTION = 'shopee_pricing_rules';

// ============================================================
// SKU COSTS - Cadastro de custos por SKU
// ============================================================

/**
 * Gera ID único para documento de custo
 */
function generateSkuCostId(shopId: number, itemSku: string): string {
  return `${shopId}_${itemSku}`;
}

/**
 * Busca todos os custos de SKUs de uma loja
 */
export async function getSkuCosts(shopId: number): Promise<SkuCost[]> {
  const q = query(
    collection(db, SKU_COSTS_COLLECTION),
    where('shop_id', '==', shopId),
    orderBy('item_sku', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SkuCost[];
}

/**
 * Busca custo de um SKU específico
 */
export async function getSkuCost(shopId: number, itemSku: string): Promise<SkuCost | null> {
  const docId = generateSkuCostId(shopId, itemSku);
  const docRef = doc(db, SKU_COSTS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as SkuCost;
}

/**
 * Cria ou atualiza custo de um SKU
 */
export async function upsertSkuCost(data: CreateSkuCostData): Promise<SkuCost> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const docId = generateSkuCostId(data.shop_id, data.item_sku);
  const docRef = doc(db, SKU_COSTS_COLLECTION, docId);
  const existing = await getDoc(docRef);

  const now = serverTimestamp();

  if (existing.exists()) {
    // Atualizar existente
    const updateData = {
      custo_unitario: data.custo_unitario,
      margem_minima: data.margem_minima,
      margem_target: data.margem_target,
      usa_frete_gratis: data.usa_frete_gratis ?? true,
      preco_minimo: data.preco_minimo ?? null,
      preco_maximo: data.preco_maximo ?? null,
      automacao_ativa: data.automacao_ativa ?? false,
      updatedAt: now,
      updatedBy: user.uid,
    };

    await updateDoc(docRef, updateData);
  } else {
    // Criar novo
    const newData = {
      item_sku: data.item_sku,
      shop_id: data.shop_id,
      custo_unitario: data.custo_unitario,
      margem_minima: data.margem_minima,
      margem_target: data.margem_target,
      usa_frete_gratis: data.usa_frete_gratis ?? true,
      preco_minimo: data.preco_minimo ?? null,
      preco_maximo: data.preco_maximo ?? null,
      automacao_ativa: data.automacao_ativa ?? false,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
      updatedBy: user.uid,
    };

    await setDoc(docRef, newData);
  }

  // Retornar documento atualizado
  const updated = await getDoc(docRef);
  return {
    id: updated.id,
    ...updated.data(),
  } as SkuCost;
}

/**
 * Atualiza custo de um SKU
 */
export async function updateSkuCost(
  shopId: number,
  itemSku: string,
  data: UpdateSkuCostData
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const docId = generateSkuCostId(shopId, itemSku);
  const docRef = doc(db, SKU_COSTS_COLLECTION, docId);

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };

  if (data.custo_unitario !== undefined) updateData.custo_unitario = data.custo_unitario;
  if (data.margem_minima !== undefined) updateData.margem_minima = data.margem_minima;
  if (data.margem_target !== undefined) updateData.margem_target = data.margem_target;
  if (data.usa_frete_gratis !== undefined) updateData.usa_frete_gratis = data.usa_frete_gratis;
  if (data.preco_minimo !== undefined) updateData.preco_minimo = data.preco_minimo;
  if (data.preco_maximo !== undefined) updateData.preco_maximo = data.preco_maximo;
  if (data.automacao_ativa !== undefined) updateData.automacao_ativa = data.automacao_ativa;

  await updateDoc(docRef, updateData);
}

/**
 * Remove custo de um SKU
 */
export async function deleteSkuCost(shopId: number, itemSku: string): Promise<void> {
  const docId = generateSkuCostId(shopId, itemSku);
  const docRef = doc(db, SKU_COSTS_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Importa custos em lote (de planilha)
 */
export async function importSkuCosts(
  shopId: number,
  costs: Array<{
    item_sku: string;
    custo_unitario: number;
    margem_minima?: number;
    margem_target?: number;
  }>
): Promise<{ success: number; errors: Array<{ sku: string; error: string }> }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const results = {
    success: 0,
    errors: [] as Array<{ sku: string; error: string }>,
  };

  for (const cost of costs) {
    try {
      await upsertSkuCost({
        shop_id: shopId,
        item_sku: cost.item_sku,
        custo_unitario: cost.custo_unitario,
        margem_minima: cost.margem_minima ?? 15, // Default 15%
        margem_target: cost.margem_target ?? 30, // Default 30%
      });
      results.success++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      results.errors.push({
        sku: cost.item_sku,
        error: errorMessage,
      });
    }
  }

  return results;
}

// ============================================================
// SKU SALES DATA - Dados de vendas
// ============================================================

/**
 * Salva dados de vendas de um SKU
 */
export async function saveSkuSalesData(data: Omit<SkuSalesData, 'id' | 'coletadoEm'>): Promise<void> {
  const docId = `${data.shop_id}_${data.item_sku}_${Date.now()}`;
  const docRef = doc(db, SKU_SALES_COLLECTION, docId);

  await setDoc(docRef, {
    ...data,
    coletadoEm: serverTimestamp(),
  });
}

/**
 * Busca dados de vendas mais recentes de um SKU
 */
export async function getLatestSkuSalesData(
  shopId: number,
  itemSku: string
): Promise<SkuSalesData | null> {
  const q = query(
    collection(db, SKU_SALES_COLLECTION),
    where('shop_id', '==', shopId),
    where('item_sku', '==', itemSku),
    orderBy('coletadoEm', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as SkuSalesData;
}

/**
 * Busca histórico de vendas de um SKU
 */
export async function getSkuSalesHistory(
  shopId: number,
  itemSku: string,
  limitCount = 30
): Promise<SkuSalesData[]> {
  const q = query(
    collection(db, SKU_SALES_COLLECTION),
    where('shop_id', '==', shopId),
    where('item_sku', '==', itemSku),
    orderBy('coletadoEm', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SkuSalesData[];
}

// ============================================================
// PRICE CHANGE LOGS - Histórico de alterações
// ============================================================

/**
 * Registra alteração de preço
 */
export async function logPriceChange(
  data: Omit<PriceChangeLog, 'id' | 'executadoEm'>
): Promise<void> {
  const docId = `${data.shop_id}_${data.item_sku}_${Date.now()}`;
  const docRef = doc(db, PRICE_LOGS_COLLECTION, docId);

  await setDoc(docRef, {
    ...data,
    executadoEm: serverTimestamp(),
  });
}

/**
 * Busca histórico de alterações de preço de um SKU
 */
export async function getPriceChangeLogs(
  shopId: number,
  itemSku?: string,
  limitCount = 50
): Promise<PriceChangeLog[]> {
  let q;

  if (itemSku) {
    q = query(
      collection(db, PRICE_LOGS_COLLECTION),
      where('shop_id', '==', shopId),
      where('item_sku', '==', itemSku),
      orderBy('executadoEm', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, PRICE_LOGS_COLLECTION),
      where('shop_id', '==', shopId),
      orderBy('executadoEm', 'desc'),
      limit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PriceChangeLog[];
}

// ============================================================
// PRICING RULES - Regras de automação
// ============================================================

/**
 * Busca regras de precificação de uma loja
 */
export async function getPricingRules(shopId: number): Promise<PricingRule[]> {
  const q = query(
    collection(db, PRICING_RULES_COLLECTION),
    where('shop_id', '==', shopId),
    orderBy('prioridade', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PricingRule[];
}

/**
 * Cria regra de precificação
 */
export async function createPricingRule(
  data: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PricingRule> {
  const docRef = doc(collection(db, PRICING_RULES_COLLECTION));

  const ruleData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, ruleData);

  const created = await getDoc(docRef);
  return {
    id: created.id,
    ...created.data(),
  } as PricingRule;
}

/**
 * Atualiza regra de precificação
 */
export async function updatePricingRule(
  ruleId: string,
  data: Partial<Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const docRef = doc(db, PRICING_RULES_COLLECTION, ruleId);

  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove regra de precificação
 */
export async function deletePricingRule(ruleId: string): Promise<void> {
  const docRef = doc(db, PRICING_RULES_COLLECTION, ruleId);
  await deleteDoc(docRef);
}

// ============================================================
// HELPERS - Funções auxiliares
// ============================================================

/**
 * Calcula margem real com base em receita líquida
 */
export function calcularMargemReal(
  receitaLiquida: number,
  quantidade: number,
  custoUnitario: number,
  precoVenda: number
): number {
  if (quantidade === 0 || precoVenda === 0) return 0;
  
  const receitaPorUnidade = receitaLiquida / quantidade;
  const lucro = receitaPorUnidade - custoUnitario;
  const margem = (lucro / precoVenda) * 100;
  
  return Math.round(margem * 100) / 100; // 2 casas decimais
}

/**
 * Determina status da margem
 */
export function getMarginStatus(
  margemReal: number,
  margemMinima: number,
  margemTarget: number
): 'otimo' | 'ok' | 'atencao' | 'critico' {
  if (margemReal >= margemTarget) return 'otimo';
  if (margemReal >= margemMinima) return 'ok';
  if (margemReal > 0) return 'atencao';
  return 'critico';
}

// ============================================================
// TAXAS SHOPEE BRASIL (atualizado 02/2026)
// ============================================================
// Comissão: 14% (sem Frete Grátis) ou 20% (14% + 6% com Frete Grátis)
// Limite comissão: R$100 por item
// Taxa por item: R$4 fixo

export const SHOPEE_TAXAS = {
  COMISSAO_SEM_FRETE_GRATIS: 0.14, // 14%
  COMISSAO_COM_FRETE_GRATIS: 0.20, // 14% + 6%
  TAXA_POR_ITEM: 4, // R$4 fixo
  LIMITE_COMISSAO: 100, // R$100 máximo de comissão
};

/**
 * Calcula taxas da Shopee para um preço
 */
export function calcularTaxasShopee(
  precoVenda: number,
  comFreteGratis = true
): { comissao: number; taxaItem: number; total: number } {
  const taxaComissao = comFreteGratis 
    ? SHOPEE_TAXAS.COMISSAO_COM_FRETE_GRATIS 
    : SHOPEE_TAXAS.COMISSAO_SEM_FRETE_GRATIS;
  
  // Comissão é percentual, mas limitada a R$100
  const comissao = Math.min(precoVenda * taxaComissao, SHOPEE_TAXAS.LIMITE_COMISSAO);
  const taxaItem = SHOPEE_TAXAS.TAXA_POR_ITEM;
  
  return {
    comissao,
    taxaItem,
    total: comissao + taxaItem,
  };
}

/**
 * Calcula receita líquida estimada (preço - taxas Shopee)
 */
export function calcularReceitaLiquida(
  precoVenda: number,
  comFreteGratis = true
): number {
  const taxas = calcularTaxasShopee(precoVenda, comFreteGratis);
  return precoVenda - taxas.total;
}

/**
 * Calcula margem estimada com base no preço e custo
 */
export function calcularMargemEstimada(
  precoVenda: number,
  custoUnitario: number,
  comFreteGratis = true
): number {
  if (precoVenda === 0) return 0;
  
  const receitaLiquida = calcularReceitaLiquida(precoVenda, comFreteGratis);
  const lucro = receitaLiquida - custoUnitario;
  const margem = (lucro / precoVenda) * 100;
  
  return Math.round(margem * 100) / 100;
}

/**
 * Calcula preço sugerido com base na margem desejada
 * Considera taxas reais da Shopee Brasil
 */
export function calcularPrecoSugerido(
  custoUnitario: number,
  margemDesejada: number,
  comFreteGratis = true
): number {
  const taxaComissao = comFreteGratis 
    ? SHOPEE_TAXAS.COMISSAO_COM_FRETE_GRATIS 
    : SHOPEE_TAXAS.COMISSAO_SEM_FRETE_GRATIS;
  
  // Fórmula: Preço = (Custo + TaxaItem) / (1 - taxaComissao - margemDesejada/100)
  const divisor = 1 - taxaComissao - (margemDesejada / 100);
  if (divisor <= 0) return 0;
  
  const precoBase = (custoUnitario + SHOPEE_TAXAS.TAXA_POR_ITEM) / divisor;
  
  // Verificar se comissão ultrapassa o limite
  const comissaoCalculada = precoBase * taxaComissao;
  if (comissaoCalculada > SHOPEE_TAXAS.LIMITE_COMISSAO) {
    // Se ultrapassar, recalcular com comissão fixa de R$100
    // Preço = Custo + TaxaItem + LimiteComissao + (Preço * margem)
    // Preço * (1 - margem/100) = Custo + TaxaItem + LimiteComissao
    const divisorLimite = 1 - (margemDesejada / 100);
    if (divisorLimite <= 0) return 0;
    return Math.ceil(((custoUnitario + SHOPEE_TAXAS.TAXA_POR_ITEM + SHOPEE_TAXAS.LIMITE_COMISSAO) / divisorLimite) * 100) / 100;
  }
  
  return Math.ceil(precoBase * 100) / 100;
}
