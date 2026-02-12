import admin from '../config/firebase';
import {
  ShopeeUserPreferences,
  UpdateShopeePreferencesData,
  SYSTEM_DEFAULTS,
} from '../types/shopee-preferences.types';

const db = admin.firestore();
const PREFERENCES_COLLECTION = 'shopee_user_preferences';

/**
 * Busca preferencias do usuario
 */
export async function getUserPreferences(userId: string): Promise<ShopeeUserPreferences | null> {
  const doc = await db.collection(PREFERENCES_COLLECTION).doc(userId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as ShopeeUserPreferences;
}

/**
 * Salva/atualiza preferencias do usuario
 */
export async function saveUserPreferences(
  userId: string,
  data: UpdateShopeePreferencesData
): Promise<ShopeeUserPreferences> {
  const docRef = db.collection(PREFERENCES_COLLECTION).doc(userId);
  const now = admin.firestore.Timestamp.now();

  const updateData: Record<string, unknown> = {
    updated_at: now,
  };

  if (data.preco_base_padrao !== undefined) updateData.preco_base_padrao = data.preco_base_padrao;
  if (data.comissao_percentual_padrao !== undefined) updateData.comissao_percentual_padrao = data.comissao_percentual_padrao;
  if (data.taxa_fixa_item_padrao !== undefined) updateData.taxa_fixa_item_padrao = data.taxa_fixa_item_padrao;
  if (data.margem_liquida_percentual_padrao !== undefined) updateData.margem_liquida_percentual_padrao = data.margem_liquida_percentual_padrao;
  if (data.modo_margem_lucro_padrao !== undefined) updateData.modo_margem_lucro_padrao = data.modo_margem_lucro_padrao;
  if (data.margem_lucro_fixa_padrao !== undefined) updateData.margem_lucro_fixa_padrao = data.margem_lucro_fixa_padrao;
  if (data.valor_minimo_baixo_valor_padrao !== undefined) updateData.valor_minimo_baixo_valor_padrao = data.valor_minimo_baixo_valor_padrao;
  if (data.adicional_baixo_valor_padrao !== undefined) updateData.adicional_baixo_valor_padrao = data.adicional_baixo_valor_padrao;
  if (data.teto_comissao_padrao !== undefined) updateData.teto_comissao_padrao = data.teto_comissao_padrao;
  if (data.aplicar_teto_padrao !== undefined) updateData.aplicar_teto_padrao = data.aplicar_teto_padrao;
  if (data.aplicar_baixo_valor_padrao !== undefined) updateData.aplicar_baixo_valor_padrao = data.aplicar_baixo_valor_padrao;
  if (data.estoque_padrao_padrao !== undefined) updateData.estoque_padrao_padrao = data.estoque_padrao_padrao;
  if (data.categoria_id_padrao !== undefined) updateData.categoria_id_padrao = data.categoria_id_padrao;
  if (data.peso_padrao !== undefined) updateData.peso_padrao = data.peso_padrao;
  if (data.dimensoes_padrao !== undefined) updateData.dimensoes_padrao = data.dimensoes_padrao;
  if (data.usar_imagens_publicas_padrao !== undefined) updateData.usar_imagens_publicas_padrao = data.usar_imagens_publicas_padrao;
  if (data.descricao_template !== undefined) updateData.descricao_template = data.descricao_template;
  if (data.ncm_padrao !== undefined) updateData.ncm_padrao = data.ncm_padrao;
  if (data.cest_padrao !== undefined) updateData.cest_padrao = data.cest_padrao;
  if (data.categoria_nome_padrao !== undefined) updateData.categoria_nome_padrao = data.categoria_nome_padrao;

  await docRef.set(updateData, { merge: true });

  const updatedDoc = await docRef.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  } as ShopeeUserPreferences;
}

/**
 * Atualiza os ultimos valores usados
 */
export async function updateLastUsedValues(
  userId: string,
  values: {
    preco_base?: number;
    estoque_padrao?: number;
    categoria_id?: number;
    peso?: number;
    dimensoes?: {
      comprimento: number;
      largura: number;
      altura: number;
    };
  }
): Promise<void> {
  const docRef = db.collection(PREFERENCES_COLLECTION).doc(userId);

  await docRef.set(
    {
      ultimos_valores: values,
      updated_at: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
}

/**
 * Reseta preferencias para padroes do sistema
 */
export async function resetUserPreferences(userId: string): Promise<void> {
  await db.collection(PREFERENCES_COLLECTION).doc(userId).delete();
}

/**
 * Retorna valores padrao combinados (preferencias + sistema)
 */
export async function getDefaultValues(
  userId: string,
  tecidoLargura?: number
): Promise<{
  preco_base?: number;
  comissao_percentual_padrao: number;
  taxa_fixa_item_padrao: number;
  margem_liquida_percentual_padrao: number;
  modo_margem_lucro_padrao: 'percentual' | 'valor_fixo';
  margem_lucro_fixa_padrao: number;
  valor_minimo_baixo_valor_padrao: number;
  adicional_baixo_valor_padrao: number;
  teto_comissao_padrao: number;
  aplicar_teto_padrao: boolean;
  aplicar_baixo_valor_padrao: boolean;
  estoque_padrao?: number;
  categoria_id?: number;
  categoria_nome?: string;
  peso: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
  usar_imagens_publicas: boolean;
  descricao_template?: string;
  ncm_padrao?: string;
  cest_padrao?: string;
}> {
  const preferences = await getUserPreferences(userId);

  // Prioridade: preferencias > ultimos valores > padroes do sistema
  const preco_base = preferences?.preco_base_padrao ?? preferences?.ultimos_valores?.preco_base;

  const estoque_padrao =
    preferences?.estoque_padrao_padrao ??
    preferences?.ultimos_valores?.estoque_padrao ??
    SYSTEM_DEFAULTS.estoque_padrao;

  const categoria_id = preferences?.categoria_id_padrao ?? preferences?.ultimos_valores?.categoria_id;

  const peso = preferences?.peso_padrao ?? preferences?.ultimos_valores?.peso ?? SYSTEM_DEFAULTS.peso;

  const dimensoes = {
    comprimento:
      preferences?.dimensoes_padrao?.comprimento ??
      preferences?.ultimos_valores?.dimensoes?.comprimento ??
      SYSTEM_DEFAULTS.comprimento,
    largura:
      preferences?.dimensoes_padrao?.largura ??
      preferences?.ultimos_valores?.dimensoes?.largura ??
      tecidoLargura ??
      SYSTEM_DEFAULTS.largura,
    altura:
      preferences?.dimensoes_padrao?.altura ??
      preferences?.ultimos_valores?.dimensoes?.altura ??
      SYSTEM_DEFAULTS.altura,
  };

  const usar_imagens_publicas =
    preferences?.usar_imagens_publicas_padrao ?? SYSTEM_DEFAULTS.usar_imagens_publicas;

  return {
    preco_base,
    comissao_percentual_padrao:
      preferences?.comissao_percentual_padrao ?? SYSTEM_DEFAULTS.comissao_percentual_padrao,
    taxa_fixa_item_padrao:
      preferences?.taxa_fixa_item_padrao ?? SYSTEM_DEFAULTS.taxa_fixa_item_padrao,
    margem_liquida_percentual_padrao:
      preferences?.margem_liquida_percentual_padrao ?? SYSTEM_DEFAULTS.margem_liquida_percentual_padrao,
    modo_margem_lucro_padrao:
      preferences?.modo_margem_lucro_padrao ?? SYSTEM_DEFAULTS.modo_margem_lucro_padrao,
    margem_lucro_fixa_padrao:
      preferences?.margem_lucro_fixa_padrao ?? SYSTEM_DEFAULTS.margem_lucro_fixa_padrao,
    valor_minimo_baixo_valor_padrao:
      preferences?.valor_minimo_baixo_valor_padrao ?? SYSTEM_DEFAULTS.valor_minimo_baixo_valor_padrao,
    adicional_baixo_valor_padrao:
      preferences?.adicional_baixo_valor_padrao ?? SYSTEM_DEFAULTS.adicional_baixo_valor_padrao,
    teto_comissao_padrao: preferences?.teto_comissao_padrao ?? SYSTEM_DEFAULTS.teto_comissao_padrao,
    aplicar_teto_padrao: preferences?.aplicar_teto_padrao ?? SYSTEM_DEFAULTS.aplicar_teto_padrao,
    aplicar_baixo_valor_padrao:
      preferences?.aplicar_baixo_valor_padrao ?? SYSTEM_DEFAULTS.aplicar_baixo_valor_padrao,
    estoque_padrao,
    categoria_id,
    categoria_nome: preferences?.categoria_nome_padrao,
    peso,
    dimensoes,
    usar_imagens_publicas,
    descricao_template: preferences?.descricao_template,
    ncm_padrao: SYSTEM_DEFAULTS.ncm_padrao,
    cest_padrao: SYSTEM_DEFAULTS.cest_padrao,
  };
}
