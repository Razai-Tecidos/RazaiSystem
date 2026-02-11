import admin from '../config/firebase';
import { Tamanho, CreateTamanhoData, UpdateTamanhoData, SkuControlTamanho } from '../types/tamanho.types';

const db = admin.firestore();
const TAMANHOS_COLLECTION = 'tamanhos';
const SKU_CONTROL_COLLECTION = 'sku_control';
const SKU_CONTROL_DOC = 'tamanho';

/**
 * Gera próximo SKU para tamanho (TAM001, TAM002, etc.)
 */
async function generateTamanhoSku(): Promise<string> {
  const controlRef = db.collection(SKU_CONTROL_COLLECTION).doc(SKU_CONTROL_DOC);
  
  return db.runTransaction(async (transaction) => {
    const controlDoc = await transaction.get(controlRef);
    let control: SkuControlTamanho;
    
    if (!controlDoc.exists) {
      control = { lastSkuNumber: 0, invalidatedSkus: [] };
    } else {
      control = controlDoc.data() as SkuControlTamanho;
    }
    
    // Verifica se há SKUs invalidados para reutilizar
    if (control.invalidatedSkus && control.invalidatedSkus.length > 0) {
      const reuseableSku = control.invalidatedSkus[0];
      control.invalidatedSkus = control.invalidatedSkus.slice(1);
      transaction.set(controlRef, control, { merge: true });
      return reuseableSku;
    }
    
    // Gera novo SKU
    const nextNumber = (control.lastSkuNumber || 0) + 1;
    const sku = `TAM${nextNumber.toString().padStart(3, '0')}`;
    
    transaction.set(controlRef, {
      lastSkuNumber: nextNumber,
      invalidatedSkus: control.invalidatedSkus || [],
    }, { merge: true });
    
    return sku;
  });
}

/**
 * Invalida um SKU para possível reutilização
 */
async function invalidateTamanhoSku(sku: string): Promise<void> {
  const controlRef = db.collection(SKU_CONTROL_COLLECTION).doc(SKU_CONTROL_DOC);
  
  await db.runTransaction(async (transaction) => {
    const controlDoc = await transaction.get(controlRef);
    const control = controlDoc.exists 
      ? controlDoc.data() as SkuControlTamanho 
      : { lastSkuNumber: 0, invalidatedSkus: [] };
    
    if (!control.invalidatedSkus) {
      control.invalidatedSkus = [];
    }
    
    if (!control.invalidatedSkus.includes(sku)) {
      control.invalidatedSkus.push(sku);
      control.invalidatedSkus.sort();
    }
    
    transaction.set(controlRef, control, { merge: true });
  });
}

/**
 * Lista todos os tamanhos ativos
 */
export async function listTamanhos(includeInactive = false): Promise<Tamanho[]> {
  // Compatibilidade: registros legados podem nao ter os campos `ativo`/`deletedAt`.
  // Nao usamos orderBy no Firestore para nao excluir docs sem campo `ordem`.
  const snapshot = await db.collection(TAMANHOS_COLLECTION).get();

  const tamanhos = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Tamanho));

  return tamanhos
    .filter((tamanho) => {
      const notDeleted = tamanho.deletedAt == null;
      if (!notDeleted) {
        return false;
      }

      if (includeInactive) {
        return true;
      }

      // Se `ativo` nao existir (legado), assume ativo.
      return tamanho.ativo !== false;
    })
    .sort((a, b) => {
      const ordemA = typeof a.ordem === 'number' ? a.ordem : Number.MAX_SAFE_INTEGER;
      const ordemB = typeof b.ordem === 'number' ? b.ordem : Number.MAX_SAFE_INTEGER;
      if (ordemA !== ordemB) {
        return ordemA - ordemB;
      }
      return (a.nome || '').localeCompare(b.nome || '');
    });
}

/**
 * Busca um tamanho por ID
 */
export async function getTamanhoById(id: string): Promise<Tamanho | null> {
  const doc = await db.collection(TAMANHOS_COLLECTION).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  if (data?.deletedAt) {
    return null;
  }
  
  return {
    id: doc.id,
    ...data,
  } as Tamanho;
}

/**
 * Cria um novo tamanho
 */
export async function createTamanho(data: CreateTamanhoData): Promise<Tamanho> {
  const sku = await generateTamanhoSku();
  const now = admin.firestore.Timestamp.now();
  
  // Busca a maior ordem atual
  const lastOrderDoc = await db.collection(TAMANHOS_COLLECTION)
    .where('deletedAt', '==', null)
    .orderBy('ordem', 'desc')
    .limit(1)
    .get();
  
  const lastOrder = lastOrderDoc.empty ? 0 : (lastOrderDoc.docs[0].data().ordem || 0);
  
  const tamanhoData: Record<string, unknown> = {
    nome: data.nome,
    ordem: data.ordem ?? lastOrder + 1,
    ativo: true,
    sku,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // Só inclui descricao se tiver valor (Firestore não aceita undefined)
  if (data.descricao) {
    tamanhoData.descricao = data.descricao;
  }
  
  const docRef = await db.collection(TAMANHOS_COLLECTION).add(tamanhoData);
  
  return {
    id: docRef.id,
    ...tamanhoData,
  } as Tamanho;
}

/**
 * Atualiza um tamanho
 */
export async function updateTamanho(id: string, data: UpdateTamanhoData): Promise<Tamanho | null> {
  const docRef = db.collection(TAMANHOS_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists || doc.data()?.deletedAt) {
    return null;
  }
  
  const updateData: Record<string, unknown> = {
    updatedAt: admin.firestore.Timestamp.now(),
  };
  
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.descricao !== undefined && data.descricao !== null) {
    updateData.descricao = data.descricao;
  } else if (data.descricao === null) {
    updateData.descricao = admin.firestore.FieldValue.delete();
  }
  if (data.ordem !== undefined) updateData.ordem = data.ordem;
  if (data.ativo !== undefined) updateData.ativo = data.ativo;
  
  await docRef.update(updateData);
  
  const updatedDoc = await docRef.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  } as Tamanho;
}

/**
 * Exclui um tamanho (soft delete)
 */
export async function deleteTamanho(id: string): Promise<boolean> {
  const docRef = db.collection(TAMANHOS_COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists || doc.data()?.deletedAt) {
    return false;
  }
  
  const sku = doc.data()?.sku;
  
  await docRef.update({
    deletedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    ativo: false,
  });
  
  // Invalida o SKU para possível reutilização
  if (sku) {
    await invalidateTamanhoSku(sku);
  }
  
  return true;
}

/**
 * Reordena tamanhos
 */
export async function reorderTamanhos(orderedIds: string[]): Promise<void> {
  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  
  orderedIds.forEach((id, index) => {
    const docRef = db.collection(TAMANHOS_COLLECTION).doc(id);
    batch.update(docRef, {
      ordem: index + 1,
      updatedAt: now,
    });
  });
  
  await batch.commit();
}
