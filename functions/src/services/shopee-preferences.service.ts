import admin from '../config/firebase';
import { 
  ShopeeUserPreferences, 
  UpdateShopeePreferencesData,
  SYSTEM_DEFAULTS 
} from '../types/shopee-preferences.types';

const db = admin.firestore();
const PREFERENCES_COLLECTION = 'shopee_user_preferences';

/**
 * Busca preferências do usuário
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
 * Salva/atualiza preferências do usuário
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
  
  if (data.preco_base_padrao !== undefined) {
    updateData.preco_base_padrao = data.preco_base_padrao;
  }
  if (data.estoque_padrao_padrao !== undefined) {
    updateData.estoque_padrao_padrao = data.estoque_padrao_padrao;
  }
  if (data.categoria_id_padrao !== undefined) {
    updateData.categoria_id_padrao = data.categoria_id_padrao;
  }
  if (data.peso_padrao !== undefined) {
    updateData.peso_padrao = data.peso_padrao;
  }
  if (data.dimensoes_padrao !== undefined) {
    updateData.dimensoes_padrao = data.dimensoes_padrao;
  }
  if (data.usar_imagens_publicas_padrao !== undefined) {
    updateData.usar_imagens_publicas_padrao = data.usar_imagens_publicas_padrao;
  }
  if (data.descricao_template !== undefined) {
    updateData.descricao_template = data.descricao_template;
  }
  if (data.ncm_padrao !== undefined) {
    updateData.ncm_padrao = data.ncm_padrao;
  }
  if (data.categoria_nome_padrao !== undefined) {
    updateData.categoria_nome_padrao = data.categoria_nome_padrao;
  }
  
  await docRef.set(updateData, { merge: true });
  
  const updatedDoc = await docRef.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  } as ShopeeUserPreferences;
}

/**
 * Atualiza os últimos valores usados
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
  
  await docRef.set({
    ultimos_valores: values,
    updated_at: admin.firestore.Timestamp.now(),
  }, { merge: true });
}

/**
 * Reseta preferências para padrões do sistema
 */
export async function resetUserPreferences(userId: string): Promise<void> {
  await db.collection(PREFERENCES_COLLECTION).doc(userId).delete();
}

/**
 * Retorna valores padrão combinados (preferências + sistema)
 */
export async function getDefaultValues(
  userId: string,
  tecidoLargura?: number
): Promise<{
  preco_base?: number;
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
}> {
  const preferences = await getUserPreferences(userId);
  
  // Prioridade: preferências > últimos valores > padrões do sistema
  const preco_base = preferences?.preco_base_padrao 
    ?? preferences?.ultimos_valores?.preco_base;
  
  const estoque_padrao = preferences?.estoque_padrao_padrao 
    ?? preferences?.ultimos_valores?.estoque_padrao;
  
  const categoria_id = preferences?.categoria_id_padrao 
    ?? preferences?.ultimos_valores?.categoria_id;
  
  const peso = preferences?.peso_padrao 
    ?? preferences?.ultimos_valores?.peso 
    ?? SYSTEM_DEFAULTS.peso;
  
  // Para largura: preferência > tecido > último valor > padrão
  const largura = preferences?.dimensoes_padrao?.largura 
    ?? (tecidoLargura ? tecidoLargura * 100 : undefined) // Converte metros para cm
    ?? preferences?.ultimos_valores?.dimensoes?.largura 
    ?? 150; // Padrão 1.5m em cm
  
  const dimensoes = {
    comprimento: preferences?.dimensoes_padrao?.comprimento 
      ?? preferences?.ultimos_valores?.dimensoes?.comprimento 
      ?? SYSTEM_DEFAULTS.comprimento,
    largura,
    altura: preferences?.dimensoes_padrao?.altura 
      ?? preferences?.ultimos_valores?.dimensoes?.altura 
      ?? SYSTEM_DEFAULTS.altura,
  };
  
  const usar_imagens_publicas = preferences?.usar_imagens_publicas_padrao 
    ?? SYSTEM_DEFAULTS.usar_imagens_publicas;
  
  return {
    preco_base,
    estoque_padrao,
    categoria_id,
    categoria_nome: preferences?.categoria_nome_padrao,
    peso,
    dimensoes,
    usar_imagens_publicas,
    descricao_template: preferences?.descricao_template,
    ncm_padrao: preferences?.ncm_padrao,
  };
}
