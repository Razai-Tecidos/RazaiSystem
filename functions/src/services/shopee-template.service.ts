import admin from '../config/firebase';
import { 
  ShopeeProductTemplate, 
  CreateShopeeTemplateData,
} from '../types/shopee-template.types';

const db = admin.firestore();
const TEMPLATES_COLLECTION = 'shopee_product_templates';

/**
 * Lista templates do usuário
 */
export async function listTemplates(userId: string): Promise<ShopeeProductTemplate[]> {
  const snapshot = await db.collection(TEMPLATES_COLLECTION)
    .where('created_by', '==', userId)
    .orderBy('uso_count', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ShopeeProductTemplate));
}

/**
 * Busca template por ID
 */
export async function getTemplateById(id: string): Promise<ShopeeProductTemplate | null> {
  const doc = await db.collection(TEMPLATES_COLLECTION).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  } as ShopeeProductTemplate;
}

/**
 * Cria um novo template
 */
export async function createTemplate(
  userId: string,
  data: CreateShopeeTemplateData
): Promise<ShopeeProductTemplate> {
  const now = admin.firestore.Timestamp.now();
  
  const templateData = {
    nome: data.nome,
    descricao: data.descricao || null,
    categoria_id: data.categoria_id || null,
    categoria_nome: data.categoria_nome || null,
    preco_base: data.preco_base || null,
    estoque_padrao: data.estoque_padrao || null,
    peso: data.peso || null,
    dimensoes: data.dimensoes || null,
    descricao_template: data.descricao_template || null,
    usar_imagens_publicas: data.usar_imagens_publicas ?? true,
    incluir_tamanhos: data.incluir_tamanhos ?? false,
    tamanhos_padrao: data.tamanhos_padrao || null,
    created_at: now,
    updated_at: now,
    created_by: userId,
    uso_count: 0,
  };
  
  const docRef = await db.collection(TEMPLATES_COLLECTION).add(templateData);
  
  return {
    id: docRef.id,
    ...templateData,
  } as ShopeeProductTemplate;
}

/**
 * Atualiza um template
 */
export async function updateTemplate(
  id: string,
  userId: string,
  data: Partial<CreateShopeeTemplateData>
): Promise<ShopeeProductTemplate | null> {
  const docRef = db.collection(TEMPLATES_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const existingData = doc.data() as ShopeeProductTemplate;
  
  // Verifica se o usuário é o dono
  if (existingData.created_by !== userId) {
    throw new Error('Sem permissão para editar este template');
  }
  
  const updateData: Record<string, unknown> = {
    updated_at: admin.firestore.Timestamp.now(),
  };
  
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id;
  if (data.categoria_nome !== undefined) updateData.categoria_nome = data.categoria_nome;
  if (data.preco_base !== undefined) updateData.preco_base = data.preco_base;
  if (data.estoque_padrao !== undefined) updateData.estoque_padrao = data.estoque_padrao;
  if (data.peso !== undefined) updateData.peso = data.peso;
  if (data.dimensoes !== undefined) updateData.dimensoes = data.dimensoes;
  if (data.descricao_template !== undefined) updateData.descricao_template = data.descricao_template;
  if (data.usar_imagens_publicas !== undefined) updateData.usar_imagens_publicas = data.usar_imagens_publicas;
  if (data.incluir_tamanhos !== undefined) updateData.incluir_tamanhos = data.incluir_tamanhos;
  if (data.tamanhos_padrao !== undefined) updateData.tamanhos_padrao = data.tamanhos_padrao;
  
  await docRef.update(updateData);
  
  const updatedDoc = await docRef.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  } as ShopeeProductTemplate;
}

/**
 * Exclui um template
 */
export async function deleteTemplate(id: string, userId: string): Promise<boolean> {
  const docRef = db.collection(TEMPLATES_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  const data = doc.data() as ShopeeProductTemplate;
  
  // Verifica se o usuário é o dono
  if (data.created_by !== userId) {
    throw new Error('Sem permissão para excluir este template');
  }
  
  await docRef.delete();
  return true;
}

/**
 * Incrementa contador de uso do template
 */
export async function incrementTemplateUsage(id: string): Promise<void> {
  const docRef = db.collection(TEMPLATES_COLLECTION).doc(id);
  
  await docRef.update({
    uso_count: admin.firestore.FieldValue.increment(1),
    updated_at: admin.firestore.Timestamp.now(),
  });
}

/**
 * Aplica template a dados de produto
 */
export function applyTemplateToProduct(
  template: ShopeeProductTemplate,
  productData: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...productData };
  
  if (template.categoria_id && !result.categoria_id) {
    result.categoria_id = template.categoria_id;
    result.categoria_nome = template.categoria_nome;
  }
  
  if (template.preco_base && !result.preco_base) {
    result.preco_base = template.preco_base;
  }
  
  if (template.estoque_padrao && !result.estoque_padrao) {
    result.estoque_padrao = template.estoque_padrao;
  }
  
  if (template.peso && !result.peso) {
    result.peso = template.peso;
  }
  
  if (template.dimensoes && !result.dimensoes) {
    result.dimensoes = template.dimensoes;
  }
  
  if (template.descricao_template && !result.descricao_customizada) {
    result.descricao_customizada = template.descricao_template;
  }
  
  if (template.usar_imagens_publicas !== undefined && result.usar_imagens_publicas === undefined) {
    result.usar_imagens_publicas = template.usar_imagens_publicas;
  }
  
  if (template.incluir_tamanhos && template.tamanhos_padrao && !result.tamanhos) {
    result.tamanhos = template.tamanhos_padrao;
  }
  
  result.template_id = template.id;
  result.template_nome = template.nome;
  
  return result;
}
