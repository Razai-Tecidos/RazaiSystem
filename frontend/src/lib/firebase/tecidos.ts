import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@/config/firebase';
import { Tecido, SkuControl, CreateTecidoData } from '@/types/tecido.types';

const TECIDOS_COLLECTION = 'tecidos';
const SKU_CONTROL_DOC = 'sku_control';
const SKU_CONTROL_ID = 'main';

/**
 * Busca todos os tecidos cadastrados (não excluídos)
 * Usa índice composto: deletedAt ASC, createdAt DESC
 */
export async function getTecidos(): Promise<Tecido[]> {
  try {
    const q = query(
      collection(db, TECIDOS_COLLECTION),
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      // Compatibilidade: converter array de composição para string se necessário
      if (Array.isArray(data.composicao)) {
        data.composicao = (data.composicao as any[])
          .map((item: any) => item.nome || item)
          .join(', ');
      }
      return {
        id: doc.id,
        ...data,
      } as Tecido;
    });
  } catch (error: any) {
    console.error('Erro ao carregar tecidos:', error);
    
    // Se erro de permissão ou coleção não existe, retornar array vazio
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      console.warn('Permissão negada ou coleção não encontrada. Retornando lista vazia.');
      return [];
    }
    
    throw error;
  }
}

/**
 * Busca um tecido específico por ID
 */
export async function getTecidoById(id: string): Promise<Tecido | null> {
  const docRef = doc(db, TECIDOS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  // Compatibilidade: converter array de composição para string se necessário
  if (Array.isArray(data.composicao)) {
    data.composicao = (data.composicao as any[])
      .map((item: any) => item.nome || item)
      .join(', ');
  }

  return {
    id: docSnap.id,
    ...data,
  } as Tecido;
}

/**
 * Faz upload de imagem para Firebase Storage
 */
export async function uploadTecidoImage(
  file: File,
  tecidoId: string
): Promise<string> {
  // Verificar se usuário está autenticado
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado. Faça login para continuar.');
  }

  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const storageRef = ref(storage, `tecidos/${tecidoId}/${fileName}`);

  try {
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    if (error.code === 'storage/unauthorized') {
      throw new Error('Sem permissão para fazer upload. Verifique as regras de segurança do Firebase Storage.');
    }
    throw error;
  }
}

/**
 * Remove imagem do Firebase Storage
 */
export async function deleteTecidoImage(imageUrl: string): Promise<void> {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    // Se a imagem não existir, não é um erro crítico
    console.warn('Erro ao deletar imagem:', error);
  }
}

/**
 * Cria um novo tecido no Firestore
 */
export async function createTecido(
  data: CreateTecidoData,
  sku: string,
  imageUrl?: string
): Promise<Tecido> {
  const tecidoData = {
    nome: data.nome,
    tipo: data.tipo || 'liso', // Default: liso
    largura: data.largura,
    composicao: data.composicao,
    imagemPadrao: imageUrl || '',
    descricao: data.descricao || '',
    sku,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  };

  const docRef = await addDoc(collection(db, TECIDOS_COLLECTION), tecidoData);
  const createdDoc = await getDoc(docRef);

  return {
    id: createdDoc.id,
    ...createdDoc.data(),
  } as Tecido;
}

/**
 * Atualiza um tecido existente
 */
export async function updateTecido(
  id: string,
  data: Partial<CreateTecidoData>,
  imageUrl?: string
): Promise<void> {
  const docRef = doc(db, TECIDOS_COLLECTION, id);
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.largura !== undefined) updateData.largura = data.largura;
  if (data.composicao !== undefined) updateData.composicao = data.composicao;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (imageUrl) updateData.imagemPadrao = imageUrl;

  await updateDoc(docRef, updateData);
}

/**
 * Exclui um tecido (soft delete - marca deletedAt)
 */
export async function deleteTecido(id: string, _imageUrl: string): Promise<void> {
  const docRef = doc(db, TECIDOS_COLLECTION, id);
  
  // Soft delete - marca como excluído
  await updateDoc(docRef, {
    deletedAt: serverTimestamp(),
  });

  // Remove imagem do storage (opcional - pode manter para histórico)
  // await deleteTecidoImage(imageUrl);
}

/**
 * Busca o documento de controle de SKU
 */
export async function getSkuControl(): Promise<SkuControl | null> {
  const docRef = doc(db, SKU_CONTROL_DOC, SKU_CONTROL_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as SkuControl;
}

/**
 * Cria ou atualiza o documento de controle de SKU
 */
export async function updateSkuControl(
  lastSkuNumber: number,
  invalidatedSkus: string[]
): Promise<void> {
  const docRef = doc(db, SKU_CONTROL_DOC, SKU_CONTROL_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    // Criar novo documento
    await setDoc(docRef, {
      lastSkuNumber,
      invalidatedSkus,
    });
  } else {
    // Atualizar documento existente
    await updateDoc(docRef, {
      lastSkuNumber,
      invalidatedSkus,
    });
  }
}

/**
 * Adiciona um SKU ao array de SKUs invalidados
 */
export async function addInvalidatedSku(sku: string): Promise<void> {
  const control = await getSkuControl();
  
  if (!control) {
    await updateSkuControl(0, [sku]);
    return;
  }

  const invalidatedSkus = [...control.invalidatedSkus];
  if (!invalidatedSkus.includes(sku)) {
    invalidatedSkus.push(sku);
  }

  await updateSkuControl(control.lastSkuNumber, invalidatedSkus);
}

/**
 * Migração: Atualiza todos os tecidos existentes para terem tipo 'liso'
 * Esta função deve ser executada uma única vez
 */
export async function migrateTecidosTipo(): Promise<number> {
  const tecidos = await getTecidos();
  let count = 0;
  
  for (const tecido of tecidos) {
    // Se o tecido não tem tipo definido, define como 'liso'
    if (!tecido.tipo) {
      const docRef = doc(db, TECIDOS_COLLECTION, tecido.id);
      await updateDoc(docRef, {
        tipo: 'liso',
        updatedAt: serverTimestamp(),
      });
      count++;
    }
  }
  
  return count;
}
