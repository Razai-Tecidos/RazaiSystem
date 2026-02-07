import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/config/firebase';
import { CorTecido, CreateCorTecidoData, UpdateCorTecidoData } from '@/types/cor.types';

const COLLECTION_NAME = 'cor_tecido';

/**
 * Faz upload de uma imagem para o Storage no caminho cor-tecido/{vinculoId}/
 */
export async function uploadCorTecidoImage(
  vinculoId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado');
  }

  const storageRef = ref(storage, `cor-tecido/${vinculoId}/${filename}`);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Faz upload da imagem tingida e retorna a URL
 */
export async function uploadImagemTingida(
  vinculoId: string,
  blob: Blob
): Promise<string> {
  const timestamp = Date.now();
  return uploadCorTecidoImage(vinculoId, blob, `tingida_${timestamp}.jpg`);
}

/**
 * Gera o SKU do vínculo no formato "TecidoSKU-CorSKU"
 * Ex: "T007-MA001"
 */
function gerarSkuVinculo(tecidoSku?: string, corSku?: string): string | undefined {
  if (!tecidoSku || !corSku) {
    return undefined;
  }
  return `${tecidoSku}-${corSku}`;
}

/**
 * Cria um novo vínculo cor-tecido
 * Gera SKU automaticamente no formato "TecidoSKU-CorSKU"
 */
export async function createCorTecido(data: CreateCorTecidoData): Promise<string> {
  // Gerar SKU do vínculo se ambos SKUs existirem
  const sku = data.sku || gerarSkuVinculo(data.tecidoSku, data.corSku);
  
  const corTecidoData = {
    ...data,
    ...(sku ? { sku } : {}),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), corTecidoData);
  return docRef.id;
}

/**
 * Atualiza um vínculo cor-tecido existente
 */
export async function updateCorTecido(data: UpdateCorTecidoData): Promise<void> {
  const { id, ...updateData } = data;
  const docRef = doc(db, COLLECTION_NAME, id);
  
  await updateDoc(docRef, {
    ...updateData,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Remove um vínculo cor-tecido (soft delete)
 */
export async function deleteCorTecido(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Remove permanentemente um vínculo cor-tecido
 */
export async function hardDeleteCorTecido(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

/**
 * Busca um vínculo cor-tecido por ID
 */
export async function getCorTecidoById(id: string): Promise<CorTecido | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CorTecido;
}

/**
 * Busca todos os vínculos cor-tecido ativos
 * Nota: Busca todos e filtra no cliente pois deletedAt pode não existir
 */
export async function getAllCorTecidos(): Promise<CorTecido[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }) as CorTecido)
    .filter(ct => !ct.deletedAt); // Filtra no cliente
}

/**
 * Busca vínculos por cor ID
 */
export async function getCorTecidosByCorId(corId: string): Promise<CorTecido[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('corId', '==', corId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }) as CorTecido)
    .filter(ct => !ct.deletedAt);
}

/**
 * Busca vínculos por tecido ID
 */
export async function getCorTecidosByTecidoId(tecidoId: string): Promise<CorTecido[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }) as CorTecido)
    .filter(ct => !ct.deletedAt);
}

/**
 * Busca vínculo específico por cor e tecido
 */
export async function getCorTecidoByCorAndTecido(
  corId: string,
  tecidoId: string
): Promise<CorTecido | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('corId', '==', corId),
    where('tecidoId', '==', tecidoId)
  );
  
  const querySnapshot = await getDocs(q);
  
  // Filtra no cliente para ignorar deletados
  const activeDoc = querySnapshot.docs.find(doc => {
    const data = doc.data();
    return !data.deletedAt;
  });
  
  if (!activeDoc) {
    return null;
  }
  
  return {
    id: activeDoc.id,
    ...activeDoc.data(),
  } as CorTecido;
}

/**
 * Verifica se já existe vínculo entre cor e tecido
 */
export async function existsCorTecido(corId: string, tecidoId: string): Promise<boolean> {
  const existing = await getCorTecidoByCorAndTecido(corId, tecidoId);
  return existing !== null;
}

/**
 * Conta quantos vínculos uma cor tem
 */
export async function countVinculosByCor(corId: string): Promise<number> {
  const vinculos = await getCorTecidosByCorId(corId);
  return vinculos.length;
}

/**
 * Conta quantos vínculos um tecido tem
 */
export async function countVinculosByTecido(tecidoId: string): Promise<number> {
  const vinculos = await getCorTecidosByTecidoId(tecidoId);
  return vinculos.length;
}

/**
 * Listener em tempo real para todos os vínculos
 * Nota: Busca todos e filtra no cliente pois deletedAt pode não existir
 */
export function subscribeToCorTecidos(
  callback: (corTecidos: CorTecido[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const corTecidos = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }) as CorTecido)
      .filter(ct => !ct.deletedAt); // Filtra no cliente
    callback(corTecidos);
  });
}

/**
 * Listener em tempo real para vínculos de uma cor específica
 */
export function subscribeToCorTecidosByCor(
  corId: string,
  callback: (corTecidos: CorTecido[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('corId', '==', corId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const corTecidos = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }) as CorTecido)
      .filter(ct => !ct.deletedAt);
    callback(corTecidos);
  });
}

/**
 * Listener em tempo real para vínculos de um tecido específico
 */
export function subscribeToCorTecidosByTecido(
  tecidoId: string,
  callback: (corTecidos: CorTecido[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const corTecidos = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }) as CorTecido)
      .filter(ct => !ct.deletedAt);
    callback(corTecidos);
  });
}

/**
 * Atualiza dados denormalizados da cor em todos os vínculos
 * Útil quando a cor é renomeada
 * Também atualiza o SKU do vínculo se o SKU da cor mudou
 */
export async function updateCorDataInVinculos(
  corId: string,
  corData: { corNome?: string; corHex?: string; corSku?: string }
): Promise<void> {
  const vinculos = await getCorTecidosByCorId(corId);
  
  const updates = vinculos.map(vinculo => {
    // Regenerar SKU do vínculo se temos novo SKU da cor e SKU do tecido
    const novoSku = corData.corSku && vinculo.tecidoSku 
      ? `${vinculo.tecidoSku}-${corData.corSku}` 
      : undefined;
    
    return updateCorTecido({
      id: vinculo.id,
      ...corData,
      ...(novoSku ? { sku: novoSku } : {}),
    });
  });
  
  await Promise.all(updates);
}

/**
 * Atualiza dados denormalizados do tecido em todos os vínculos
 * Útil quando o tecido é renomeado
 * Também atualiza o SKU do vínculo se o SKU do tecido mudou
 */
export async function updateTecidoDataInVinculos(
  tecidoId: string,
  tecidoData: { tecidoNome?: string; tecidoSku?: string }
): Promise<void> {
  const vinculos = await getCorTecidosByTecidoId(tecidoId);
  
  const updates = vinculos.map(vinculo => {
    // Regenerar SKU do vínculo se temos novo SKU do tecido e SKU da cor
    const novoSku = tecidoData.tecidoSku && vinculo.corSku 
      ? `${tecidoData.tecidoSku}-${vinculo.corSku}` 
      : undefined;
    
    return updateCorTecido({
      id: vinculo.id,
      ...tecidoData,
      ...(novoSku ? { sku: novoSku } : {}),
    });
  });
  
  await Promise.all(updates);
}

/**
 * Move todos os vínculos de uma cor para outra
 * Usado para mesclar cores duplicadas
 * 
 * @param corOrigemId - ID da cor que será removida (seus vínculos serão movidos)
 * @param corDestinoId - ID da cor que receberá os vínculos
 * @param corDestinoData - Dados da cor destino para atualizar nos vínculos
 * @returns Número de vínculos movidos
 */
export async function moverVinculosDeCor(
  corOrigemId: string,
  corDestinoId: string,
  corDestinoData: { corNome: string; corHex?: string; corSku?: string }
): Promise<number> {
  // Buscar vínculos da cor origem
  const vinculosOrigem = await getCorTecidosByCorId(corOrigemId);
  
  // Buscar vínculos da cor destino para verificar duplicatas
  const vinculosDestino = await getCorTecidosByCorId(corDestinoId);
  const tecidosDestino = new Set(vinculosDestino.map(v => v.tecidoId));
  
  let vinculosMovidos = 0;
  
  for (const vinculo of vinculosOrigem) {
    // Verificar se já existe vínculo com o mesmo tecido na cor destino
    if (tecidosDestino.has(vinculo.tecidoId)) {
      // Já existe vínculo, apenas deletar o da origem
      await deleteCorTecido(vinculo.id);
    } else {
      // Regenerar SKU do vínculo com o novo SKU da cor
      const novoSku = vinculo.tecidoSku && corDestinoData.corSku 
        ? `${vinculo.tecidoSku}-${corDestinoData.corSku}` 
        : undefined;
      
      // Mover vínculo: atualizar corId e dados denormalizados
      await updateCorTecido({
        id: vinculo.id,
        corId: corDestinoId,
        corNome: corDestinoData.corNome,
        corHex: corDestinoData.corHex,
        corSku: corDestinoData.corSku,
        ...(novoSku ? { sku: novoSku } : {}),
      });
      vinculosMovidos++;
    }
  }
  
  return vinculosMovidos;
}
